import React, { useState } from "react";

/* ===== Pomocnicze ===== */
const d = (s) => Math.floor(Math.random() * s) + 1;
const statMod = (v) => {
  if (v == null) return 0;
  if (v <= 1) return 0;
  if (v <= 4) return 1;
  if (v <= 7) return 2;
  if (v <= 10) return 3;
  return 4;
};

/* ===== Broń ===== */
const weaponData = {
  sword: { name: "Miecz krótki", stat: "STR", dmgDie: 6 },
  bow:   { name: "Łuk",          stat: "PER", dmgDie: 6 },
  staff: { name: "Kij magiczny", stat: "MAG", dmgDie: 4 },
  // jeśli zapragniesz muszkietu dla Strzelca:
  // musket: { name: "Muszkiet", stat: "PER", dmgDie: 8 },
};

/* ===== Typy wrogów (baza) ===== */
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

const makeChar = () => ({
  name: "",
  race: "Człowiek",
  clazz: "Wojownik",

  STR: null, DEX: null, PER: null, MAG: null, CHA: null,
  armor: 0, magicDefense: 0,

  hp: 20, maxHp: 20,
  essence: 20, maxEssence: 20,

  actionsLeft: 2,

  // Rasowe: Człowiek
  humanCharges: [false, false, false, false, false],
  humanBuff: null,
  humanPendingChoice: "dmg",

  // Rasowe: Elf
  elfChargeUsed: false,
  elfChargedTurn: null,

  // Rasowe: Krasnolud
  dwarfPassiveArmed: false,
  dwarfHibernating: false,
  dwarfHibernateTurns: 0,

  // Rasowe: Faeykai
  faeykaiChargesLeft: 3,      // błogosławieństwo/przekleństwo (3/odpoczynek)
  faeykaiMaskBroken: false,   // czy maska pękła
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

/* ===== Komponent ===== */
export default function BattleSimulator() {
  /* ---------- Stan: cztery postacie ---------- */
  const [sets, setSets] = useState([makeChar(), makeChar(), makeChar(), makeChar()]);
  const [lockedSets, setLockedSets] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  /* ---------- Tura, log ---------- */
  const [turn, setTurn] = useState(1);
  const [log, setLog] = useState([]);
  const addLog = (line) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`[${stamp}] ${line}`, ...prev]);
  };

  /* ---------- Wrogowie ---------- */
  const [roster, setRoster] = useState({ "Elfi Kultysta": 1, "Szpieg Magmaratora": 0 });
  const [enemies, setEnemies] = useState([]);           // instancje
  const [selectedEnemyId, setSelectedEnemyId] = useState(null);
  const [enemyWeaponChoice, setEnemyWeaponChoice] = useState("sword");
  const [enemyTargetPlayer, setEnemyTargetPlayer] = useState(0);

  /* ---------- Dyplomata (wymuszenie) ---------- */
  const [forcedOrders, setForcedOrders] = useState({}); // { instId: { kind:'player'|'enemy', target:<idx|id> } }

  /* ---------- Helpers ---------- */
  const getActiveChar = () => sets[activeSet] || makeChar();

  const lockSet = (i) => {
    const s = sets[i];
    const statsOk = ["STR","DEX","PER","MAG","CHA"].every(k => s[k] != null && s[k] !== "");
    if (!statsOk) return addLog(`❌ Postać ${i+1}: uzupełnij wszystkie statystyki.`);
    setLockedSets(prev => { const n=[...prev]; n[i]=true; return n; });
    addLog(`✔️ Postać ${i+1} (${s.name||`Postać ${i+1}`}) została zatwierdzona.`);
  };

  const spendPlayerAction = (i) => {
    let ok = false;
    setSets(prev => {
      const n=[...prev]; const c={...n[i]};
      if ((c.actionsLeft||0)>0){ c.actionsLeft -= 1; ok = true; }
      n[i]=c; return n;
    });
    return ok;
  };

  const damageEnemyInstance = (id, amount) => {
    if (amount<=0) return;
    setEnemies(prev => prev.map(e => e.id===id ? { ...e, hp: Math.max(0, e.hp - amount) } : e));
  };

  const effectiveEnemyDefense = (e) => {
    const deb = e.defDown?.turnsLeft > 0 ? (e.defDown.amount || 0) : 0;
    return Math.max(0, (e.defense||0) - deb);
  };

  const effectiveEnemyArmor = (e) => {
    const halved = (e.armorHalvedTurns || 0) > 0;
    const base = Number(e.armor||0);
    return halved ? Math.max(0, Math.floor(base * 0.5)) : base;
  };

  const restSet = (i) => {
    setSets((prev) => {
      const n = [...prev];
      const c = { ...n[i] };

      c.hp = c.maxHp;
      c.essence = c.maxEssence;
      c.actionsLeft = 2;

      // reset rasowych
      c.humanCharges = [false, false, false, false, false];
      c.humanBuff = null;
      c.elfChargeUsed = false;
      c.elfChargedTurn = null;
      c.dwarfPassiveArmed = false;
      c.dwarfHibernating = false;
      c.dwarfHibernateTurns = 0;
      c.faeykaiChargesLeft = 3;
      c.faeykaiPending = null;
      c.faeykaiMaskBroken = false;   // maska wraca
      c.effects = [];

      // reset klasowych
      c.classUsed = false;
      c.warriorReady = false;
      c.archerReady = false;
      c.shooterReady = false;
      c.mageReady = false;
      c.mageShield = 0;

      n[i] = c;
      return n;
    });
    addLog(`💤 Postać ${i + 1} odpoczęła i odnowiła zasoby (w tym maskę Faeykai oraz ładunki rasowe).`);
  };

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
          bless: null,       // { value, turnsLeft }
          cursed: 0,         // tury kary do trafienia (+3 do progu)
          defDown: null,     // { amount:5, turnsLeft:3 }
          armorHalvedTurns: 0,
          tempToHitBuff: 0,  // z Mrocznego Paktu (+4 1 tura)
        });
      }
    });
    setEnemies(list);
    setSelectedEnemyId(list[0]?.id || null);
    addLog(`👥 Dodano do walki wrogów: ${list.length} szt.`);
  };
  /* ===================== Panel pasywek rasowych ===================== */
  const RacePassivesPanel = ({ c, i }) => (
    <div style={{ marginTop: 10, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
      {/* LUDZIE */}
      {c.race === "Człowiek" && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Ludzka wytrwałość (5×/odp.):</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {c.humanCharges.map((used, idx) => {
              const isPending = c.humanPendingIdx === idx && !used;
              return (
                <div
                  key={idx}
                  onClick={()=>{
                    if (used) return;
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Ludzie).");
                    setSets(prev => { const n=[...prev]; n[i] = { ...n[i], humanPendingIdx: idx }; return n; });
                  }}
                  title={used ? "Zużyte" : "Kliknij (zużywa 1 akcję)"}
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
                        me.humanBuff = { type: choice, expiresTurn: turn }; // wygasa po turze
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
          <small style={{ opacity: .7 }}>Efekt nie stackuje się; wygasa po tej turze (HP – natychmiast).</small>
        </div>
      )}

      {/* ELF */}
      {c.race === "Elf" && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Elfie naładowanie (1×/odp.):</div>
          <div
            onClick={()=>{
              if (c.elfChargeUsed) return;
              if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Elf).");
              setSets(prev=>{
                const n=[...prev]; const me={...n[i]};
                me.elfChargeUsed = true; me.elfChargedTurn = turn;
                n[i]=me; return n;
              });
              addLog(`🌩️ P${i+1} (Elf) ładuje eksplozję — wybuch w następnej turze (elf −5 HP; wrogowie −10 HP i ogłuszenie 1 turę).`);
            }}
            title={c.elfChargeUsed ? "Zużyte do odpoczynku" : "Kliknij (zużywa 1 akcję)"}
            style={{
              width: 18, height: 18,
              background: c.elfChargeUsed ? "#c62828" : "#2e7d32",
              borderRadius: 3, cursor: c.elfChargeUsed ? "not-allowed" : "pointer",
              border: "1px solid #0004"
            }}
          />
        </div>
      )}

      {/* KRASNOLUD */}
      {c.race === "Krasnolud" && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Krasnoludzka hibernacja:</div>
          <button
            onClick={()=>{
              if (c.dwarfPassiveArmed) return;
              if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Krasnolud).");
              setSets(prev=>{
                const n=[...prev]; n[i] = { ...n[i], dwarfPassiveArmed: true }; return n;
              });
              addLog(`⛏️ P${i+1} uzbraja hibernację (po spadku do 0 HP: hibernacja 2 tury — niewrażliwy, możliwy do podniesienia).`);
            }}
            disabled={c.dwarfPassiveArmed}
          >
            {c.dwarfPassiveArmed ? "Uzbrojone" : "Uzbrój (1 akcja)"}
          </button>
        </div>
      )}

      {/* FAEYKAI — maska (−3 po pęknięciu) + 3× błog./klątwa */}
      {c.race === "Faeykai" && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems:"center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>Faeykai (3×/odp.):</div>
            <div>Maska: {c.faeykaiMaskBroken ? "🔴 pęknięta (−3 do trafienia czarami)" : "🟢 sprawna"} <small style={{opacity:.7}}>(pęka &lt;21% max HP; odnawia się przy odpoczynku)</small></div>
          </div>

          {/* 3 ładunki */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {Array.from({ length: 3 }).map((_, idx) => {
              const used = idx >= (3 - (c.faeykaiChargesLeft || 0));
              return (
                <div
                  key={idx}
                  onClick={()=>{
                    if (used) return;
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Faeykai).");
                    setSets(prev=>{
                      const n=[...prev]; const me={...n[i]};
                      me.faeykaiPending = { mode:"bless", targetKind:"player", playerIndex:0, enemyId:"" };
                      n[i]=me; return n;
                    });
                  }}
                  title={used ? "Zużyte" : "Kliknij (zużywa 1 akcję)"}
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
                  <option value="bless">Błogosławieństwo (+3 HP/ turę przez 3 tury)</option>
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
                    {sets.map((_, idx)=><option key={idx} value={idx}>Postać {idx+1}</option>)}
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
                    const p = c.faeykaiPending; if (!p) return;
                    // zużyj ładunek
                    setSets(prev=>{
                      const n=[...prev]; const me={...n[i]};
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
                        addLog(`🌱 Faeykai P${i+1} błogosławi P${(p.playerIndex)+1}: +3 HP/ turę (3 tury).`);
                      } else {
                        setEnemies(prev => prev.map(e => e.id===p.enemyId ? { ...e, bless:{ value:3, turnsLeft:3 } } : e));
                        addLog(`🌱 Faeykai P${i+1} błogosławi ${p.enemyId}: +3 HP/ turę (3 tury).`);
                      }
                    } else {
                      if (p.targetKind==="player") {
                        setSets(prev=>{
                          const n=[...prev]; const trg={...n[p.playerIndex]};
                          trg.effects = [ ...(trg.effects||[]), { type:"curseToHit", value:3, turnsLeft:3 } ];
                          n[p.playerIndex] = trg; return n;
                        });
                        addLog(`🌑 Faeykai P${i+1} przeklina P${(p.playerIndex)+1}: −3 do trafienia (3 tury).`);
                      } else {
                        setEnemies(prev => prev.map(e => e.id===p.enemyId ? { ...e, cursed: Math.max(e.cursed||0, 3) } : e));
                        addLog(`🌑 Faeykai P${i+1} przeklina ${p.enemyId}: +3 do progu trafienia (3 tury).`);
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

  /* ===================== Przejście tury ===================== */
  const nextTurn = () => {
    // gracze
    setSets(prev => prev.map((c, idx) => {
      const me = { ...c, actionsLeft: 2 };

      // wygaszenie ludzkiego buffa na końcu tury
      if (me.humanBuff && me.humanBuff.expiresTurn < turn + 1) me.humanBuff = null;

      // efekty: bless/curseToHit/buffToHit
      if (me.effects?.length) {
        me.effects = me.effects
          .map(ef => {
            if (ef.type==="bless" && ef.turnsLeft>0) {
              me.hp = Math.min(me.maxHp||20, (me.hp||0) + (ef.value||0));
            }
            return { ...ef, turnsLeft: (ef.turnsLeft||0) - 1 };
          })
          .filter(ef => ef.turnsLeft>0);
      }

      // Elf – eksplozja po 1 turze
      if (me.race === "Elf" && me.elfChargeUsed && me.elfChargedTurn === turn) {
        const before = me.hp||0;
        me.hp = Math.max(0, before - 5);
        addLog(`🌩️ Elf (P${idx+1}) — eksplozja: elf −5 HP; wrogowie −10 HP (ogłuszenie 1 turę).`);
        setEnemies(prevE => prevE.map(e => ({ ...e, hp: Math.max(0, e.hp - 10) })));
        me.elfChargeUsed = false; me.elfChargedTurn = null;
      }

      // Faeykai – maska pęka <21% max HP (kara do czarów −3)
      if (me.race === "Faeykai") {
        const thr = Math.ceil((me.maxHp||20) * 0.21);
        if ((me.hp||0) < thr) me.faeykaiMaskBroken = true;
      }

      return me;
    }));

    // wrogowie
    setEnemies(prev => prev.map(e => {
      // bless
      let hp = e.hp;
      let bless = e.bless;
      if (bless?.turnsLeft > 0) {
        hp = Math.min(e.maxHp, hp + (bless.value || 0));
        bless = { ...bless, turnsLeft: bless.turnsLeft - 1 };
      } else bless = null;

      // cursed
      const cursed = Math.max(0, (e.cursed||0) - 1);

      // defDown & armorHalved
      let defDown = e.defDown;
      if (defDown?.turnsLeft > 0) defDown = { ...defDown, turnsLeft: defDown.turnsLeft - 1 };
      else defDown = null;

      const armorHalvedTurns = Math.max(0, (e.armorHalvedTurns||0) - 1);

      // tymczasowy buff do trafienia z Mrocznego Paktu — 1 tura
      const tempToHitBuff = Math.max(0, (e.tempToHitBuff||0) - 1);
      const toHit = (enemyTypes[e.type]?.toHit || e.toHit || 0) + (tempToHitBuff>0 ? 4 : 0);

      return { ...e, actionsLeft: 2, hp, bless, cursed, defDown, armorHalvedTurns, tempToHitBuff, toHit };
    }));

    setTurn(t => t+1);
    addLog(`⏱️ Rozpoczyna się tura ${turn + 1}.`);
  };

  /* ===================== Atak gracza (broń) — z klasami ===================== */
  const [weaponChoice, setWeaponChoice] = useState("sword");
  const [targetEnemyId, setTargetEnemyId] = useState(null);

  const doPlayerAttack = () => {
    const i = activeSet;
    if (!lockedSets[i]) return addLog("❌ Najpierw zatwierdź postać.");
    const c = getActiveChar();
    if ((c.actionsLeft||0) <= 0) return addLog("❌ Brak akcji.");

    const enemyId = targetEnemyId || selectedEnemyId;
    const enemy = enemies.find(e => e.id===enemyId);
    if (!enemy) return addLog("❌ Wybierz wroga.");

    const w = weaponData[weaponChoice];
    const statVal = Number(c[w.stat]||0);
    const humanToHit = (c.race==="Człowiek" && c.humanBuff?.type==="tohit") ? 2 : 0;

    const effDEF = effectiveEnemyDefense(enemy);
    const roll20 = d(20);

    // Łucznik (celny strzał): auto-hit, -5 DEF na 3 tury (tylko łuk)
    const archerAuto = (c.clazz==="Łucznik" && c.archerReady && weaponChoice==="bow");
    const toHit = archerAuto ? Infinity : (roll20 + statVal + humanToHit);
    const hit = toHit >= effDEF;

    const lines = [
      `⚔️ P${i+1} atakuje (${w.name}) → ${enemy.name}`,
      archerAuto
        ? `🎯 Celny strzał (Łucznik): trafienie automatyczne`
        : `🎯 Trafienie: k20=${roll20} + ${w.stat}(${statVal})${humanToHit? " + human(+2)": ""} = ${toHit} vs Obrona ${effDEF} → ${hit? "✅":"❌"}`
    ];

    if (!hit) { addLog(lines.join("\n")); return; }

    // Obrażenia
    let dmgDie = d(w.dmgDie);
    let ignoreArmor = false;

    // Wojownik: cios krytyczny → maks. kość, ignoruje pancerz
    if (c.clazz==="Wojownik" && c.warriorReady) {
      dmgDie = w.dmgDie; // maksymalna wartość kości
      ignoreArmor = true;
    }

    const humanDmg = (c.race==="Człowiek" && c.humanBuff?.type==="dmg") ? 2 : 0;
    const raw = dmgDie + humanDmg;
    const effArmor = ignoreArmor ? 0 : effectiveEnemyArmor(enemy);
    const dealt = Math.max(0, raw - effArmor);

    lines.push(`🗡️ Obrażenia: ${ignoreArmor? "(ignoruje pancerz) ":""}k${w.dmgDie}=${dmgDie}${humanDmg? " + human(+2)": ""} = ${raw} − Pancerz(${effArmor}) = ${dealt}`);

    // Strzelec: po trafieniu → -50% pancerza na 3 tury
    if (c.clazz==="Strzelec" && c.shooterReady) {
      setEnemies(prev => prev.map(e => e.id===enemy.id ? { ...e, armorHalvedTurns: 3 } : e));
      lines.push(`🔻 Strzelec: pancerz ${enemy.name} −50% na 3 tury.`);
    }

    // Łucznik: po trafieniu → -5 DEF na 3 tury
    if (archerAuto || (c.clazz==="Łucznik" && c.archerReady)) {
      setEnemies(prev => prev.map(e => e.id===enemy.id ? { ...e, defDown: { amount:5, turnsLeft:3 } } : e));
      lines.push(`📉 Łucznik: obrona ${enemy.name} −5 na 3 tury.`);
    }

    // zużyj przygotowanie (one-shot / odpoczynek)
    if (c.clazz==="Wojownik" && c.warriorReady) {
      setSets(prev=>{ const n=[...prev]; n[i]={...n[i], warriorReady:false}; return n; });
    }
    if (c.clazz==="Łucznik" && c.archerReady) {
      setSets(prev=>{ const n=[...prev]; n[i]={...n[i], archerReady:false}; return n; });
    }
    if (c.clazz==="Strzelec" && c.shooterReady) {
      setSets(prev=>{ const n=[...prev]; n[i]={...n[i], shooterReady:false}; return n; });
    }

    spendPlayerAction(i);
    addLog(lines.join("\n"));
    damageEnemyInstance(enemy.id, dealt);
  };

  /* ===================== Zaklęcia gracza (z maską −3 i klasą Maga) ===================== */
const PLAYER_SPELLS = {
  "Magiczny pocisk": { cost: 3, dmgDie: 6, type: "damage" },
  "Wybuch energii":  { cost: 5, dmgDie: 4, type: "damage" },
  "Zasklepienie ran":{ cost: 5, healDie: 6, type: "heal" },
  "Oślepienie":      { cost: 8, type: "effect" },
};
const [playerSpell, setPlayerSpell] = useState("Magiczny pocisk");
const [healTarget, setHealTarget] = useState(0);

const castPlayerSpell = () => {
  const i = activeSet;
  if (!lockedSets[i]) return addLog("❌ Najpierw zatwierdź postać.");
  const c = getActiveChar();
  if ((c.actionsLeft||0) <= 0) return addLog("❌ Brak akcji.");

  const spell = PLAYER_SPELLS[playerSpell];
  if (!spell) return;
  if ((c.essence||0) < spell.cost) return addLog(`❌ Esencja: ${c.essence} < koszt ${spell.cost}.`);

  // pobierz koszt + akcję
  setSets(prev => { const n=[...prev]; n[i] = { ...n[i], essence: (n[i].essence||0) - spell.cost }; return n; });
  spendPlayerAction(i);

  let lines = [`✨ P${i+1} rzuca „${playerSpell}” — koszt ${spell.cost} (Esencja po: ${(c.essence||0)-spell.cost})`];

  // Leczenie
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

  // Efekt/Obrażenia → potrzebny wróg
  const enemyId = targetEnemyId || selectedEnemyId;
  const enemy = enemies.find(e => e.id===enemyId);
  if (!enemy) return addLog("❌ Wybierz wroga.");

  const MAG = Number(c.MAG||0);
  const humanToHit = (c.race==="Człowiek" && c.humanBuff?.type==="tohit") ? 2 : 0;
  const maskPenalty = (c.race==="Faeykai" && c.faeykaiMaskBroken) ? 3 : 0;
  const toHitPenaltyFromCurses = (c.effects||[]).reduce((acc,ef)=> ef.type==="curseToHit" ? acc + (ef.value||0) : acc, 0);

  const effDEF = effectiveEnemyDefense(enemy);
  const roll20 = d(20);
  const toHit = roll20 + MAG + humanToHit - maskPenalty - toHitPenaltyFromCurses;
  const hit = toHit >= effDEF;

  lines.push(
    `🎯 Trafienie: k20=${roll20} + MAG(${MAG})` +
    (humanToHit? " + human(+2)": "") +
    (maskPenalty? ` − maska(−${maskPenalty})`:"") +
    (toHitPenaltyFromCurses? ` − klątwy(−${toHitPenaltyFromCurses})`:"") +
    ` = ${toHit} vs Obrona ${effDEF} → ${hit? "✅":"❌"}`
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

    // Mag: tarcza = 50% zadanych obrażeń (po udanym czarze)
    if (c.clazz==="Mag" && c.mageReady && reduced>0) {
      const shield = Math.ceil(reduced * 0.5);
      setSets(prev=>{ const n=[...prev]; n[i]={...n[i], mageShield: shield, mageReady:false}; return n; });
      addLog(`🛡️🔮 P${i+1} (Mag): tarcza ustawiona na ${shield}.`);
    }
    return;
  }

  // Oślepienie — placeholder
  if (spell.type==="effect") {
    lines.push("🌑 Oślepienie: efekt do rozbudowy (statusy).");
    return addLog(lines.join("\n"));
  }
};

/* ===================== Funkcje ataków wroga ===================== */
 const doEnemyAttackWeapon = (enemyId, weaponKey, targetPlayerIndex) => {
  setEnemies(prev => {
    const n = [...prev];
    const e = n.find(x => x.id === enemyId);
    if (!e) return prev;

    const weapon = weaponData[weaponKey];
    const roll20 = d(20);
    const target = sets[targetPlayerIndex];
    const effDefense = target ? target.armor + 10 : 10;
    const toHit = roll20 + statMod(e[weapon.stat] || 0);

    const lines = [];
    lines.push(`🎯 Wróg ${e.name} atakuje ${target?.name || `Postać ${targetPlayerIndex+1}`} bronią ${weapon.name}`);
    lines.push(`   Trafienie: k20=${roll20} + mod = ${toHit} vs Obrona ${effDefense}`);

    if (toHit >= effDefense) {
      const dmgRoll = d(weapon.dmgDie);
      const dmg = Math.max(0, dmgRoll - target.armor);
      lines.push(`   Obrażenia: k${weapon.dmgDie}=${dmgRoll} - Pancerz(${target.armor}) = ${dmg}`);

      setSets(prevSets => {
        const s = [...prevSets];
        const t = { ...s[targetPlayerIndex] };
        const beforeHp = t.hp || 0;
        t.hp = Math.max(0, beforeHp - dmg);

        // 🔹 Sprawdzenie pęknięcia maski Faeykai
        if (t.race === "Faeykai") {
          const thr = Math.ceil((t.maxHp || 20) * 0.21);
          if (!t.faeykaiMaskBroken && t.hp < thr) {
            t.faeykaiMaskBroken = true;
            lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)! (−3 do trafienia czarami)`);
          }
        }

        s[targetPlayerIndex] = t;
        return s;
      });
    } else {
      lines.push(`❌ Pudło!`);
    }

    addLog(lines.join("\n"));
    return n;
  });
};

const doEnemySpellAuto = (enemyId, spellName, targetPlayerIndex) => {
  setEnemies(prev => {
    const n = [...prev];
    const e = n.find(x => x.id === enemyId);
    if (!e) return prev;

    const lines = [];
    lines.push(`🪄 Wróg ${e.name} rzuca zaklęcie ${spellName}`);

    if (spellName === "Mroczny Pakt") {
      if (e.essence < 2) { lines.push("❌ Brak esencji"); return n; }
      e.essence -= 2;
      setSets(prevSets => {
        const s = [...prevSets];
        const t = { ...s[targetPlayerIndex] };
        t.hp = Math.max(0, t.hp - 4);
        
        // 🔹 Faeykai mask check
        if (t.race === "Faeykai") {
          const thr = Math.ceil((t.maxHp || 20) * 0.21);
          if (!t.faeykaiMaskBroken && t.hp < thr) {
            t.faeykaiMaskBroken = true;
            lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)! (−3 do trafienia czarami)`);
          }
        }

        s[targetPlayerIndex] = t;
        return s;
      });
      e.toHit += 4;
      lines.push(`   Cel traci 4 HP, ${e.name} zyskuje +4 do trafienia.`);
    }

    if (spellName === "Wyssanie życia") {
      if (e.essence < 5) { lines.push("❌ Brak esencji"); return n; }
      e.essence -= 5;
      setSets(prevSets => {
        const s = [...prevSets];
        const t = { ...s[targetPlayerIndex] };
        t.hp = Math.max(0, t.hp - 5);

        // 🔹 Faeykai mask check
        if (t.race === "Faeykai") {
          const thr = Math.ceil((t.maxHp || 20) * 0.21);
          if (!t.faeykaiMaskBroken && t.hp < thr) {
            t.faeykaiMaskBroken = true;
            lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)! (−3 do trafienia czarami)`);
          }
        }

        s[targetPlayerIndex] = t;
        return s;
      });
      e.hp = Math.min(e.maxHp, e.hp + 5);
      lines.push(`   Cel traci 5 HP, ${e.name} odzyskuje 5 HP.`);
    }

    if (spellName === "Magiczny pocisk") {
      if (e.essence < 3) { lines.push("❌ Brak esencji"); return n; }
      e.essence -= 3;
      const dmgRoll = d(6);
      setSets(prevSets => {
        const s = [...prevSets];
        const t = { ...s[targetPlayerIndex] };
        t.hp = Math.max(0, t.hp - dmgRoll);

        // 🔹 Faeykai mask check
        if (t.race === "Faeykai") {
          const thr = Math.ceil((t.maxHp || 20) * 0.21);
          if (!t.faeykaiMaskBroken && t.hp < thr) {
            t.faeykaiMaskBroken = true;
            lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)! (−3 do trafienia czarami)`);
          }
        }

        s[targetPlayerIndex] = t;
        return s;
      });
      lines.push(`   Magiczny pocisk trafia za ${dmgRoll} obrażeń.`);
    }

    addLog(lines.join("\n"));
    return n;
  });
};

const doSpyAOE = (enemyId, targetPlayerIndices) => {
  setEnemies(prev => {
    const n = [...prev];
    const e = n.find(x => x.id === enemyId);
    if (!e) return prev;

    const lines = [];
    lines.push(`💥 Szpieg ${e.name} rzuca Wybuch Energii!`);

    if (e.essence < 5) { lines.push("❌ Brak esencji"); return n; }
    e.essence -= 5;

    targetPlayerIndices.forEach(idx => {
      const dmgRoll = d(4);
      setSets(prevSets => {
        const s = [...prevSets];
        const t = { ...s[idx] };
        const beforeHp = t.hp || 0;
        t.hp = Math.max(0, beforeHp - dmgRoll);

        // 🔹 Faeykai mask check
        if (t.race === "Faeykai") {
          const thr = Math.ceil((t.maxHp || 20) * 0.21);
          if (!t.faeykaiMaskBroken && t.hp < thr) {
            t.faeykaiMaskBroken = true;
            lines.push(`😱 Maska Faeykai pękła przy ${t.hp} HP (<21% max)! (−3 do trafienia czarami)`);
          }
        }

        s[idx] = t;
        return s;
      });
      lines.push(`   Postać ${idx+1} otrzymuje ${dmgRoll} obrażeń.`);
    });

    addLog(lines.join("\n"));
    return n;
  });
};

  /* ===================== JSX: Layout główny ===================== */
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>🕒 Tura: {turn}</h2>
        <button onClick={nextTurn}>➡️ Następna tura</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
        {/* LEWA: Postacie + Test walki */}
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
                <div>Maska: {c.race==="Faeykai" ? (c.faeykaiMaskBroken? "🔴 pęknięta (−3)" : "🟢 sprawna") : "-"}</div>
              </div>

              {/* Klasy: przyciski przygotowania */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                {c.clazz === "Wojownik" && !c.classUsed && (
                  <button onClick={() => {
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Wojownik).");
                    setSets(prev => { const n=[...prev]; n[i] = { ...n[i], warriorReady: true, classUsed: true }; return n; });
                    addLog(`⚔️ ${c.name || `P${i+1}`} przygotowuje cios krytyczny.`);
                  }}>Wojownik: Cios krytyczny</button>
                )}
                {c.clazz === "Łucznik" && !c.classUsed && (
                  <button onClick={() => {
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Łucznik).");
                    setSets(prev => { const n=[...prev]; n[i] = { ...n[i], archerReady: true, classUsed: true }; return n; });
                    addLog(`🏹 ${c.name || `P${i+1}`} przygotowuje celny strzał.`);
                  }}>Łucznik: Celny strzał</button>
                )}
                {c.clazz === "Strzelec" && !c.classUsed && (
                  <button onClick={() => {
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Strzelec).");
                    setSets(prev => { const n=[...prev]; n[i] = { ...n[i], shooterReady: true, classUsed: true }; return n; });
                    addLog(`🔫 ${c.name || `P${i+1}`} przygotowuje druzgocący strzał.`);
                  }}>Strzelec: Druzgocący strzał</button>
                )}
                {c.clazz === "Mag" && !c.classUsed && (
                  <button onClick={() => {
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji (Mag).");
                    setSets(prev => { const n=[...prev]; n[i] = { ...n[i], mageReady: true, classUsed: true }; return n; });
                    addLog(`🪄 ${c.name || `P${i+1}`} przygotowuje tarczę po najbliższym czarze.`);
                  }}>Mag: Tarcza po czarze</button>
                )}
              </div>

              {/* Dyplomata: wymuszenie ataku wroga na gracza */}
              {c.clazz === "Dyplomata" && !c.classUsed && (
                <div style={{ marginTop: 8, border: "1px dashed #aaa", padding: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Dyplomata: Zmuszenie wroga do ataku</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    <label>Wróg do zmuszenia
                      <select id={`dip-src-${i}`}>
                        <option value="">—</option>
                        {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </label>
                    <label>Cel (gracz)
                      <select id={`dip-tgtp-${i}`}>
                        {sets.map((_, idx)=> <option key={idx} value={idx}>Postać {idx+1}</option>)}
                      </select>
                    </label>
                  </div>
                  <button
                    onClick={()=>{
                      const srcSel = document.getElementById(`dip-src-${i}`);
                      const tgtSel = document.getElementById(`dip-tgtp-${i}`);
                      const instId = srcSel?.value || "";
                      const playerIdx = Number(tgtSel?.value || 0);

                      if (!instId) return addLog("❌ Wybierz wroga do zmuszenia.");
                      // test charyzmy: d20 + CHA >= 10
                      const roll = d(20);
                      const CHA = Number(c.CHA||0);
                      const ok = (roll + CHA) >= 10;

                      const lines = [
                        `🗣️ P${i+1} (Dyplomata) próbuje zmusić ${instId} do ataku na P${playerIdx+1}`,
                        `🎲 Test CHARYZMY: k20=${roll} + CHA(${CHA}) = ${roll+CHA} vs 10 → ${ok? "✅":"❌"}`
                      ];

                      if (!ok) { addLog(lines.join("\n")); return; }

                      setForcedOrders(prev => ({ ...prev, [instId]: { kind:"player", target: playerIdx } }));
                      setSets(prev => { const n=[...prev]; n[i]={...n[i], classUsed:true}; return n; });
                      lines.push(`📜 Rozkaz zapisany: ${instId} ma zaatakować P${playerIdx+1} przy swojej akcji.`);
                      addLog(lines.join("\n"));
                    }}
                  >
                    Zastosuj rozkaz (zużywa 1 użycie klasy)
                  </button>
                </div>
              )}

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
                <label>Cel leczenia (Zasklepienie)
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

        {/* ŚRODEK: Wrogowie */}
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
              <div>Obrona: {effectiveEnemyDefense(e)} (bazowo {e.defense}) | Pancerz: {effectiveEnemyArmor(e)} (bazowo {e.armor}) | Obrona magii: {e.magicDefense}</div>
              <div>Efekty: Bless {e.bless?.turnsLeft||0}t (+{e.bless?.value||0}/turę), Curse {e.cursed||0}t, DEF↓ {e.defDown?.turnsLeft||0}t, Armor½ {e.armorHalvedTurns||0}t</div>
            </div>
          ))}
        </div>

        {/* PRAWA: Atak / Zaklęcie wroga */}
        <div>
          <h3>4) Akcje wroga</h3>
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

            <div style={{ marginTop: 6, display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>{
                const instId = selectedEnemyId;
                if (!instId) return addLog("❌ Wybierz wroga.");
                doEnemyAttackWeapon(instId, enemyTargetPlayer);
              }}>👹 Atak bronią</button>

              <button onClick={()=>{
                const instId = selectedEnemyId;
                if (!instId) return addLog("❌ Wybierz wroga.");
                doEnemySpellAuto(instId, enemyTargetPlayer);
              }}>🪄 Zaklęcie (auto)</button>

              {/* AOE dla Szpiega Magmaratora */}
              <button onClick={()=>{
                const instId = selectedEnemyId;
                const inst = enemies.find(e=>e.id===instId);
                if (!inst) return addLog("❌ Wybierz wroga.");
                if (!inst.spells?.includes("Wybuch energii")) return addLog("❌ Wróg nie zna Wybuchu energii.");
                doSpyAOE(instId);
              }}>🧨 Wybuch energii (AOE)</button>
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


