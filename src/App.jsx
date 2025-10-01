import React, { useState } from "react";

/* ================== Helpers ================== */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const d = (sides) => Math.floor(Math.random() * sides) + 1;

function statMod(value) {
  if (value <= 1) return 0;
  if (value <= 4) return 1;
  if (value <= 7) return 2;
  if (value <= 10) return 3;
  return 4;
}

/* ================== Bronie (wspólne) ================== */
const weaponData = {
  sword:  { name: "Miecz krótki", stat: "STR", dmgDie: 6, type: "physical" },
  bow:    { name: "Łuk",          stat: "PER", dmgDie: 6, type: "physical" },
  musket: { name: "Muszkiet",     stat: "PER", dmgDie: 6, type: "physical" },
  staff:  { name: "Kij magiczny", stat: "MAG", dmgDie: 4, type: "physical" },
};

/* ================== Gracze: rasy/klasy ================== */
const RACES   = ["Człowiek", "Elf", "Krasnolud", "Faeykai"];
const CLASSES = ["Wojownik", "Łucznik", "Strzelec", "Mag", "Dyplomata"];

/* ================== Zaklęcia gracza ================== */
const PLAYER_SPELLS = {
  "Magiczny pocisk": { key: "missile", cost: 3, dmgDie: 6, needsToHit: true,  type: "damage" },
  "Wybuch energii":  { key: "burst",   cost: 5, dmgDie: 4, needsToHit: true,  type: "damage" },
  "Zasklepienie ran":{ key: "heal",    cost: 5, healDie: 6, needsToHit: false, type: "heal" },
  "Oślepienie":      { key: "blind",   cost: 8, needsToHit: false, type: "effect" },
};

/* ================== Typy wrogów (definicje + ich zaklęcia) ================== */
const ENEMY_TYPES = {
  cultist_elf: {
    id: "cultist_elf",
    label: "Elfi Kultysta",
    base: {
      maxHp: 45, hp: 45,
      maxEss: 20, essence: 20,
      armor: 4, magicDefense: 4,
      toHit: 8, defense: 10,
      actionsLeft: 2
    },
    spells: {
      "Mroczny Pakt":   { key: "pact",   cost: 2, type: "special", desc: "Cel −4 HP i +4 Trafienie (dla celu)" },
      "Wyssanie życia": { key: "drain",  cost: 5, type: "drain", dmg: 5, heal: 5 },
      "Magiczny pocisk":{ key: "missile",cost: 3, type: "damage", dmgDie: 6, target: "player" },
    },
    weapons: ["sword","bow","musket","staff"]
  },
  magmar_spy: {
    id: "magmar_spy",
    label: "Szpieg Magmaratora",
    base: {
      maxHp: 30, hp: 30,
      maxEss: 20, essence: 20,
      armor: 2, magicDefense: 2,
      toHit: 10, defense: 8,
      actionsLeft: 2
    },
    spells: {
      "Magiczny pocisk": { key: "missile", cost: 3, type: "damage", dmgDie: 6, target: "player" },
      "Wybuch energii":  { key: "burst",   cost: 5, type: "aoe",    dmgDie: 4, target: "players" },
    },
    weapons: ["sword","bow","musket","staff"]
  }
};

/* ================== Komponent ================== */
export default function BattleSimulator() {
  /* ---------- Pomoc: budowa „pustej” postaci ---------- */
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
  humanBuff: null, // { type: 'dmg'|'tohit'|'hp', expiresTurn }
  humanPendingChoice: "dmg",
  humanPendingIdx: null, // <--- dodane

  elfChargeUsed: false,
  elfChargedTurn: null,

  dwarfPassiveArmed: false,
  dwarfHibernating: false,
  dwarfHibernateTurns: 0,

  faeykaiChargesLeft: 3,
  faeykaiMaskBroken: false,
  faeykaiOutsideHomeland: true,
  faeykaiPending: null, // <--- dodane

  effects: [],

  // Klasowe
  classUsed: false,
  warriorReady: false,
  archerReady: false,
  shooterReady: false,
  mageReady: false,
  mageShield: 0,
});


  /* ---------- Stan: cztery postacie ---------- */
  const [sets, setSets] = useState([makeChar(), makeChar(), makeChar(), makeChar()]);
  const [lockedSets, setLockedSets] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  /* ---------- Log / Tury ---------- */
  const [turn, setTurn] = useState(1);
  const [log, setLog] = useState([]);
  const addLog = (line) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev]);

  /* ---------- Test walki (gracz) ---------- */
  const [weapon, setWeapon] = useState("sword");
  const [selectedSpellName, setSelectedSpellName] = useState("Magiczny pocisk");
  const [healTarget, setHealTarget] = useState(0);

  /* ---------- Dyplomata (gracz) ---------- */
  const [diplomacySourceEnemy, setDiplomacySourceEnemy] = useState(null);
  const [diplomacyTargetType, setDiplomacyTargetType] = useState("player"); // 'player' | 'enemy'
  const [diplomacyTargetPlayer, setDiplomacyTargetPlayer] = useState(0);
  const [diplomacyTargetEnemyInst, setDiplomacyTargetEnemyInst] = useState(null);
  const [forcedOrders, setForcedOrders] = useState({}); // instanceId -> { kind:'player'|'enemy', target }

  /* ---------- Wrogowie: konfiguracja i instancje ---------- */
  const [enemyRosterConfig, setEnemyRosterConfig] = useState({
    cultist_elf: 1,
    magmar_spy: 0,
  });
  const [activeEnemies, setActiveEnemies] = useState([]); // instancje
  const [selectedEnemyId, setSelectedEnemyId] = useState(null);

  // Efekty na wrogach
  const [enemyStun, setEnemyStun] = useState({});
  const [enemyCurse, setEnemyCurse] = useState({});
  const [enemyDefenseDebuff, setEnemyDefenseDebuff] = useState({});
  const [enemyArmorDebuff, setEnemyArmorDebuff] = useState({});

  // UI ataku wroga
  const [enemyAttackMode, setEnemyAttackMode] = useState("weapon"); // 'weapon'|'spell'
  const [enemyWeaponChoice, setEnemyWeaponChoice] = useState("sword");
  const [enemySpellChoice, setEnemySpellChoice] = useState("");
  const [enemyTargetPlayer, setEnemyTargetPlayer] = useState(0);
  const [enemyTargetEnemyInst, setEnemyTargetEnemyInst] = useState(null);
  const [enemyAoETargets, setEnemyAoETargets] = useState([0]);

  /* ---------- Pomocnicze: gracze ---------- */
  const getActiveStats = () => sets[activeSet];
  const updateSetField = (i, key, val) => {
    setSets((prev) => {
      const next = [...prev];
      const parsed = ["name","race","clazz","humanPendingChoice"].includes(key)
        ? val
        : (val === "" ? null : Number(val));
      next[i] = { ...next[i], [key]: parsed };
      // Faeykai: maska <21% bazowego HP
      if (key === "hp" && next[i].race === "Faeykai") {
        const s = next[i];
        const thresh = Math.ceil((s.maxHp || 20) * 0.21);
        if ((s.hp || 0) < thresh) next[i].faeykaiMaskBroken = true;
      }
      return next;
    });
  };
  const spendPlayerAction = (i) => {
    let ok = false;
    setSets((prev) => {
      const next = [...prev];
      const c = { ...next[i] };
      if ((c.actionsLeft || 0) > 0) {
        c.actionsLeft -= 1;
        ok = true;
      }
      next[i] = c;
      return next;
    });
    return ok;
  };
  const lockSet = (i) => {
    const s = sets[i];
    const required = ["STR", "DEX", "PER", "MAG", "CHA"].every((k) => s[k] !== null && s[k] !== "");
    if (!required) return addLog(`❌ Postać ${i + 1}: uzupełnij wszystkie statystyki.`);
    setLockedSets((prev) => { const n=[...prev]; n[i]=true; return n;});
    addLog(`✔️ Postać ${i + 1} (${s.name || `Postać ${i + 1}`}) zatwierdzona.`);
  };
  const restSet = (i) => {
    setSets((prev) => {
      const next = [...prev];
      const c = { ...next[i] };
      c.hp = c.maxHp ?? 20;
      c.essence = c.maxEssence ?? 20;
      c.actionsLeft = 2;
      c.humanCharges = [false,false,false,false,false];
      c.humanBuff = null;
      c.elfChargeUsed=false; c.elfChargedTurn=null;
      c.dwarfPassiveArmed=false; c.dwarfHibernating=false; c.dwarfHibernateTurns=0;
      c.faeykaiChargesLeft=3; c.faeykaiMaskBroken=false;
      c.effects=[];
      c.classUsed=false; c.warriorReady=false; c.archerReady=false; c.shooterReady=false; c.mageReady=false; c.mageShield=0;
      next[i]=c;
      return next;
    });
    // reset efektów w całej walce
    setEnemyStun({}); setEnemyCurse({}); setEnemyDefenseDebuff({}); setEnemyArmorDebuff({}); setForcedOrders({});
    addLog(`💤 Postać ${i + 1} odpoczęła: HP/Esencja odnowione, efekty zresetowane (także na wrogach).`);
  };

  /* ---------- Wrogowie: tworzenie instancji ---------- */
  const createEnemyInstances = () => {
    const instances = [];
    Object.entries(enemyRosterConfig).forEach(([typeId, count]) => {
      const type = ENEMY_TYPES[typeId];
      if (!type) return;
      for (let i = 1; i <= Number(count || 0); i++) {
        instances.push({
          id: `${typeId}#${i}`,
          typeId,
          name: `${type.label} #${i}`,
          hp: type.base.hp, maxHp: type.base.maxHp,
          essence: type.base.essence, maxEss: type.base.maxEss,
          armor: type.base.armor,
          magicDefense: type.base.magicDefense,
          toHit: type.base.toHit,
          defense: type.base.defense,
          actionsLeft: 2,
          weaponChoice: type.weapons[0] || "sword",
          toHitBuff: 0, // buff trafienia (np. z Mrocznego Paktu)
        });
      }
    });
    setActiveEnemies(instances);
    setEnemyStun({});
    setEnemyCurse({});
    setEnemyDefenseDebuff({});
    setEnemyArmorDebuff({});
    setForcedOrders({});
    setSelectedEnemyId(instances[0]?.id || null);
    addLog(`👥 Dodano do walki ${instances.length} wrogów.`);
  };

  /* ---------- Wrogowie: pomocnicze ---------- */
  const getEnemyInstance = (instId) => activeEnemies.find(e => e.id === instId) || null;
  const updateEnemyInstance = (instId, updater) => {
    setActiveEnemies(prev => prev.map(e => e.id === instId ? updater({ ...e }) : e));
  };
  const damageEnemyInstance = (instId, dmg) => {
    if (dmg <= 0) return;
    updateEnemyInstance(instId, inst => {
      inst.hp = Math.max(0, inst.hp - dmg);
      return inst;
    });
    const after = Math.max(0, (getEnemyInstance(instId)?.hp || 0) - dmg);
    addLog(`💔 ${instId} otrzymał ${dmg} obrażeń (≈${after} HP po).`);
  };
  const spendEnemyAction = (instId) => {
    let ok = false;
    updateEnemyInstance(instId, inst => {
      if ((inst.actionsLeft || 0) > 0) { inst.actionsLeft -= 1; ok = true; }
      return inst;
    });
    return ok;
  };
  const effectiveEnemyDefense = (instId) => {
    const e = getEnemyInstance(instId);
    const deb = enemyDefenseDebuff[instId];
    return Math.max(0, (e?.defense || 0) - (deb?.value || 0));
  };
  const effectiveEnemyArmor = (instId) => {
    const e = getEnemyInstance(instId);
    const deb = enemyArmorDebuff[instId];
    const factor = deb?.factor || 1;
    return Math.max(0, Math.floor((e?.armor || 0) * factor));
  };

  /* ---------- GRACZ: atak fizyczny → wróg (instancja) ---------- */
  const doPlayerAttack = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");
    if (!selectedEnemyId) return addLog("❌ Wybierz wroga.");

    const w = weaponData[weapon];
    const statVal = Number(c[w.stat] ?? 0);
    const humanToHitBonus = c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? 2 : 0;

    // Wojownik — maksymalny cios
    if (c.clazz === "Wojownik" && c.warriorReady && w.type === "physical") {
      const maxDmg = w.dmgDie;
      addLog(`💥 Wojownik: auto-trafienie, ignoruje obronę/pancerz. Obrażenia = max k${w.dmgDie} (${maxDmg}).`);
      spendPlayerAction(activeSet);
      setSets(prev => { const n=[...prev]; n[activeSet] = { ...n[activeSet], warriorReady:false }; return n; });
      damageEnemyInstance(selectedEnemyId, maxDmg);
      return;
    }

    const effDefense = effectiveEnemyDefense(selectedEnemyId);
    const roll20 = d(20);
    const toHit = roll20 + statVal + humanToHitBonus;
    const hit = toHit >= effDefense;

    addLog(`⚔️ Atak (${w.name}) → ${selectedEnemyId}: k20=${roll20} + ${w.stat}(${statVal})${humanToHitBonus? " + human(+2)": ""} = ${toHit} vs Obrona ${effDefense} → ${hit? "✅":"❌"}`);
    spendPlayerAction(activeSet);
    if (!hit) return;

    const rawDie = d(w.dmgDie);
    const humanDmgBonus = c.race === "Człowiek" && c.humanBuff?.type === "dmg" ? 2 : 0;
    const raw = rawDie + humanDmgBonus;
    const effArmor = effectiveEnemyArmor(selectedEnemyId);
    const afterArmor = Math.max(0, raw - effArmor);
    addLog(`🗡️ Obrażenia: k${w.dmgDie}=${rawDie}${humanDmgBonus? " + human(+2)": ""} = ${raw} − Pancerz(${effArmor}) = ${afterArmor}`);

    // debuffy łucznika/strzelca
    if (c.clazz === "Łucznik" && c.archerReady && weapon === "bow") {
      setEnemyDefenseDebuff(prev => ({ ...prev, [selectedEnemyId]: { value:5, turns:3 } }));
      setSets(prev => { const n=[...prev]; n[activeSet] = { ...n[activeSet], archerReady:false }; return n; });
      addLog(`🏹 Debuff: Obrona celu −5 na 3 tury.`);
    }
    if (c.clazz === "Strzelec" && c.shooterReady && weapon === "musket") {
      setEnemyArmorDebuff(prev => ({ ...prev, [selectedEnemyId]: { factor:0.5, turns:3 } }));
      setSets(prev => { const n=[...prev]; n[activeSet] = { ...n[activeSet], shooterReady:false }; return n; });
      addLog(`🔧 Debuff: Pancerz celu ×0.5 na 3 tury.`);
    }

    damageEnemyInstance(selectedEnemyId, afterArmor);
  };

  /* ---------- GRACZ: zaklęcia (damage / heal) ---------- */
  const castPlayerSpell = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    const spell = PLAYER_SPELLS[selectedSpellName];
    if (!spell) return;
    if ((c.essence || 0) < spell.cost) return addLog(`❌ Esencja: ${c.essence} < koszt ${spell.cost}.`);

    const MAG = Number(c.MAG ?? 0);
    const faeykaiPenalty = c.race === "Faeykai" && c.faeykaiOutsideHomeland && c.faeykaiMaskBroken ? 5 : 0;

    // koszty/akcja
    setSets(prev => { const n=[...prev]; n[activeSet] = { ...n[activeSet], essence: (n[activeSet].essence||0) - spell.cost }; return n; });
    spendPlayerAction(activeSet);

    let lines = [`✨ „${selectedSpellName}” — koszt ${spell.cost} (Esencja po: ${(c.essence||0)-spell.cost})`];

    if (spell.type === "damage") {
      if (!selectedEnemyId) return addLog("❌ Wybierz wroga.");
      const effDefense = effectiveEnemyDefense(selectedEnemyId);
      const roll20 = d(20);
      const toHit = roll20 + MAG - faeykaiPenalty + (c.race==="Człowiek" && c.humanBuff?.type==="tohit" ? 2 : 0);
      const hit = toHit >= effDefense;
      lines.push(`🎯 Trafienie: k20=${roll20} + MAG(${MAG})${faeykaiPenalty? " − Faeykai(−5)": ""}${(c.race==="Człowiek" && c.humanBuff?.type==="tohit")? " + human(+2)": ""} = ${toHit} vs Obrona ${effDefense} → ${hit? "✅":"❌"}`);
      if (!hit) return addLog(lines.join("\n"));

      const rollDmg = d(spell.dmgDie);
      const mod = statMod(MAG);
      const humanDmgBonus = c.race === "Człowiek" && c.humanBuff?.type === "dmg" ? 2 : 0;
      const raw = rollDmg + mod + humanDmgBonus;
      const effMagicDef = getEnemyInstance(selectedEnemyId)?.magicDefense || 0;
      const reduced = Math.max(0, raw - effMagicDef);
      lines.push(`💥 Obrażenia: k${spell.dmgDie}=${rollDmg} + mod(MAG)=${mod}${humanDmgBonus? " + human(+2)": ""} = ${raw}`);
      lines.push(`🛡️ Redukcja magią: −${effMagicDef} → ${reduced}`);
      addLog(lines.join("\n"));

      // Mag: tarcza po czarze (jeśli mageReady)
      if (c.clazz === "Mag" && c.mageReady && reduced > 0) {
        setSets(prev => { const n=[...prev]; n[activeSet] = { ...n[activeSet], mageReady:false, mageShield: Math.floor(reduced*0.5)}; return n;});
        addLog(`🔮 Tarcza Maga aktywna: ${Math.floor(reduced * 0.5)}.`);
      }
      damageEnemyInstance(selectedEnemyId, reduced);
      return;
    }

    if (spell.type === "heal") {
      const rollHeal = d(spell.healDie);
      setSets(prev => {
        const n=[...prev];
        const t = { ...n[healTarget] };
        t.hp = Math.min(t.maxHp || 20, (t.hp||0) + rollHeal);
        n[healTarget] = t;
        return n;
      });
      lines.push(`💚 Leczenie: k${spell.healDie}=${rollHeal} → Postać ${healTarget+1} +${rollHeal} HP`);
      addLog(lines.join("\n"));
      return;
    }

    addLog(lines.concat("🌑 Efekt zaklęcia zastosowany.").join("\n"));
  };

  /* ---------- Dyplomata: wymuszenie (wróg instancja → gracz/wróg) ---------- */
  const useDiplomatPower = (playerIndex) => {
    const me = sets[playerIndex];
    if (me.classUsed) return addLog("❌ Dyplomata już użył mocy w tym odpoczynku.");
    if ((me.actionsLeft||0) <= 0) return addLog("❌ Brak akcji.");
    if (!diplomacySourceEnemy) return addLog("❌ Wybierz 'Wroga źródłowego'.");

    const src = diplomacySourceEnemy;
    let order = null;
    if (diplomacyTargetType === "player") {
      order = { kind: "player", target: diplomacyTargetPlayer };
    } else {
      if (!diplomacyTargetEnemyInst) return addLog("❌ Wybierz 'Cel (wróg)'.");
      order = { kind: "enemy", target: diplomacyTargetEnemyInst };
    }
    setForcedOrders(prev => ({ ...prev, [src]: order }));
    setSets(prev => { const n=[...prev]; n[playerIndex] = { ...n[playerIndex], classUsed: true, actionsLeft:(n[playerIndex].actionsLeft||0)-1 }; return n; });

    const srcName = getEnemyInstance(src)?.name || src;
    const targetLabel = order.kind === "player"
      ? `Postać ${order.target+1}`
      : (getEnemyInstance(order.target)?.name || order.target);
    addLog(`🗣️ Dyplomata (P${playerIndex+1}) wymusza: ${srcName} zaatakuje ${targetLabel} przy swoim następnym ataku.`);
  };

  /* ---------- Wróg: atak bronią ---------- */
  const doEnemyWeaponAttack = () => {
    const instId = selectedEnemyId;
    if (!instId) return addLog("❌ Wybierz wroga.");
    const inst = getEnemyInstance(instId);
    if (!inst) return;
    if ((inst.actionsLeft||0) <= 0) return addLog("❌ Wróg nie ma akcji.");

    const order = forcedOrders[instId];

    // wróg → wróg (wymuszenie)
    if (order && order.kind === "enemy") {
      const targetInst = getEnemyInstance(order.target);
      if (!targetInst) return addLog("❌ Cel (wróg) nie istnieje.");
      const w = weaponData[inst.weaponChoice || enemyWeaponChoice || "sword"];
      const roll20 = d(20);
      const need = inst.toHit + (enemyCurse[instId] > 0 ? 3 : 0) - (inst.toHitBuff||0);
      const hit = roll20 >= need;
      let lines = [`🤺 ${inst.name} atakuje (broń: ${w.name}) → ${targetInst.name}`];
      lines.push(`🎯 Trafienie: k20=${roll20} vs próg ${need}${enemyCurse[instId]? " (przeklęty +3)": ""}${inst.toHitBuff? ` (buff −${inst.toHitBuff})`: ""} → ${hit? "✅":"❌"}`);
      if (!hit) { addLog(lines.join("\n")); setForcedOrders(prev=>({...prev,[instId]:null})); return; }

      const raw = d(w.dmgDie);
      const effArmor = effectiveEnemyArmor(targetInst.id);
      const dmg = Math.max(0, raw - effArmor);
      lines.push(`💥 Obrażenia: k${w.dmgDie}=${raw} − Pancerz(${effArmor}) = ${dmg}`);
      addLog(lines.join("\n"));
      if (dmg>0) damageEnemyInstance(targetInst.id, dmg);

      spendEnemyAction(instId);
      setForcedOrders(prev=>({...prev,[instId]:null}));
      return;
    }

    // wróg → gracz
    const targetIndex = enemyTargetPlayer;
    const target = sets[targetIndex];
    const w = weaponData[inst.weaponChoice || enemyWeaponChoice || "sword"];
    const roll20 = d(20);
    const need = inst.toHit + (enemyCurse[instId] > 0 ? 3 : 0) - (inst.toHitBuff||0);
    const hit = roll20 >= need;

    let lines = [`👹 ${inst.name} atakuje (broń: ${w.name}) → Postać ${targetIndex+1}`];
    lines.push(`🎯 Trafienie: k20=${roll20} vs próg ${need}${enemyCurse[instId]? " (przeklęty +3)": ""}${inst.toHitBuff? ` (buff −${inst.toHitBuff})`: ""} → ${hit? "✅":"❌"}`);
    if (!hit) { addLog(lines.join("\n")); if (order) setForcedOrders(prev=>({...prev,[instId]:null})); return; }

    let incoming = d(w.dmgDie);
    lines.push(`💥 Rzut na obrażenia: k${w.dmgDie}=${incoming}`);

    if (target.dwarfHibernating) {
      lines.push(`🛌 Cel w hibernacji — obrażenia zignorowane.`);
    } else {
      incoming = Math.max(0, incoming - Number(target.armor || 0));
      lines.push(`🛡️ Redukcja: − Pancerz (${target.armor}) → ${incoming}`);

      if ((target.mageShield||0) > 0) {
        const use = Math.min(target.mageShield, incoming);
        const reflected = use;
        incoming = Math.max(0, incoming - use);
        setSets(prev => { const n=[...prev]; const t={...n[targetIndex]}; t.mageShield = Math.max(0, (t.mageShield||0)-use); n[targetIndex]=t; return n;});
        lines.push(`🔮 Tarcza Maga: −${use}, odbicie ${use} w ${inst.name}`);
        if (reflected>0) damageEnemyInstance(instId, reflected);
      }

      if (incoming>0) {
        setSets(prev => {
          const n=[...prev]; const t={...n[targetIndex]};
          const before = t.hp||0;
          t.hp = Math.max(0, before - incoming);
          if (t.race==="Faeykai") {
            const thr = Math.ceil((t.maxHp||20)*0.21);
            if (t.hp < thr) t.faeykaiMaskBroken = true;
          }
          if (t.race==="Krasnolud" && t.dwarfPassiveArmed && before>0 && t.hp<=0) {
            t.dwarfHibernating=true; t.dwarfHibernateTurns=2; t.dwarfPassiveArmed=false;
            lines.push("⛏️ Krasnolud: wchodzi w hibernację na 2 tury.");
          }
          n[targetIndex]=t; return n;
        });
        lines.push(`❤️ HP Postaci ${targetIndex+1} −${incoming}`);
      }
    }

    addLog(lines.join("\n"));
    spendEnemyAction(instId);
    if (order) setForcedOrders(prev=>({...prev,[instId]:null}));
  };

  /* ---------- Wróg: zaklęcia ---------- */
  const doEnemyCastSpell = () => {
    const instId = selectedEnemyId;
    if (!instId) return addLog("❌ Wybierz wroga.");
    const inst = getEnemyInstance(instId);
    if (!inst) return;
    if ((inst.actionsLeft||0) <= 0) return addLog("❌ Wróg nie ma akcji.");

    const type = ENEMY_TYPES[inst.typeId];
    if (!type) return;
    const spell = type.spells[enemySpellChoice];
    if (!spell) return addLog("❌ Wybierz zaklęcie.");
    if ((inst.essence||0) < spell.cost) return addLog(`❌ ${inst.name} ma za mało Esencji (${inst.essence}) na koszt ${spell.cost}.`);

    // koszt + akcja
    updateEnemyInstance(instId, e => { e.essence = Math.max(0, (e.essence||0) - spell.cost); return e; });
    spendEnemyAction(instId);

    const order = forcedOrders[instId];
    const rollToHit = () => {
      const r = d(20);
      const need = inst.toHit + (enemyCurse[instId] > 0 ? 3 : 0) - (inst.toHitBuff||0);
      return { r, need, ok: r >= need };
    };

    const applyMagicToPlayer = (playerIndex, dmgDie) => {
      const r = d(dmgDie);
      let incoming = Math.max(0, r - Number(sets[playerIndex].magicDefense || 0));
      let lines = [`💥 Obrażenia: k${dmgDie}=${r} − Obrona magii(${sets[playerIndex].magicDefense||0}) = ${incoming}`];

      if ((sets[playerIndex].mageShield||0) > 0) {
        const use = Math.min(sets[playerIndex].mageShield, incoming);
        const reflected = use;
        incoming = Math.max(0, incoming - use);
        setSets(prev => { const n=[...prev]; const t={...n[playerIndex]}; t.mageShield = Math.max(0,(t.mageShield||0)-use); n[playerIndex]=t; return n; });
        lines.push(`🔮 Tarcza Maga: −${use}, odbicie ${use} w ${inst.name}`);
        if (reflected>0) damageEnemyInstance(instId, reflected);
      }

      if (incoming>0) {
        setSets(prev => {
          const n=[...prev]; const t={...n[playerIndex]};
          const before = t.hp||0;
          t.hp = Math.max(0, before - incoming);
          if (t.race==="Faeykai") {
            const thr = Math.ceil((t.maxHp||20)*0.21);
            if (t.hp < thr) t.faeykaiMaskBroken = true;
          }
          n[playerIndex]=t; return n;
        });
        lines.push(`❤️ HP Postaci ${playerIndex+1} −${incoming}`);
      }
      return lines;
    };

    const applyMagicToEnemy = (targetInstId, dmgDie) => {
      const r = d(dmgDie);
      const effMagicDef = getEnemyInstance(targetInstId)?.magicDefense || 0;
      const inc = Math.max(0, r - effMagicDef);
      const lines = [`💥 Obrażenia: k${dmgDie}=${r} − Obrona magii(${effMagicDef}) = ${inc}`];
      if (inc>0) damageEnemyInstance(targetInstId, inc);
      return lines;
    };

    // --- obsługa zaklęć:
    if (spell.key === "pact") {
      // Mroczny Pakt: cel (gracz/wróg) −4 HP, dostaje +4 Trafienie
      if (order && order.kind === "enemy") {
        const trg = getEnemyInstance(order.target);
        if (!trg) return addLog("❌ Cel (wróg) nie istnieje.");
        updateEnemyInstance(order.target, e => { e.hp=Math.max(0,e.hp-4); e.toHit = Math.max(0, e.toHit-4); return e; }); // „+4 Trafienie” celu → obniżamy jego próg o 4
        addLog(`🕯️ ${inst.name} rzuca „Mroczny Pakt” na ${trg.name}: cel −4 HP, próg trafienia celu −4 (łatwiej trafia).`);
        setForcedOrders(prev=>({...prev,[instId]:null}));
        return;
      } else if (order && order.kind === "player") {
        const pi = order.target;
        setSets(prev => { const n=[...prev]; const t={...n[pi]}; t.hp=Math.max(0,(t.hp||0)-4); n[pi]=t; return n;});
        addLog(`🕯️ ${inst.name} rzuca „Mroczny Pakt” na Postać ${pi+1}: −4 HP (buff trafienia informacyjny).`);
        setForcedOrders(prev=>({...prev,[instId]:null}));
        return;
      } else {
        // według UI — jeśli wybrano wroga jako cel, buff na wroga; w przeciwnym razie gracz
        if (enemyTargetEnemyInst) {
          const trg = getEnemyInstance(enemyTargetEnemyInst);
          if (trg) {
            updateEnemyInstance(enemyTargetEnemyInst, e => { e.hp=Math.max(0,e.hp-4); e.toHit = Math.max(0, e.toHit-4); return e; });
            addLog(`🕯️ ${inst.name} rzuca „Mroczny Pakt” na ${trg.name}: cel −4 HP, próg trafienia celu −4 (łatwiej trafia).`);
          }
        } else {
          const pi = enemyTargetPlayer;
          setSets(prev => { const n=[...prev]; const t={...n[pi]}; t.hp=Math.max(0,(t.hp||0)-4); n[pi]=t; return n;});
          addLog(`🕯️ ${inst.name} rzuca „Mroczny Pakt” na Postać ${pi+1}: −4 HP (buff trafienia informacyjny).`);
        }
        return;
      }
    }

    if (spell.key === "drain") {
      // Wyssanie życia: cel (gracz/wróg) −5 HP, caster +5 HP
      if (order && order.kind === "enemy") {
        const trg = getEnemyInstance(order.target);
        if (!trg) return addLog("❌ Cel (wróg) nie istnieje.");
        updateEnemyInstance(order.target, e => { e.hp=Math.max(0,e.hp-5); return e; });
        updateEnemyInstance(instId, e => { e.hp=Math.min(e.maxHp, e.hp+5); return e; });
        addLog(`🩸 ${inst.name} wysysa życie z ${trg.name}: cel −5 HP, ${inst.name} +5 HP.`);
        setForcedOrders(prev=>({...prev,[instId]:null}));
        return;
      } else if (order && order.kind === "player") {
        const pi = order.target;
        setSets(prev => { const n=[...prev]; const t={...n[pi]}; t.hp=Math.max(0,(t.hp||0)-5); n[pi]=t; return n;});
        updateEnemyInstance(instId, e => { e.hp=Math.min(e.maxHp, e.hp+5); return e; });
        addLog(`🩸 ${inst.name} wysysa życie z Postać ${pi+1}: cel −5 HP, ${inst.name} +5 HP.`);
        setForcedOrders(prev=>({...prev,[instId]:null}));
        return;
      } else {
        if (enemyTargetEnemyInst) {
          updateEnemyInstance(enemyTargetEnemyInst, e => { e.hp=Math.max(0,e.hp-5); return e; });
          updateEnemyInstance(instId, e => { e.hp=Math.min(e.maxHp, e.hp+5); return e; });
          addLog(`🩸 ${inst.name} wysysa życie z ${getEnemyInstance(enemyTargetEnemyInst)?.name}: cel −5 HP, ${inst.name} +5 HP.`);
        } else {
          const pi = enemyTargetPlayer;
          setSets(prev => { const n=[...prev]; const t={...n[pi]}; t.hp=Math.max(0,(t.hp||0)-5); n[pi]=t; return n;});
          updateEnemyInstance(instId, e => { e.hp=Math.min(e.maxHp, e.hp+5); return e; });
          addLog(`🩸 ${inst.name} wysysa życie z Postać ${pi+1}: cel −5 HP, ${inst.name} +5 HP.`);
        }
        return;
      }
    }

    if (spell.key === "missile") {
      // Magiczny pocisk — k20 vs próg trafienia (toHit), dmg k6 po Obronie magii celu
      const { r, need, ok } = rollToHit();
      let header = `✨ ${inst.name} rzuca „Magiczny pocisk”`;
      if (order && order.kind === "enemy") {
        const trg = getEnemyInstance(order.target);
        if (!trg) return addLog("❌ Cel (wróg) nie istnieje.");
        let lines = [`${header} → ${trg.name}`, `🎯 Trafienie: k20=${r} vs próg ${need}${enemyCurse[instId]? " (przeklęty +3)": ""}${inst.toHitBuff? ` (buff −${inst.toHitBuff})`: ""} → ${ok? "✅":"❌"}`];
        if (!ok) { addLog(lines.join("\n")); setForcedOrders(prev=>({...prev,[instId]:null})); return; }
        lines.push(...applyMagicToEnemy(order.target, spell.dmgDie));
        addLog(lines.join("\n"));
        setForcedOrders(prev=>({...prev,[instId]:null}));
        return;
      } else if (order && order.kind === "player") {
        const pi = order.target;
        let lines = [`${header} → Postać ${pi+1}`, `🎯 Trafienie: k20=${r} vs próg ${need}${enemyCurse[instId]? " (przeklęty +3)": ""}${inst.toHitBuff? ` (buff −${inst.toHitBuff})`: ""} → ${ok? "✅":"❌"}`];
        if (!ok) { addLog(lines.join("\n")); setForcedOrders(prev=>({...prev,[instId]:null})); return; }
        lines.push(...applyMagicToPlayer(pi, spell.dmgDie));
        addLog(lines.join("\n"));
        setForcedOrders(prev=>({...prev,[instId]:null}));
        return;
      } else {
        const pi = enemyTargetPlayer;
        let lines = [`${header} → Postać ${pi+1}`, `🎯 Trafienie: k20=${r} vs próg ${need}${enemyCurse[instId]? " (przeklęty +3)": ""}${inst.toHitBuff? ` (buff −${inst.toHitBuff})`: ""} → ${ok? "✅":"❌"}`];
        if (!ok) return addLog(lines.join("\n"));
        lines.push(...applyMagicToPlayer(pi, spell.dmgDie));
        addLog(lines.join("\n"));
        return;
      }
    }

    if (spell.key === "burst") {
      // Wybuch energii — AoE (kilku graczy)
      const { r, need, ok } = rollToHit();
      let header = `💥 ${inst.name} rzuca „Wybuch energii” (obszar) na: ${enemyAoETargets.map(i=>`P${i+1}`).join(", ") || "—"}`;
      let lines = [header, `🎯 Trafienie (wspólne): k20=${r} vs próg ${need}${enemyCurse[instId]? " (przeklęty +3)": ""}${inst.toHitBuff? ` (buff −${inst.toHitBuff})`: ""} → ${ok? "✅":"❌"}`];
      if (!ok) return addLog(lines.join("\n"));
      enemyAoETargets.forEach(pi => {
        const sub = applyMagicToPlayer(pi, spell.dmgDie);
        lines.push(...sub);
      });
      addLog(lines.join("\n"));
      return;
    }

    addLog(`ℹ️ ${inst.name} rzucił zaklęcie.`);
  };

  /* ---------- Next turn ---------- */
  const nextTurn = () => {
    setSets(prev => prev.map((c,idx) => {
      const me={...c};
      me.actionsLeft = 2;

      // Człowiek — buff wygasa
      if (me.humanBuff && me.humanBuff.expiresTurn < turn + 1) me.humanBuff = null;

      // Elf: eksplozja (1 tura po ładowaniu)
      if (me.race === "Elf" && me.elfChargeUsed && me.elfChargedTurn === turn) {
        const before = me.hp||0;
        me.hp = Math.max(0, before - 5);
        addLog(`🌩️ Elf (P${idx+1}) — eksplozja: −5 HP dla elfa; wrogowie −10 HP i ogłuszenie 1 turę.`);
        setActiveEnemies(prevE => prevE.map(e => ({ ...e, hp: Math.max(0, e.hp - 10) })));
        setEnemyStun(prevStun => {
          const n={...prevStun};
          for (const e of activeEnemies) n[e.id] = Math.max(n[e.id]||0, 1);
          return n;
        });
        me.elfChargeUsed=false; me.elfChargedTurn=null;
      }

      // Efekty (np. błogosławieństwo Faeykai)
      if (me.effects?.length) {
        me.effects = me.effects
          .map(ef => {
            if (ef.type==="bless" && ef.turnsLeft>0) {
              me.hp = Math.min(me.maxHp||20, (me.hp||0) + (ef.value||0));
              return { ...ef, turnsLeft: ef.turnsLeft-1 };
            }
            return { ...ef, turnsLeft: (ef.turnsLeft||0)-1 };
          })
          .filter(ef => ef.turnsLeft>0);
      }

      // Krasnolud — hibernacja
      if (me.dwarfHibernating) {
        me.dwarfHibernateTurns = Math.max(0, (me.dwarfHibernateTurns||0) - 1);
        if (me.dwarfHibernateTurns === 0) {
          me.dwarfHibernating=false;
          addLog(`⛏️ Krasnolud (P${idx+1}) kończy hibernację.`);
        }
      }

      // Faeykai: pęknięcie maski przy <21% max HP
      if (me.race === "Faeykai") {
        const thr = Math.ceil((me.maxHp||20)*0.21);
        if ((me.hp||0) < thr) me.faeykaiMaskBroken = true;
      }

      return me;
    }));

    setActiveEnemies(prev => prev.map(e => ({ ...e, actionsLeft: 2, toHitBuff: Math.max(0, (e.toHitBuff||0)-2) }))); // lekki spadek tymczasowego buffa
    setEnemyStun(prev => { const n={...prev}; for (const k in n) n[k]=Math.max(0,n[k]-1); return n; });
    setEnemyCurse(prev => { const n={...prev}; for (const k in n) n[k]=Math.max(0,n[k]-1); return n; });
    setEnemyDefenseDebuff(prev => {
      const n={...prev}; for (const k in n){ const t=n[k]?.turns||0; n[k]=t>1?{...n[k],turns:t-1}:{ value:0, turns:0 }; } return n;
    });
    setEnemyArmorDebuff(prev => {
      const n={...prev}; for (const k in n){ const t=n[k]?.turns||0; n[k]=t>1?{...n[k],turns:t-1}:{ factor:1, turns:0 }; } return n;
    });

    setTurn(t => t+1);
    addLog(`⏱️ Rozpoczyna się tura ${turn + 1}.`);
  };

  /* ================== RENDER — w Part 2/2 ================== */
  return (
    <div style={{ padding: 16 }}>
      {/* Nagłówek / Tura */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>🕒 Tura: {turn}</h2>
        <button onClick={nextTurn}>➡️ Następna tura</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
        {/* LEWA KOLUMNA — Postacie + Test walki */}
        <div>
          <h3>1) Postacie</h3>
          {sets.map((set, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong>Postać {i + 1}</strong>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="activeSet" checked={activeSet === i} onChange={() => setActiveSet(i)} />
                  Aktywna
                </label>
              </div>

              {/* Imię, Rasa, Klasa, Akcje */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 6 }}>
                <label>Imię <input value={set.name} onChange={(e) => updateSetField(i, "name", e.target.value)} /></label>
                <label>Rasa
                  <select value={set.race} onChange={(e) => updateSetField(i, "race", e.target.value)}>
                    {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label>Klasa
                  <select value={set.clazz} onChange={(e) => updateSetField(i, "clazz", e.target.value)}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>Akcje (tura) <input type="number" value={set.actionsLeft ?? 0} readOnly /></label>
              </div>

              {/* Statystyki */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 6 }}>
                {["STR","DEX","PER","MAG","CHA"].map((k) => (
                  <label key={k}>{k}
                    <input type="number" value={set[k] ?? ""} onChange={(e)=>updateSetField(i,k,e.target.value)} disabled={lockedSets[i]} />
                    <small>mod: {set[k] != null ? statMod(Number(set[k])) : "-"}</small>
                  </label>
                ))}
              </div>

              {/* Atrybuty */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 6 }}>
                <label>HP <input type="number" value={set.hp} onChange={(e)=>updateSetField(i,"hp",e.target.value)} /></label>
                <label>Max HP <input type="number" value={set.maxHp} onChange={(e)=>updateSetField(i,"maxHp",e.target.value)} /></label>
                <label>Esencja <input type="number" value={set.essence} onChange={(e)=>updateSetField(i,"essence",e.target.value)} /></label>
                <label>Max Esencja <input type="number" value={set.maxEssence} onChange={(e)=>updateSetField(i,"maxEssence",e.target.value)} /></label>
                <label>Pancerz <input type="number" value={set.armor} onChange={(e)=>updateSetField(i,"armor",e.target.value)} /></label>
                <label>Obrona magii <input type="number" value={set.magicDefense} onChange={(e)=>updateSetField(i,"magicDefense",e.target.value)} /></label>
              </div>

              {/* Zatwierdź / Odpoczynek */}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => lockSet(i)} disabled={lockedSets[i]}>✔️ Zatwierdź</button>
                <button onClick={() => restSet(i)}>💤 Odpocznij</button>
              </div>
{/* Pasywki rasowe */}
<div style={{ marginTop: 8 }}>
  {set.race === "Człowiek" && (
    <div>
      <div>Ludzka wytrwałość (5×/odpoczynek):</div>
      <div style={{ display: "flex", gap: 4 }}>
        {set.humanCharges.map((used, idx) => (
          <div
            key={idx}
            onClick={()=>{
              if (used) return;
              const choice = prompt("Wybierz bonus: dmg/tohit/hp");
              setSets(prev=>{
                const n=[...prev]; const c={...n[i]};
                c.humanCharges[idx]=true;
                if (choice==="dmg"||choice==="tohit"||choice==="hp")
                  c.humanBuff={ type:choice, expiresTurn: turn+1 };
                n[i]=c; return n;
              });
              addLog(`👤 P${i+1} użył ludzkiej zdolności: +2 ${choice} (do końca tury).`);
            }}
            style={{
              width:20, height:20,
              background: used?"red":"green",
              cursor:"pointer"
            }}
          />
        ))}
      </div>
    </div>
  )}

  {set.race === "Elf" && (
    <div>
      <div>Elfie naładowanie (1×/odpoczynek):</div>
      <div
        onClick={()=>{
          if (set.elfChargeUsed) return;
          setSets(prev=>{
            const n=[...prev]; const c={...n[i]};
            c.elfChargeUsed=true; c.elfChargedTurn=turn;
            n[i]=c; return n;
          });
          addLog(`🌩️ P${i+1} (Elf) ładuje eksplozję — wybuch w następnej turze.`);
        }}
        style={{
          width:20, height:20,
          background: set.elfChargeUsed?"red":"green",
          cursor:"pointer"
        }}
      />
    </div>
  )}

  {set.race === "Krasnolud" && (
    <div>
      <div>Krasnoludzka hibernacja (uzbrojenie):</div>
      <button
        onClick={()=>{
          if (set.dwarfPassiveArmed) return;
          setSets(prev=>{
            const n=[...prev]; const c={...n[i]};
            c.dwarfPassiveArmed=true; n[i]=c; return n;
          });
          addLog(`⛏️ P${i+1} (Krasnolud) uzbraja hibernację.`);
        }}
        disabled={set.dwarfPassiveArmed}
      >
        {set.dwarfPassiveArmed ? "Uzbrojone" : "Uzbrój hibernację"}
      </button>
    </div>
  )}

  {set.race === "Faeykai" && (
    <div>
      <div>Faeykai (3×/odpoczynek):</div>
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: set.faeykaiChargesLeft }, (_, idx)=>(
          <div
            key={idx}
            onClick={()=>{
              const choice = prompt("Wybierz efekt: bless/curse");
              if (!["bless","curse"].includes(choice)) return;
              if (choice==="bless") {
                const target = prompt("Na którą postać (1-4)?")-1;
                setSets(prev=>{
                  const n=[...prev]; const trg={...n[target]};
                  trg.effects=[...(trg.effects||[]),{ type:"bless", value:3, turnsLeft:3 }];
                  n[target]=trg; return n;
                });
                addLog(`🌱 Faeykai P${i+1} błogosławi P${target+1} (+3HP/3tury).`);
              }
              if (choice==="curse") {
                const enemyId = prompt("Id wroga do przeklęcia?");
                setEnemyCurse(prev=>({...prev,[enemyId]:3}));
                addLog(`🌑 Faeykai P${i+1} przeklina ${enemyId} (−3 toHit/3tury).`);
              }
              setSets(prev=>{
                const n=[...prev]; const c={...n[i]};
                c.faeykaiChargesLeft-=1; n[i]=c; return n;
              });
            }}
            style={{
              width:20, height:20,
              background:"green",
              cursor:"pointer"
            }}
          />
        ))}
      </div>
    </div>
  )}
</div>


              {/* Podnieś sojusznika */}
              <div style={{ marginTop: 8 }}>
                <label>Podnieś sojusznika:
                  <select
                    value={sets[i].reviveChoice ?? ""}
                    onChange={(e)=>{
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setSets(prev => {
                        const n=[...prev];
                        n[i] = { ...n[i], reviveChoice: val };
                        return n;
                      });
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    <option value="">—</option>
                    {sets.map((s, idx)=> (idx!==i && (s.hp||0)<=0) ? <option key={idx} value={idx}>Postać {idx+1}</option> : null)}
                  </select>
                </label>
                <button
                  onClick={()=>{
                    const t = sets[i].reviveChoice;
                    if (t==null) return addLog("❌ Wybierz sojusznika do podniesienia.");
                    // akcja gracza
                    if (!spendPlayerAction(i)) return addLog("❌ Brak akcji.");
                    const heal = Math.floor((sets[t].maxHp||20)*0.25);
                    setSets(prev => {
                      const n=[...prev]; const trg={...n[t]};
                      trg.hp=heal; trg.dwarfHibernating=false; trg.dwarfHibernateTurns=0; trg.dwarfPassiveArmed=false;
                      n[t]=trg; return n;
                    });
                    addLog(`🛡️ Postać ${i+1} podniosła Postać ${t+1} → HP = ${heal}.`);
                  }}
                  disabled={sets[i].reviveChoice==null}
                  style={{ marginLeft: 8 }}
                >
                  🛡️ Podnieś
                </button>
              </div>
            </div>
          ))}

          {/* Test walki gracza */}
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <h3>2) Test walki (gracz → wróg)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              <label>Broń
                <select value={weapon} onChange={(e)=>setWeapon(e.target.value)}>
                  <option value="sword">Miecz krótki (STR)</option>
                  <option value="bow">Łuk (PER)</option>
                  <option value="musket">Muszkiet (PER)</option>
                  <option value="staff">Kij magiczny (MAG)</option>
                </select>
              </label>
              <label>Wróg (cel)
                <select value={selectedEnemyId || ""} onChange={(e)=>setSelectedEnemyId(e.target.value)}>
                  <option value="" disabled>— wybierz —</option>
                  {activeEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label>Obrona magii celu
                <input type="number" value={selectedEnemyId ? (getEnemyInstance(selectedEnemyId)?.magicDefense || 0) : 0} readOnly />
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={doPlayerAttack}>⚔️ Wykonaj atak</button>
            </div>

            <div style={{ borderTop:"1px solid #eee", paddingTop:8, marginTop:8 }}>
              <h4>Zaklęcia (gracz)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <label>Zaklęcie
                  <select value={selectedSpellName} onChange={(e)=>setSelectedSpellName(e.target.value)}>
                    {Object.keys(PLAYER_SPELLS).map((n)=> <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>Obrona magii celu <input type="number" value={selectedEnemyId ? (getEnemyInstance(selectedEnemyId)?.magicDefense || 0) : 0} readOnly /></label>
                <label>Esencja (aktywny) <input type="number" value={getActiveStats().essence} readOnly /></label>
              </div>
              {selectedSpellName === "Zasklepienie ran" && (
                <div style={{ marginTop: 6 }}>
                  <label>Cel leczenia:
                    <select value={healTarget} onChange={(e)=>setHealTarget(Number(e.target.value))}>
                      {sets.map((_, idx)=> <option key={idx} value={idx}>Postać {idx+1}</option>)}
                    </select>
                  </label>
                </div>
              )}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.values(ENEMY_TYPES).map(t => (
                <label key={t.id}>
                  {t.label}:&nbsp;
                  <input
                    type="number"
                    min={0}
                    value={enemyRosterConfig[t.id] ?? 0}
                    onChange={(e)=>setEnemyRosterConfig(prev=>({ ...prev, [t.id]: Number(e.target.value) }))}
                  />
                </label>
              ))}
            </div>
            <button style={{ marginTop: 8 }} onClick={createEnemyInstances}>➕ Dodaj do walki</button>
          </div>

          {activeEnemies.length === 0 ? (
            <p style={{ opacity: .7 }}>Brak aktywnych wrogów — dodaj ich powyżej.</p>
          ) : (
            activeEnemies.map(e => (
              <div key={e.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, marginBottom: 8, background: selectedEnemyId===e.id ? "#eef" : "#fff" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="enemy" checked={selectedEnemyId===e.id} onChange={()=>setSelectedEnemyId(e.id)} />
                  <strong>{e.name}</strong>
                </label>
                <div>HP {e.hp}/{e.maxHp} | Esencja {e.essence}/{e.maxEss} | Akcje: {e.actionsLeft}</div>
                <div>Obrona (bazowa): {e.defense} | Pancerz (bazowy): {e.armor} | Obrona magii: {e.magicDefense}</div>
                <div>Efekty: Ogłuszenie {enemyStun[e.id]||0} | Przeklęty {enemyCurse[e.id]||0} t. | Obrona −{(enemyDefenseDebuff[e.id]?.value)||0} ({(enemyDefenseDebuff[e.id]?.turns)||0} t.) | Pancerz ×{(enemyArmorDebuff[e.id]?.factor)||1} ({(enemyArmorDebuff[e.id]?.turns)||0} t.)</div>
              </div>
            ))
          )}

          {/* Dyplomata — rozkaz */}
          <div style={{ border: "1px dashed #bbb", borderRadius: 8, padding: 8 }}>
            <h4>Dyplomata: wymuszenie ataku</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>Wróg źródłowy
                <select value={diplomacySourceEnemy || ""} onChange={(e)=>setDiplomacySourceEnemy(e.target.value)}>
                  <option value="">—</option>
                  {activeEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label>Rodzaj celu
                <select value={diplomacyTargetType} onChange={(e)=>setDiplomacyTargetType(e.target.value)}>
                  <option value="player">Gracz</option>
                  <option value="enemy">Wróg</option>
                </select>
              </label>
              {diplomacyTargetType === "player" ? (
                <label>Cel (postać)
                  <select value={diplomacyTargetPlayer} onChange={(e)=>setDiplomacyTargetPlayer(Number(e.target.value))}>
                    {sets.map((_, idx) => <option key={idx} value={idx}>Postać {idx+1}</option>)}
                  </select>
                </label>
              ) : (
                <label>Cel (wróg)
                  <select value={diplomacyTargetEnemyInst || ""} onChange={(e)=>setDiplomacyTargetEnemyInst(e.target.value)}>
                    <option value="">—</option>
                    {activeEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
              {sets.map((s,i) => s.clazz==="Dyplomata" ? (
                <button key={i} onClick={()=>useDiplomatPower(i)} title={`Użyj (Postać ${i+1})`}>🗣️ Użyj mocy (P{i+1})</button>
              ) : null)}
            </div>
            <div style={{ marginTop: 6 }}>
              Aktywne wymuszenia:&nbsp;
              {Object.entries(forcedOrders).length && Object.values(forcedOrders).some(Boolean)
                ? Object.entries(forcedOrders).map(([src,ord]) => ord ? `${getEnemyInstance(src)?.name||src} → ${ord.kind==="player" ? `Postać ${ord.target+1}` : (getEnemyInstance(ord.target)?.name||ord.target)}` : null).filter(Boolean).join(" | ")
                : "brak"}
            </div>
          </div>
        </div>

        {/* PRAWA KOLUMNA — Atak wroga */}
        <div>
          <h3>4) Atak wroga</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
            <label>Wybrany wróg
              <select value={selectedEnemyId || ""} onChange={(e)=>setSelectedEnemyId(e.target.value)} style={{ marginLeft: 6 }}>
                <option value="">—</option>
                {activeEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>

            <div style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 8 }}>
              <label>Tryb ataku
                <select value={enemyAttackMode} onChange={(e)=>setEnemyAttackMode(e.target.value)} style={{ marginLeft: 6 }}>
                  <option value="weapon">Broń (fizyczny)</option>
                  <option value="spell">Zaklęcie (magiczny)</option>
                </select>
              </label>
            </div>

            {enemyAttackMode === "weapon" ? (
              <>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label>Broń
                    <select value={enemyWeaponChoice} onChange={(e)=>setEnemyWeaponChoice(e.target.value)}>
                      <option value="sword">Miecz krótki (STR)</option>
                      <option value="bow">Łuk (PER)</option>
                      <option value="musket">Muszkiet (PER)</option>
                      <option value="staff">Kij magiczny (MAG)</option>
                    </select>
                  </label>
                  <label>Cel → Postać
                    <select value={enemyTargetPlayer} onChange={(e)=>setEnemyTargetPlayer(Number(e.target.value))}>
                      {sets.map((_, idx)=> <option key={idx} value={idx}>Postać {idx+1}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={doEnemyWeaponAttack}>👹 Atak bronią</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 8 }}>
                  <label>Zaklęcie
                    <select value={enemySpellChoice} onChange={(e)=>setEnemySpellChoice(e.target.value)} style={{ marginLeft: 6 }}>
                      <option value="">—</option>
                      {selectedEnemyId && Object.keys(ENEMY_TYPES[getEnemyInstance(selectedEnemyId).typeId].spells).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label>Cel → Postać
                    <select value={enemyTargetPlayer} onChange={(e)=>setEnemyTargetPlayer(Number(e.target.value))}>
                      {sets.map((_, idx)=> <option key={idx} value={idx}>Postać {idx+1}</option>)}
                    </select>
                  </label>
                  <label>Cel → Wróg
                    <select value={enemyTargetEnemyInst || ""} onChange={(e)=>setEnemyTargetEnemyInst(e.target.value)}>
                      <option value="">—</option>
                      {activeEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ marginTop: 6 }}>
                  <label>AoE: wybierz postaci
                    <select
                      multiple
                      value={enemyAoETargets.map(String)}
                      onChange={(e)=>{
                        const vals = Array.from(e.target.selectedOptions).map(o=>Number(o.value));
                        setEnemyAoETargets(vals);
                      }}
                      style={{ marginLeft: 6, minWidth: 160, height: 70 }}
                    >
                      {sets.map((_, idx)=> <option key={idx} value={idx}>{`Postać ${idx+1}`}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button onClick={doEnemyCastSpell}>🪄 Rzuć zaklęcie</button>
                </div>
              </>
            )}
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
