import React, { useState } from "react";

/* ===== Pomocnicze ===== */
const d = (s) => Math.floor(Math.random() * s) + 1;
const statMod = (v) => {
  if (v <= 1) return 0;
  if (v <= 4) return 1;
  if (v <= 7) return 2;
  if (v <= 10) return 3;
  return 4;
};

/* ===== Broń ===== */
const weaponData = {
  sword: { name: "Miecz krótki", stat: "STR", dmgDie: 6 },
  bow: { name: "Łuk", stat: "PER", dmgDie: 6 },
  staff: { name: "Kij magiczny", stat: "MAG", dmgDie: 4 },
};

/* ===== Typy wrogów ===== */
const enemyTypes = {
  "Elfi Kultysta": {
    hp: 45, maxHp: 45, essence: 20, maxEssence: 20,
    armor: 4, magicDefense: 4, toHit: 8, defense: 10,
    spells: ["Mroczny Pakt", "Wyssanie życia", "Magiczny pocisk"]
  },
  "Szpieg Magmaratora": {
    hp: 30, maxHp: 30, essence: 20, maxEssence: 20,
    armor: 2, magicDefense: 2, toHit: 10, defense: 8,
    spells: ["Magiczny pocisk", "Wybuch energii"]
  }
};

/* ===== Tworzenie nowej postaci ===== */
const makeChar = () => ({
  name: "",
  race: "Człowiek",
  clazz: "Wojownik",

  STR: null, DEX: null, PER: null, MAG: null, CHA: null,
  armor: 0, magicDefense: 0,

  hp: 20, maxHp: 20,
  essence: 20, maxEssence: 20,

  actionsLeft: 2,

  // Rasowe
  humanCharges: [false, false, false, false, false],
  humanBuff: null,
  elfChargeUsed: false,
  elfChargedTurn: null,
  dwarfPassiveArmed: false,
  dwarfHibernating: false,
  dwarfHibernateTurns: 0,
  faeykaiChargesLeft: 3,
  faeykaiMaskBroken: false,
  faeykaiOutsideHomeland: true,
  effects: [],

  // Klasowe
  classUsed: false,
  warriorReady: false,
  archerReady: false,
  shooterReady: false,
  mageReady: false,
  mageShield: 0,
});

/* ====== GŁÓWNY KOMPONENT ====== */
export default function BattleSimulator() {
  const [sets, setSets] = useState([makeChar(), makeChar(), makeChar(), makeChar()]);
  const [lockedSets, setLockedSets] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  const [log, setLog] = useState([]);
  const [turn, setTurn] = useState(1);

  const [enemies, setEnemies] = useState([]); // instancje wrogów
  const [enemyWeaponChoice, setEnemyWeaponChoice] = useState("sword");
  const [selectedEnemyId, setSelectedEnemyId] = useState(null);
  const [enemyTargetPlayer, setEnemyTargetPlayer] = useState(0);

  const addLog = (line) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`[${stamp}] ${line}`, ...prev]);
  };

  /* ====== Odpoczynek ====== */
  const restSet = (i) => {
    setSets((prev) => {
      const n = [...prev];
      const c = { ...n[i] };

      c.hp = c.maxHp;
      c.essence = c.maxEssence;
      c.actionsLeft = 2;

      // reset rasowych/klasowych zdolności
      c.humanCharges = [false, false, false, false, false];
      c.humanBuff = null;
      c.elfChargeUsed = false;
      c.dwarfPassiveArmed = false;
      c.dwarfHibernating = false;
      c.dwarfHibernateTurns = 0;
      c.faeykaiChargesLeft = 3;
      c.faeykaiMaskBroken = false; // reset maski
      c.effects = [];

      n[i] = c;
      return n;
    });
    addLog(`💤 Postać ${i + 1} odpoczęła i odzyskała siły.`);
  };

  /* ====== Render graczy ====== */
  const renderPlayer = (c, i) => (
    <div key={i} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
      <h3>Postać {i + 1}</h3>
      <div>Imię: <input value={c.name} onChange={e => {
        const v = e.target.value;
        setSets(prev => { const n = [...prev]; n[i] = { ...n[i], name: v }; return n; });
      }} /></div>
      <div>Rasa:
        <select value={c.race} onChange={e => {
          const v = e.target.value;
          setSets(prev => { const n = [...prev]; n[i] = { ...n[i], race: v }; return n; });
        }}>
          <option>Człowiek</option>
          <option>Elf</option>
          <option>Krasnolud</option>
          <option>Faeykai</option>
        </select>
      </div>
      <div>Klasa:
        <select value={c.clazz} onChange={e => {
          const v = e.target.value;
          setSets(prev => { const n = [...prev]; n[i] = { ...n[i], clazz: v }; return n; });
        }}>
          <option>Wojownik</option>
          <option>Łucznik</option>
          <option>Strzelec</option>
          <option>Mag</option>
          <option>Dyplomata</option>
        </select>
      </div>

      <div>HP: {c.hp}/{c.maxHp}</div>
      <div>Esencja: {c.essence}/{c.maxEssence}</div>
      <div>Akcje: {c.actionsLeft}</div>

      {/* Zatwierdź / Odpoczynek */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => restSet(i)}>💤 Odpocznij</button>
      </div>
    </div>
  );
  /* ===================== POMOC / WSPÓŁDZIELONE ===================== */
  const getActiveChar = () => sets[activeSet] || makeChar();

  const lockSet = (i) => {
    const s = sets[i];
    const statsOk = ["STR","DEX","PER","MAG","CHA"].every(k => s[k] !== null && s[k] !== "");
    if (!statsOk) return addLog(`❌ Postać ${i+1}: uzupełnij wszystkie statystyki.`);
    setLockedSets(prev => { const n=[...prev]; n[i]=true; return n; });
    addLog(`✔️ Postać ${i+1} (${s.name||`Postać ${i+1}`}) została zatwierdzona.`);
  };

  const spendPlayerAction = (i) => {
    let ok = false;
    setSets(prev => {
      const n=[...prev];
      const c={...n[i]};
      if ((c.actionsLeft||0)>0) { c.actionsLeft -= 1; ok = true; }
      n[i]=c; return n;
    });
    return ok;
  };

  /* ===================== UI pasywek rasowych ===================== */
  const RacePassivesPanel = ({ c, i }) => {
    return (
      <div style={{ marginTop: 10, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        {/* LUDZIE */}
        {c.race === "Człowiek" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ludzka wytrwałość (5×/odpoczynek):</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {c.humanCharges.map((used, idx) => {
                const isPending = c.humanPendingIdx === idx && !used;
                return (
                  <div
                    key={idx}
                    onClick={()=>{
                      if (used) return;
                      if (!spendPlayerAction(i)) { addLog("❌ Brak akcji (Ludzie)."); return; }
                      setSets(prev => { const n=[...prev]; n[i] = { ...n[i], humanPendingIdx: idx }; return n; });
                    }}
                    title={used ? "Zużyte" : "Kliknij, by użyć (zużywa 1 akcję)"}
                    style={{
                      width: 18, height: 18,
                      background: used || isPending ? "#c62828" : "#2e7d32",
                      borderRadius: 3, cursor: used ? "not-allowed" : "pointer",
                      border: "1px solid #0004"
                    }}
                  />
                );
              })}
              {c.humanPendingIdx != null && !c.humanCharges[c.humanPendingIdx] && (
                <>
                  <select
                    value={c.humanPendingChoice || "dmg"}
                    onChange={(e)=>setSets(prev=>{
                      const n=[...prev]; n[i] = { ...n[i], humanPendingChoice: e.target.value }; return n;
                    })}
                  >
                    <option value="dmg">+2 obrażeń (do końca tury)</option>
                    <option value="tohit">+2 do trafienia (do końca tury)</option>
                    <option value="hp">+2 HP (natychmiast)</option>
                  </select>
                  <button
                    onClick={()=>{
                      setSets(prev=>{
                        const n=[...prev];
                        const me={...n[i]};
                        const idx = me.humanPendingIdx;
                        if (idx==null || me.humanCharges[idx]) return n;
                        const choice = me.humanPendingChoice || "dmg";
                        me.humanCharges = me.humanCharges.map((u,k)=> k===idx ? true : u);
                        me.humanPendingIdx = null;

                        if (choice==="hp") {
                          me.hp = Math.min(me.maxHp||20, (me.hp||0)+2);
                          me.humanBuff = null;
                        } else {
                          me.humanBuff = { type: choice, expiresTurn: turn }; // wygasa przy nextTurn
                        }

                        n[i]=me; return n;
                      });
                      addLog(`👤 P${i+1} używa ludzkiej zdolności: ${c.humanPendingChoice==="dmg"?"+2 DMG":c.humanPendingChoice==="tohit"?"+2 TO-HIT":"+2 HP"}.`);
                    }}
                  >
                    Zastosuj
                  </button>
                </>
              )}
            </div>
            <small style={{ opacity: .7 }}>Efekt nie stackuje się; wygasa po tej turze. Użycie zużywa 1 akcję.</small>
          </div>
        )}

        {/* ELF */}
        {c.race === "Elf" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Elfie naładowanie (1×/odpoczynek):</div>
            <div
              onClick={()=>{
                if (c.elfChargeUsed) return;
                if (!spendPlayerAction(i)) { addLog("❌ Brak akcji (Elf)."); return; }
                setSets(prev=>{
                  const n=[...prev]; const me={...n[i]};
                  me.elfChargeUsed = true; me.elfChargedTurn = turn;
                  n[i]=me; return n;
                });
                addLog(`🌩️ P${i+1} (Elf) ładuje eksplozję — wybuch w następnej turze (elf −5 HP; wszyscy wrogowie −10 HP i ogłuszenie 1 turę).`);
              }}
              title={c.elfChargeUsed ? "Zużyte do odpoczynku" : "Kliknij, by naładować (zużywa 1 akcję)"}
              style={{
                width: 18, height: 18,
                background: c.elfChargeUsed ? "#c62828" : "#2e7d32",
                borderRadius: 3, cursor: c.elfChargeUsed ? "not-allowed" : "pointer",
                border: "1px solid #0004"
              }}
            />
            <div style={{ marginTop: 4, fontSize: 12, opacity: .8 }}>
              {c.elfChargeUsed ? "Naładowano — eksplozja w następnej turze." : "Kliknięcie zużywa 1 akcję."}
            </div>
          </div>
        )}

        {/* KRASNOLUD */}
        {c.race === "Krasnolud" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Krasnoludzka hibernacja (uzbrojenie):</div>
            <button
              onClick={()=>{
                if (c.dwarfPassiveArmed) return;
                if (!spendPlayerAction(i)) { addLog("❌ Brak akcji (Krasnolud)."); return; }
                setSets(prev=>{
                  const n=[...prev]; n[i] = { ...n[i], dwarfPassiveArmed: true }; return n;
                });
                addLog(`⛏️ P${i+1} (Krasnolud) uzbraja hibernację. Po spadku do 0 HP — hibernacja 2 tury (niewrażliwy), można podnieść.`);
              }}
              disabled={c.dwarfPassiveArmed}
            >
              {c.dwarfPassiveArmed ? "Uzbrojone" : "Uzbrój hibernację (1 akcja)"}
            </button>
            <div style={{ marginTop: 4, fontSize: 12, opacity: .8 }}>
              Po podniesieniu (25% Max HP) przycisk znów będzie dostępny.
            </div>
          </div>
        )}

        {/* FAEYKAI */}
        {c.race === "Faeykai" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems:"center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600 }}>Faeykai (3×/odpoczynek):</div>
              <div>Maska: {c.faeykaiMaskBroken ? "🔴 pęknięta" : "🟢 sprawna"} <small style={{opacity:.7}}>(odnawia się przy odpoczynku; pęka &lt;21% max HP)</small></div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {Array.from({ length: 3 }).map((_, idx) => {
                const used = idx >= (3 - (c.faeykaiChargesLeft || 0));
                return (
                  <div
                    key={idx}
                    onClick={()=>{
                      if (used) return;
                      if (!spendPlayerAction(i)) { addLog("❌ Brak akcji (Faeykai)."); return; }
                      // otwórz mini-konfigurator w stanie postaci
                      setSets(prev=>{
                        const n=[...prev]; const me={...n[i]};
                        me.faeykaiPending = { mode:"bless", targetKind:"player", playerIndex:0, enemyId:"" };
                        n[i]=me; return n;
                      });
                    }}
                    title={used ? "Zużyte" : "Kliknij, by użyć (zużywa 1 akcję)"}
                    style={{
                      width: 18, height: 18,
                      background: used ? "#c62828" : "#2e7d32",
                      borderRadius: 3, cursor: used ? "not-allowed" : "pointer",
                      border: "1px solid #0004"
                    }}
                  />
                );
              })}
            </div>

            {c.faeykaiPending && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 8, marginTop: 6 }}>
                <label>Efekt
                  <select
                    value={c.faeykaiPending.mode}
                    onChange={(e)=>setSets(prev=>{
                      const n=[...prev]; const me={...n[i]};
                      me.faeykaiPending = { ...me.faeykaiPending, mode: e.target.value };
                      n[i]=me; return n;
                    })}
                  >
                    <option value="bless">Błogosławieństwo (+3 HP przez 3 tury)</option>
                    <option value="curse">Przekleństwo (−3 do trafienia przez 3 tury)</option>
                  </select>
                </label>

                <label>Cel
                  <select
                    value={c.faeykaiPending.targetKind}
                    onChange={(e)=>setSets(prev=>{
                      const n=[...prev]; const me={...n[i]};
                      me.faeykaiPending = { ...me.faeykaiPending, targetKind: e.target.value };
                      n[i]=me; return n;
                    })}
                  >
                    <option value="player">Postać</option>
                    <option value="enemy">Wróg</option>
                  </select>
                </label>

                {c.faeykaiPending.targetKind === "player" ? (
                  <label>Postać
                    <select
                      value={c.faeykaiPending.playerIndex}
                      onChange={(e)=>setSets(prev=>{
                        const n=[...prev]; const me={...n[i]};
                        me.faeykaiPending = { ...me.faeykaiPending, playerIndex: Number(e.target.value) };
                        n[i]=me; return n;
                      })}
                    >
                      {sets.map((_, idx)=> <option key={idx} value={idx}>Postać {idx+1}</option>)}
                    </select>
                  </label>
                ) : (
                  <label>Wróg
                    <select
                      value={c.faeykaiPending.enemyId}
                      onChange={(e)=>setSets(prev=>{
                        const n=[...prev]; const me={...n[i]};
                        me.faeykaiPending = { ...me.faeykaiPending, enemyId: e.target.value };
                        n[i]=me; return n;
                      })}
                    >
                      <option value="">—</option>
                      {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </label>
                )}

                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    onClick={()=>{
                      const p = c.faeykaiPending;
                      if (!p) return;
                      // zużyj ładunek
                      setSets(prev=>{
                        const n=[...prev];
                        const me={...n[i]};
                        me.faeykaiChargesLeft = Math.max(0, (me.faeykaiChargesLeft||0) - 1);
                        n[i]=me; return n;
                      });

                      if (p.mode==="bless") {
                        if (p.targetKind==="player") {
                          setSets(prev=>{
                            const n=[...prev]; const trg={...n[p.playerIndex]};
                            trg.effects = [ ...(trg.effects||[]), { type:"bless", value:3, turnsLeft:3 } ];
                            n[p.playerIndex] = trg; return n;
                          });
                          addLog(`🌱 Faeykai P${i+1} błogosławi P${(p.playerIndex)+1}: +3 HP przez 3 tury.`);
                        } else {
                          // błogosławieństwo na wroga – uproszczenie: +3 HP/ turę przez 3 tury
                          setEnemies(prev => prev.map(e => e.id===p.enemyId ? { ...e, bless:{ turnsLeft:3, value:3 } } : e));
                          addLog(`🌱 Faeykai P${i+1} błogosławi ${p.enemyId}: +3 HP przez 3 tury.`);
                        }
                      } else {
                        if (p.targetKind==="player") {
                          setSets(prev=>{
                            const n=[...prev]; const trg={...n[p.playerIndex]};
                            trg.effects = [ ...(trg.effects||[]), { type:"curseToHit", value:3, turnsLeft:3 } ];
                            n[p.playerIndex] = trg; return n;
                          });
                          addLog(`🌑 Faeykai P${i+1} przeklina P${(p.playerIndex)+1}: −3 do trafienia przez 3 tury.`);
                        } else {
                          // klątwa na wroga: −3 do trafienia przez 3 tury (próg rośnie o 3)
                          setEnemies(prev => prev.map(e => e.id===p.enemyId ? { ...e, cursed:3 } : e));
                          addLog(`🌑 Faeykai P${i+1} przeklina ${p.enemyId}: −3 do trafienia przez 3 tury.`);
                        }
                      }

                      // zamknij konfigurator
                      setSets(prev=>{
                        const n=[...prev]; const me={...n[i]}; me.faeykaiPending = null; n[i]=me; return n;
                      });
                    }}
                  >
                    Zastosuj efekt
                  </button>
                  <button
                    onClick={()=>{
                      setSets(prev=>{
                        const n=[...prev]; const me={...n[i]}; me.faeykaiPending = null; n[i]=me; return n;
                      });
                      addLog("ℹ️ Anulowano konfigurację Faeykai (akcja pozostała zużyta).");
                    }}
                    style={{ opacity: .8 }}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ===================== WROGOWIE: generowanie instancji ===================== */
  const [roster, setRoster] = useState({ "Elfi Kultysta": 1, "Szpieg Magmaratora": 0 });

  const createEnemies = () => {
    const list = [];
    Object.entries(roster).forEach(([typeName, count]) => {
      for (let i=1;i<=Number(count||0);i++){
        const base = enemyTypes[typeName];
        list.push({
          id: `${typeName} #${i}`,
          type: typeName,
          name: `${typeName} #${i}`,
          hp: base.hp, maxHp: base.maxHp,
          essence: base.essence, maxEssence: base.maxEssence,
          armor: base.armor, magicDefense: base.magicDefense,
          toHit: base.toHit, defense: base.defense,
          spells: base.spells,
          actionsLeft: 2,
          bless: null,    // {turnsLeft,value}
          cursed: 0       // tury kary do trafienia
        });
      }
    });
    setEnemies(list);
    setSelectedEnemyId(list[0]?.id || null);
    addLog(`👥 Dodano do walki wrogów: ${list.length} szt.`);
  };

  /* ===================== WALKA: gracz → wróg (atak bronią) ===================== */
  const [weaponChoice, setWeaponChoice] = useState("sword");
  const [targetEnemyId, setTargetEnemyId] = useState(null);

  const damageEnemyInstance = (id, amount) => {
    if (amount<=0) return;
    setEnemies(prev => prev.map(e => e.id===id ? { ...e, hp: Math.max(0, e.hp - amount) } : e));
  };

  const doPlayerAttack = () => {
    const i = activeSet;
    if (!lockedSets[i]) return addLog("❌ Najpierw zatwierdź postać.");
    const c = getActiveChar();
    if ((c.actionsLeft||0) <= 0) return addLog("❌ Brak akcji.");
    const enemyId = targetEnemyId || selectedEnemyId;
    const enemy = enemies.find(e => e.id===enemyId);
    if (!enemy) return addLog("❌ Wybierz wroga.");

    const w = weaponData[weaponChoice];
    const stat = Number(c[w.stat]||0);
    const humanToHit = (c.race==="Człowiek" && c.humanBuff?.type==="tohit") ? 2 : 0;

    // Wojownik — maksymalny cios (fizyczny) – jeśli kiedyś dodasz przełącznik, tutaj go uwzględnij
    // (zostawiamy standardowy rzut)
    const roll20 = d(20);
    const toHit = roll20 + stat + humanToHit;
    const hit = toHit >= (enemy.defense || 0);

    let lines = [
      `⚔️ P${i+1} atakuje (${w.name}) → ${enemy.name}`,
      `🎯 Trafienie: k20=${roll20} + ${w.stat}(${stat})${humanToHit? " + human(+2)": ""} = ${toHit} vs Obrona ${enemy.defense} → ${hit? "✅":"❌"}`
    ];
    if (!hit) { addLog(lines.join("\n")); return; }

    const dmgDie = d(w.dmgDie);
    const humanDmg = (c.race==="Człowiek" && c.humanBuff?.type==="dmg") ? 2 : 0;
    const raw = dmgDie + humanDmg;
    const afterArmor = Math.max(0, raw - (enemy.armor||0));
    lines.push(`🗡️ Obrażenia: k${w.dmgDie}=${dmgDie}${humanDmg? " + human(+2)": ""} = ${raw} − Pancerz(${enemy.armor||0}) = ${afterArmor}`);

    // Strzelec/Łucznik można tu rozwinąć o debuffy – skracamy, by kod był stabilny.

    spendPlayerAction(i);
    addLog(lines.join("\n"));
    damageEnemyInstance(enemy.id, afterArmor);
  };

  /* ===================== WALKA: czar gracza ===================== */
  const PLAYER_SPELLS = {
    "Magiczny pocisk": { cost: 3, dmgDie: 6, type: "damage" },
    "Wybuch energii":  { cost: 5, dmgDie: 4, type: "damage" },
    "Zasklepienie ran":{ cost: 5, healDie: 6, type: "heal" },
    "Oślepienie":      { cost: 8, type: "effect" },
  };
  const [playerSpell, setPlayerSpell] = useState("Magiczny pocisk");
  const [healTarget, setHealTarget] = useState(0);

  const nextTurn = () => {
    // gracze: odśwież akcje + efekty na turę
    setSets(prev => prev.map((c, idx) => {
      const me = { ...c, actionsLeft: 2 };

      // ludzki buff wygasa po turze
      if (me.humanBuff && me.humanBuff.expiresTurn < turn + 1) me.humanBuff = null;

      // Elf – eksplozja po 1 turze
      if (me.race === "Elf" && me.elfChargeUsed && me.elfChargedTurn === turn) {
        const before = me.hp||0;
        me.hp = Math.max(0, before - 5);
        addLog(`🌩️ Elf (P${idx+1}) — eksplozja: elf −5 HP; wrogowie −10 HP (ogłuszenie 1 turę – skrót).`);
        setEnemies(prevE => prevE.map(e => ({ ...e, hp: Math.max(0, e.hp - 10) })));
        me.elfChargeUsed = false; me.elfChargedTurn = null;
      }

      // Efekty gracza: błogosławieństwo / klątwa do trafienia
      if (me.effects?.length) {
        me.effects = me.effects
          .map(ef => {
            if (ef.type==="bless" && ef.turnsLeft>0) {
              me.hp = Math.min(me.maxHp||20, (me.hp||0) + (ef.value||0));
              return { ...ef, turnsLeft: ef.turnsLeft - 1 };
            }
            if (ef.type==="curseToHit" && ef.turnsLeft>0) {
              return { ...ef, turnsLeft: ef.turnsLeft - 1 };
            }
            return { ...ef, turnsLeft: (ef.turnsLeft||0)-1 };
          })
          .filter(ef => ef.turnsLeft>0);
      }

      // Faeykai – pęknięcie maski przy <21% max HP
      if (me.race === "Faeykai") {
        const thr = Math.ceil((me.maxHp||20) * 0.21);
        if ((me.hp||0) < thr) me.faeykaiMaskBroken = true;
      }

      return me;
    }));

    // wrogowie: odnów akcje, odlicz błogosławieństwo i klątwę
    setEnemies(prev => prev.map(e => {
      let hp = e.hp;
      let bless = e.bless;
      if (bless?.turnsLeft > 0) {
        hp = Math.min(e.maxHp, hp + (bless.value || 0));
        bless = { ...bless, turnsLeft: bless.turnsLeft - 1 };
      } else {
        bless = null;
      }
      const cursed = Math.max(0, (e.cursed||0) - 1);
      return { ...e, actionsLeft: 2, hp, bless, cursed };
    }));

    setTurn(t => t+1);
    addLog(`⏱️ Rozpoczyna się tura ${turn + 1}.`);
  };

  const castPlayerSpell = () => {
    const i = activeSet;
    if (!lockedSets[i]) return addLog("❌ Najpierw zatwierdź postać.");
    const c = getActiveChar();
    if ((c.actionsLeft||0) <= 0) return addLog("❌ Brak akcji.");

    const spell = PLAYER_SPELLS[playerSpell];
    if (!spell) return;
    if ((c.essence||0) < spell.cost) return addLog(`❌ Esencja: ${c.essence} < koszt ${spell.cost}.`);

    // pobierz koszt
    setSets(prev => { const n=[...prev]; n[i] = { ...n[i], essence: (n[i].essence||0) - spell.cost }; return n; });
    spendPlayerAction(i);

    let lines = [`✨ P${i+1} rzuca „${playerSpell}” — koszt ${spell.cost} (Esencja po: ${(c.essence||0)-spell.cost})`];

    // HEAL
    if (spell.type==="heal") {
      const roll = d(spell.healDie);
      setSets(prev => {
        const n=[...prev]; const trg={...n[healTarget]};
        trg.hp = Math.min(trg.maxHp||20, (trg.hp||0) + roll);
        n[healTarget]=trg; return n;
      });
      lines.push(`💚 Leczenie: k${spell.healDie}=${roll} → P${healTarget+1} +${roll} HP`);
      return addLog(lines.join("\n"));
    }

    // DAMAGE / EFFECT
    const enemyId = targetEnemyId || selectedEnemyId;
    const enemy = enemies.find(e => e.id===enemyId);
    if (!enemy) return addLog("❌ Wybierz wroga.");

    const MAG = Number(c.MAG||0);
    const faeykaiPenalty = (c.race==="Faeykai" && c.faeykaiOutsideHomeland) ? 5 : 0;
    const maskPenalty = (c.race==="Faeykai" && c.faeykaiMaskBroken) ? 3 : 0;
    const humanToHit = (c.race==="Człowiek" && c.humanBuff?.type==="tohit") ? 2 : 0;
    const toHitPenaltyFromCurses = (c.effects||[]).reduce((acc,ef)=> ef.type==="curseToHit" ? acc + (ef.value||0) : acc, 0);

    const roll20 = d(20);
    const toHit = roll20 + MAG - faeykaiPenalty + humanToHit - maskPenalty - toHitPenaltyFromCurses;
    const hit = toHit >= (enemy.defense||0);

    lines.push(
      `🎯 Trafienie: k20=${roll20} + MAG(${MAG})` +
      (faeykaiPenalty? " − Faeykai(−5)": "") +
      (humanToHit? " + human(+2)" : "") +
      (maskPenalty? ` − maska(−${maskPenalty})`:"") +
      (toHitPenaltyFromCurses? ` − klątwy(−${toHitPenaltyFromCurses})`:"") +
      ` = ${toHit} vs Obrona ${enemy.defense} → ${hit? "✅":"❌"}`
    );

    if (!hit) return addLog(lines.join("\n"));

    if (spell.type==="damage") {
      const rollDmg = d(spell.dmgDie);
      const mod = statMod(MAG);
      const humanDmg = (c.race==="Człowiek" && c.humanBuff?.type==="dmg") ? 2 : 0;
      const raw = rollDmg + mod + humanDmg;
      const reduced = Math.max(0, raw - (enemy.magicDefense||0));
      lines.push(`💥 Obrażenia: k${spell.dmgDie}=${rollDmg} + mod(MAG)=${mod}${humanDmg? " + human(+2)": ""} = ${raw}`);
      lines.push(`🛡️ Redukcja magią: −${enemy.magicDefense||0} → ${reduced}`);
      addLog(lines.join("\n"));
      damageEnemyInstance(enemy.id, reduced);
      return;
    }

    // Oślepienie – w tym szkielecie jedynie log
    lines.push("🌑 Oślepienie (efekt) — do rozbudowy wg zasad statusów.");
    addLog(lines.join("\n"));
  };

  /* ===================== RENDER (część główna) ===================== */
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>🕒 Tura: {turn}</h2>
        <button onClick={nextTurn}>➡️ Następna tura</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
        {/* LEWA KOLUMNA — Postacie + Test walki */}
        <div>
          <h3>1) Postacie</h3>
          {sets.map((c, i) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems:"center" }}>
                <strong>Postać {i + 1}</strong>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="active" checked={activeSet===i} onChange={()=>setActiveSet(i)} />
                  Aktywna
                </label>
              </div>

              <div>Imię: <input value={c.name} onChange={e => setSets(prev => { const n=[...prev]; n[i]={...n[i], name:e.target.value}; return n; })} /></div>
              <div>Rasa:&nbsp;
                <select value={c.race} onChange={e => setSets(prev => { const n=[...prev]; n[i]={...n[i], race:e.target.value}; return n; })}>
                  <option>Człowiek</option><option>Elf</option><option>Krasnolud</option><option>Faeykai</option>
                </select>
              </div>
              <div>Klasa:&nbsp;
                <select value={c.clazz} onChange={e => setSets(prev => { const n=[...prev]; n[i]={...n[i], clazz:e.target.value}; return n; })}>
                  <option>Wojownik</option><option>Łucznik</option><option>Strzelec</option><option>Mag</option><option>Dyplomata</option>
                </select>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginTop:6 }}>
                {["STR","DEX","PER","MAG","CHA"].map(k=>(
                  <label key={k}>{k}
                    <input type="number" value={c[k] ?? ""} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i],[k]: e.target.value===""? null : Number(e.target.value)}; return n; })} disabled={lockedSets[i]} />
                    <small>mod: {c[k]!=null? statMod(Number(c[k])):"-"}</small>
                  </label>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginTop:6 }}>
                <label>HP<input type="number" value={c.hp} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i], hp:Number(e.target.value)}; return n; })} /></label>
                <label>Max HP<input type="number" value={c.maxHp} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i], maxHp:Number(e.target.value)}; return n; })} /></label>
                <label>Esencja<input type="number" value={c.essence} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i], essence:Number(e.target.value)}; return n; })} /></label>
                <label>Max Esencja<input type="number" value={c.maxEssence} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i], maxEssence:Number(e.target.value)}; return n; })} /></label>
                <label>Pancerz<input type="number" value={c.armor} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i], armor:Number(e.target.value)}; return n; })} /></label>
                <label>Obrona magii<input type="number" value={c.magicDefense} onChange={e=>setSets(prev=>{ const n=[...prev]; n[i]={...n[i], magicDefense:Number(e.target.value)}; return n; })} /></label>
                <div>Akcje: {c.actionsLeft}</div>
                <div>Maska: {c.race==="Faeykai" ? (c.faeykaiMaskBroken? "🔴 pęknięta" : "🟢 sprawna") : "-"}</div>
              </div>

              {/* Zatwierdź / Odpoczynek */}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => lockSet(i)} disabled={lockedSets[i]}>✔️ Zatwierdź</button>
                <button onClick={() => restSet(i)}>💤 Odpocznij</button>
              </div>

              {/* Pasywki rasowe */}
              <RacePassivesPanel c={c} i={i} />

              {/* Podnieś sojusznika (25% max HP) */}
              <div style={{ marginTop: 8 }}>
                <label>Podnieś sojusznika:&nbsp;
                  <select
                    value={c.reviveChoice ?? ""}
                    onChange={(e)=>{
                      const val = e.target.value===""? null : Number(e.target.value);
                      setSets(prev => { const n=[...prev]; n[i] = { ...n[i], reviveChoice: val }; return n; });
                    }}
                  >
                    <option value="">—</option>
                    {sets.map((s, idx)=> (idx!==i && (s.hp||0)<=0) ? <option key={idx} value={idx}>Postać {idx+1}</option> : null)}
                  </select>
                </label>
                <button
                  onClick={()=>{
                    const t = sets[i].reviveChoice;
                    if (t==null) return addLog("❌ Wybierz sojusznika do podniesienia.");
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji.");
                    const heal = Math.floor((sets[t].maxHp||20)*0.25);
                    setSets(prev => {
                      const n=[...prev]; const trg={...n[t]};
                      trg.hp=heal; trg.dwarfHibernating=false; trg.dwarfHibernateTurns=0; trg.dwarfPassiveArmed=false;
                      n[t]=trg; return n;
                    });
                    addLog(`🛡️ P${i+1} podnosi P${t+1} → HP = ${heal}.`);
                  }}
                  disabled={sets[i].reviveChoice==null}
                  style={{ marginLeft: 8 }}
                >
                  🛡️ Podnieś
                </button>
              </div>
            </div>
          ))}

          {/* Test walki (gracz) */}
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <h3>2) Test walki (gracz → wróg)</h3>
            <div style={{ display: "grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              <label>Broń
                <select value={weaponChoice} onChange={e=>setWeaponChoice(e.target.value)}>
                  <option value="sword">Miecz krótki (STR)</option>
                  <option value="bow">Łuk (PER)</option>
                  <option value="staff">Kij magiczny (MAG)</option>
                </select>
              </label>
              <label>Wróg (cel)
                <select value={targetEnemyId || selectedEnemyId || ""} onChange={e=>setTargetEnemyId(e.target.value)}>
                  <option value="">—</option>
                  {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label>Esencja aktywnego
                <input type="number" value={getActiveChar().essence} readOnly />
              </label>
            </div>
            <div style={{ marginTop: 8, display:"flex", gap:8 }}>
              <button onClick={doPlayerAttack}>⚔️ Wykonaj atak</button>
            </div>

            <div style={{ borderTop:"1px solid #eee", marginTop:8, paddingTop:8 }}>
              <h4>Zaklęcia (gracz)</h4>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                <label>Zaklęcie
                  <select value={playerSpell} onChange={e=>setPlayerSpell(e.target.value)}>
                    {Object.keys(PLAYER_SPELLS).map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>Cel leczenia (dla Zasklepienia)
                  <select value={healTarget} onChange={e=>setHealTarget(Number(e.target.value))}>
                    {sets.map((_, idx)=><option key={idx} value={idx}>Postać {idx+1}</option>)}
                  </select>
                </label>
                <label>Obrona magii celu
                  <input type="number" value={(enemies.find(e=>e.id===(targetEnemyId||selectedEnemyId))?.magicDefense)||0} readOnly />
                </label>
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={castPlayerSpell}>✨ Rzuć zaklęcie</button>
              </div>
            </div>
          </div>
        </div>

        {/* ŚRODKOWA KOLUMNA — Wrogowie */}
        <div>
          <h3>3) Wrogowie</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <h4>Konfiguracja</h4>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {Object.keys(enemyTypes).map(typeName => (
                <label key={typeName}>{typeName}:&nbsp;
                  <input
                    type="number"
                    min={0}
                    value={roster[typeName] ?? 0}
                    onChange={(e)=>setRoster(prev=>({ ...prev, [typeName]: Number(e.target.value) }))}
                  />
                </label>
              ))}
            </div>
            <button style={{ marginTop: 8 }} onClick={createEnemies}>➕ Dodaj do walki</button>
          </div>

          {enemies.length===0 ? (
            <p style={{ opacity:.7 }}>Brak aktywnych wrogów — dodaj ich powyżej.</p>
          ) : enemies.map(e => (
            <div key={e.id} style={{ border:"1px solid #ddd", borderRadius:8, padding:8, marginBottom:8, background: (selectedEnemyId===e.id?"#eef":"#fff") }}>
              <label style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input type="radio" name="enemy" checked={selectedEnemyId===e.id} onChange={()=>setSelectedEnemyId(e.id)} />
                <strong>{e.name}</strong>
              </label>
              <div>HP {e.hp}/{e.maxHp} | Esencja {e.essence}/{e.maxEssence} | Akcje: {e.actionsLeft}</div>
              <div>Obrona: {e.defense} | Pancerz: {e.armor} | Obrona magii: {e.magicDefense}</div>
              <div>Efekty: Błogosławieństwo {e.bless?.turnsLeft||0}t (+{e.bless?.value||0}/turę), Klątwa {e.cursed||0}t</div>
            </div>
          ))}
        </div>
        {/* PRAWA KOLUMNA — Atak wroga */}
        <div>
          <h3>4) Atak wroga</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
            <label>Wybrany wróg:&nbsp;
              <select value={selectedEnemyId || ""} onChange={(e)=>setSelectedEnemyId(e.target.value)}>
                <option value="">—</option>
                {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>

            <div style={{ marginTop: 8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <label>Broń
                <select value={enemyWeaponChoice} onChange={(e)=>setEnemyWeaponChoice(e.target.value)}>
                  <option value="sword">Miecz krótki (STR)</option>
                  <option value="bow">Łuk (PER)</option>
                  <option value="staff">Kij magiczny (MAG)</option>
                </select>
              </label>
              <label>Cel → Postać
                <select value={enemyTargetPlayer} onChange={(e)=>setEnemyTargetPlayer(Number(e.target.value))}>
                  {sets.map((_, idx)=> <option key={idx} value={idx}>Postać {idx+1}</option>)}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 6, display:"flex", gap:8 }}>
              <button onClick={()=>{
                const instId = selectedEnemyId;
                if (!instId) return addLog("❌ Wybierz wroga.");
                const inst = enemies.find(e=>e.id===instId);
                if (!inst) return;
                if ((inst.actionsLeft||0) <= 0) return addLog("❌ Wróg nie ma akcji.");

                const targetIndex = enemyTargetPlayer;
                const target = sets[targetIndex];
                const w = weaponData[enemyWeaponChoice];

                const roll20 = d(20);
                const need = (inst.toHit || 0) + (inst.cursed? 3 : 0);
                const hit = roll20 >= need;

                const lines = [
                  `👹 ${inst.name} atakuje (broń: ${w.name}) → Postać ${targetIndex+1}`,
                  `🎯 Trafienie: k20=${roll20} vs próg ${need}${inst.cursed? " (przeklęty +3)":" "}→ ${hit? "✅":"❌"}`
                ];
                if (!hit) { addLog(lines.join("\n")); return; }

                let incoming = d(w.dmgDie);
                lines.push(`💥 Rzut na obrażenia: k${w.dmgDie}=${incoming}`);

                // Hibernacja
                if (target.dwarfHibernating) {
                  lines.push(`🛌 Cel w hibernacji — obrażenia zignorowane.`);
                  // spalenie akcji
                  setEnemies(prev => prev.map(e => e.id===instId ? { ...e, actionsLeft: Math.max(0,(e.actionsLeft||0)-1) } : e));
                  addLog(lines.join("\n"));
                  return;
                }

                // Pancerz
                incoming = Math.max(0, incoming - Number(target.armor||0));
                lines.push(`🛡️ Redukcja: − Pancerz (${target.armor||0}) → ${incoming}`);

                // Tarcza maga (jeśli używasz tarcz)
                if ((target.mageShield||0) > 0 && incoming > 0) {
                  const use = Math.min(target.mageShield, incoming);
                  const reflected = use;
                  incoming = Math.max(0, incoming - use);
                  setSets(prev => {
                    const n=[...prev]; const t={...n[targetIndex]};
                    t.mageShield = Math.max(0, (t.mageShield||0) - use);
                    n[targetIndex]=t; return n;
                  });
                  lines.push(`🔮 Tarcza Maga: −${use}, odbicie ${use} w ${inst.name}`);
                  if (reflected>0) damageEnemyInstance(instId, reflected);
                }

                if (incoming>0) {
                  let triggeredHibernate = false;
                  setSets(prev => {
                    const n=[...prev]; const t={...n[targetIndex]};
                    const before = t.hp||0;
                    t.hp = Math.max(0, before - incoming);

                    // Maska Faeykai
                    if (t.race==="Faeykai") {
                      const thr = Math.ceil((t.maxHp||20) * 0.21);
                      if (!t.faeykaiMaskBroken && t.hp < thr) {
                        t.faeykaiMaskBroken = true;
                        lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)!`);
                      }
                    }

                    // Hibernacja krasnoluda, jeśli uzbrojona i spadliśmy do 0
                    if (t.race==="Krasnolud" && t.dwarfPassiveArmed && before>0 && t.hp<=0) {
                      t.dwarfHibernating = true;
                      t.dwarfHibernateTurns = 2;
                      t.dwarfPassiveArmed = false;
                      triggeredHibernate = true;
                    }

                    n[targetIndex]=t; return n;
                  });
                  lines.push(`❤️ HP Postaci ${targetIndex+1} −${incoming}`);
                  if (triggeredHibernate) lines.push("⛏️ Krasnolud: wchodzi w hibernację na 2 tury.");
                }

                // spal akcję wroga
                setEnemies(prev => prev.map(e => e.id===instId ? { ...e, actionsLeft: Math.max(0,(e.actionsLeft||0)-1) } : e));
                addLog(lines.join("\n"));
              }}>👹 Atak bronią</button>

              {/* Zaklęcia wroga (skrót – 2 najważniejsze) */}
              <button onClick={()=>{
                const instId = selectedEnemyId;
                if (!instId) return addLog("❌ Wybierz wroga.");
                const inst = enemies.find(e=>e.id===instId);
                if (!inst) return;
                if ((inst.actionsLeft||0) <= 0) return addLog("❌ Wróg nie ma akcji.");
                if (!inst.spells?.length) return addLog("❌ Wróg nie ma zaklęć.");

                // prosty wybór: jeśli to Kultysta – „Magiczny pocisk”; jeśli Szpieg – „Wybuch energii”
                const prefer = inst.type==="Szpieg Magmaratora" && inst.spells.includes("Wybuch energii")
                  ? "Wybuch energii"
                  : (inst.spells.includes("Magiczny pocisk") ? "Magiczny pocisk" : inst.spells[0]);

                // koszt
                const costMap = { "Magiczny pocisk":3, "Wybuch energii":5, "Mroczny Pakt":2, "Wyssanie życia":5 };
                const dmgMap  = { "Magiczny pocisk":6, "Wybuch energii":4 };
                const cost = costMap[prefer] ?? 3;

                if ((inst.essence||0) < cost) return addLog(`❌ ${inst.name} ma zbyt mało esencji (${inst.essence}) na ${prefer} (koszt ${cost}).`);

                // spal esencję i akcję
                setEnemies(prev => prev.map(e => e.id===instId ? { ...e, essence: (e.essence||0)-cost, actionsLeft: Math.max(0,(e.actionsLeft||0)-1) } : e));

                // wylicz trafienie
                const roll20 = d(20);
                const need = (inst.toHit||0) + (inst.cursed?3:0);
                const ok = roll20 >= need;

                const playerIdx = enemyTargetPlayer;
                const trg = sets[playerIdx];

                const lines = [
                  `🪄 ${inst.name} rzuca „${prefer}” → P${playerIdx+1}`,
                  `🎯 Trafienie: k20=${roll20} vs próg ${need}${inst.cursed? " (przeklęty +3)" : ""} → ${ok? "✅":"❌"}`
                ];
                if (!ok) { addLog(lines.join("\n")); return; }

                // obrażenia magiczne
                const dmgDie = dmgMap[prefer] || 6;
                let incoming = Math.max(0, d(dmgDie) - Number(trg.magicDefense||0));
                lines.push(`💥 Obrażenia: k${dmgDie} − Obrona magii(${trg.magicDefense||0}) = ${incoming}`);

                // tarcza maga
                if ((trg.mageShield||0) > 0 && incoming > 0) {
                  const use = Math.min(trg.mageShield, incoming);
                  const reflected = use;
                  incoming = Math.max(0, incoming - use);
                  setSets(prev => {
                    const n=[...prev]; const t={...n[playerIdx]};
                    t.mageShield = Math.max(0, (t.mageShield||0) - use);
                    n[playerIdx]=t; return n;
                  });
                  lines.push(`🔮 Tarcza Maga: −${use}, odbicie ${use} w ${inst.name}`);
                  if (reflected>0) damageEnemyInstance(instId, reflected);
                }

                if (incoming>0) {
                  setSets(prev => {
                    const n=[...prev]; const t={...n[playerIdx]};
                    const before = t.hp||0;
                    t.hp = Math.max(0, before - incoming);

                    // Maska Faeykai
                    if (t.race==="Faeykai") {
                      const thr = Math.ceil((t.maxHp||20) * 0.21);
                      if (!t.faeykaiMaskBroken && t.hp < thr) {
                        t.faeykaiMaskBroken = true;
                        lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)!`);
                      }
                    }

                    n[playerIdx]=t; return n;
                  });
                  lines.push(`❤️ HP Postaci ${playerIdx+1} −${incoming}`);
                }

                addLog(lines.join("\n"));
              }}>🪄 Zaklęcie (auto wybór)</button>
            </div>
          </div>
        </div>
      </div>

      {/* LOG */}
      <div style={{ marginTop: 16, background: "#111", color: "#eee", padding: 10, borderRadius: 8, maxHeight: 260, overflow: "auto", fontSize: 13 }}>
        {log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

