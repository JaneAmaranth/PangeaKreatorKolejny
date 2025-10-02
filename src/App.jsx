import React, { useState } from "react";

/* ===== Pomocnicze ===== */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const d = (sides) => Math.floor(Math.random() * sides) + 1;

function statMod(value) {
  if (value <= 1) return 0;
  if (value <= 4) return 1;
  if (value <= 7) return 2;
  if (value <= 10) return 3;
  return 4;
}

/* ===== Dane broni ===== */
const weaponData = {
  sword:   { name: "Miecz krótki", stat: "STR", dmgDie: 6, type: "physical" },
  bow:     { name: "Łuk",          stat: "PER", dmgDie: 6, type: "physical" },
  musket:  { name: "Muszkiet",     stat: "PER", dmgDie: 8, type: "physical" }, // zmiana na k8
  staff:   { name: "Kij magiczny", stat: "MAG", dmgDie: 4, type: "physical" }, // trafienie traktowane jak fizyczne
  crossbow:{ name: "Prosta kusza", stat: "PER", dmgDie: 6, type: "physical" }, // nowa
  dagger:  { name: "Sztylet",      stat: "STR", dmgDie: 4, type: "physical" }, // nowa
  fists:   { name: "Pięści",       stat: "STR", dmgDie: 4, type: "physical" }, // nowa
};

/* ===== Zaklęcia graczy ===== */
const SPELLS = {
  "Magiczny pocisk": { key: "missile", cost: 3, dmgDie: 6, needsToHit: true,  type: "damage" },
  "Wybuch energii":  { key: "burst",   cost: 5, dmgDie: 4, needsToHit: true,  type: "damage" },
  "Zasklepienie ran":{ key: "heal",    cost: 5, healDie: 6, needsToHit: false, type: "heal" },
  "Oślepienie":      { key: "blind",   cost: 8, needsToHit: false, type: "effect" },
};

/* ===== Nowe typy wrogów ===== */
const ENEMY_TYPES = {
  elfCultist: {
    key: "elfCultist",
    name: "Elfi Kultysta",
    base: { hp: 45, essence: 20, armor: 4, magicDefense: 4, toHit: 8, defense: 10 },
    // Dostępne zaklęcia dla wroga:
    enemySpells: ["Mroczny Pakt", "Wyssanie życia", "Magiczny pocisk"], // koszty/effecty w enemyCastSpell
  },
  spy: {
    key: "spy",
    name: "Szpieg Magmaratora",
    base: { hp: 30, essence: 20, armor: 2, magicDefense: 2, toHit: 10, defense: 8 },
    enemySpells: ["Magiczny pocisk", "Wybuch energii"],
  },
};

function makeEnemyInstance(type, index) {
  const t = ENEMY_TYPES[type];
  return {
    id: `${type}-${index}`,
    type,
    name: `${t.name} ${index + 1}`,
    hp: t.base.hp,
    maxHp: t.base.hp,
    essence: t.base.essence,
    maxEssence: t.base.essence,
    armor: t.base.armor,
    magicDefense: t.base.magicDefense,
    toHit: t.base.toHit,
    defense: t.base.defense,
    actionsLeft: 2,

    // efekty per instancja
    stun: 0,
    curse: 0, // +3 do progu trafienia (utrudnienie ataku tego wroga)
    defenseDebuff: { value: 0, turns: 0 }, // -X do Obrony przez N tur
    armorDebuff: { factor: 1, turns: 0 },  // ×factor do pancerza przez N tur
    forcedTarget: null, // jednorazowe wymuszenie celu ataku (Dyplomata)
  };
}

/* ===== Dane wyborów postaci ===== */
const RACES = ["Człowiek", "Elf", "Krasnolud", "Faeykai"];
const CLASSES = ["Wojownik", "Łucznik", "Strzelec", "Mag", "Dyplomata"];

/* ===== Komponent ===== */
export default function BattleSimulator() {
  /* --- Stan postaci (4 sloty) --- */
  const makeChar = () => ({
    name: "",
    race: "Człowiek",
    clazz: "Wojownik",

    STR: null, DEX: null, PER: null, MAG: null, CHA: null,
    armor: 0, magicDefense: 0,

    hp: 20, maxHp: 20,
    essence: 20, maxEssence: 20,

    actionsLeft: 2, // 2 akcje na turę

    // RASOWE
    humanCharges: [false, false, false, false, false],
    humanBuff: null, // { type: 'dmg'|'tohit', expiresTurn }
    humanPendingChoice: "dmg",

    elfChargeUsed: false,
    elfChargedTurn: null,

    dwarfPassiveArmed: false,
    dwarfHibernating: false,
    dwarfHibernateTurns: 0,

    faeykaiChargesLeft: 3,
    faeykaiMaskBroken: false,
    faeykaiOutsideHomeland: true,

    effects: [], // np. [{type:"bless", value:3, turnsLeft:3}]

    // KLASOWE — 1×/odp i „ready”
    classUsed: false,
    warriorReady: false,
    archerReady: false,
    shooterReady: false,
    mageReady: false,
    mageShield: 0,
  });

  const [sets, setSets] = useState([makeChar(), makeChar(), makeChar(), makeChar()]);
  const [lockedSets, setLockedSets] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  /* --- Test walki / wpisy --- */
  const [weapon, setWeapon] = useState("sword");
  const [selectedSpellName, setSelectedSpellName] = useState("Magiczny pocisk");
  const [healTarget, setHealTarget] = useState(0);

  // Dyplomata: wybór wroga (instancja) i celu
  const [diploEnemyId, setDiploEnemyId] = useState(null);
  const [diploTarget, setDiploTarget] = useState(0);

  // Revive dropdown per postać
  const [reviveTargetIndex, setReviveTargetIndex] = useState([null, null, null, null]);

  const [turn, setTurn] = useState(1);

  const [log, setLog] = useState([]);
  const addLog = (line) => {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [`[${t}] ${line}`, ...prev]);
  };

  /* ====== ENEMIES: dynamiczne instancje ====== */
  const [enemies, setEnemies] = useState([]);
  const [newEnemyType, setNewEnemyType] = useState("elfCultist");
  const [newEnemyCount, setNewEnemyCount] = useState(1);
  const [chosenEnemyId, setChosenEnemyId] = useState(null);

  const addEnemies = () => {
    setEnemies((prev) => {
      const existingCount = prev.filter(e => e.type === newEnemyType).length;
      const added = Array.from({ length: newEnemyCount }, (_, i) =>
        makeEnemyInstance(newEnemyType, existingCount + i)
      );
      // jeśli nie ma jeszcze wybranego celu – ustaw pierwszy dodany
      const next = [...prev, ...added];
      if (!chosenEnemyId && next.length) setChosenEnemyId(next[0].id);
      return next;
    });
    addLog(`➕ Dodano ${newEnemyCount}x ${ENEMY_TYPES[newEnemyType].name}.`);
  };

  const getEnemy = (id) => enemies.find(e => e.id === id);

  const effectiveEnemyDefense = (id) => {
    const e = getEnemy(id);
    if (!e) return 0;
    return Math.max(0, e.defense - (e.defenseDebuff?.value || 0));
  };

  const effectiveEnemyArmor = (id) => {
    const e = getEnemy(id);
    if (!e) return 0;
    return Math.max(0, Math.floor(e.armor * (e.armorDebuff?.factor || 1)));
  };

  const damageEnemy = (id, dmg) => {
    if (dmg <= 0) return;
    setEnemies((prev) =>
      prev.map(e =>
        e.id === id ? { ...e, hp: Math.max(0, e.hp - dmg) } : e
      )
    );
    const e = getEnemy(id);
    addLog(`💔 ${(e?.name) || id} otrzymuje ${dmg} obrażeń.`);
  };

  const resetAllEnemyEffects = () => {
    setEnemies(prev => prev.map(e => ({
      ...e,
      stun: 0,
      curse: 0,
      defenseDebuff: { value: 0, turns: 0 },
      armorDebuff: { factor: 1, turns: 0 },
      forcedTarget: null,
    })));
    addLog("🧹 Zresetowano efekty na wszystkich wrogach (ogłuszenia, przekleństwa, debuffy, wymuszenia).");
  };

  /* ====== Pomocnicze mutatory ====== */
  const updateSetField = (i, key, val) => {
    setSets((prev) => {
      const next = [...prev];
      const parsed = ["name","race","clazz","humanPendingChoice"].includes(key)
        ? val
        : (val === "" ? null : Number(val));
      next[i] = { ...next[i], [key]: parsed };
      if (key === "hp" && next[i].race === "Faeykai") {
        const s = next[i];
        const thresh = Math.ceil((s.maxHp || 20) * 0.1);
        if ((s.hp || 0) < thresh) next[i].faeykaiMaskBroken = true;
      }
      return next;
    });
  };

  const getActiveStats = () => sets[activeSet];

  const lockSet = (i) => {
    const s = sets[i];
    const required = ["STR", "DEX", "PER", "MAG", "CHA"].every((k) => s[k] !== null && s[k] !== "");
    if (!required) {
      addLog(`❌ Postać ${i + 1}: uzupełnij wszystkie podstawowe statystyki.`);
      return;
    }
    setLockedSets((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    addLog(`✔️ Postać ${i + 1} (${s.name || `Postać ${i + 1}`}) zatwierdzona.`);
  };

  const setActiveEssence = (newVal) => {
    setSets((prev) => {
      const next = [...prev];
      const maxE = next[activeSet].maxEssence ?? 20;
      next[activeSet] = { ...next[activeSet], essence: clamp(newVal, 0, maxE) };
      return next;
    });
  };

  const spendAction = (i) => {
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

  /* ===== RASOWE ===== */
  const useHumanCharge = (i, idx) => {
    const c = sets[i];
    if (c.race !== "Człowiek") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (c.humanCharges[idx]) return;

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      const charges = [...me.humanCharges];
      charges[idx] = true;
      me.humanCharges = charges;

      const buffType = me.humanPendingChoice; // 'dmg'|'tohit'|'hp'
      if (buffType === "hp") {
        me.hp = Math.min(me.maxHp ?? 20, (me.hp ?? 0) + 2);
        addLog(`🧬 Człowiek (Postać ${i + 1}): natychmiastowe +2 HP.`);
      } else {
        me.humanBuff = { type: buffType, expiresTurn: turn };
        addLog(`🧬 Człowiek (Postać ${i + 1}): buff ${buffType === "dmg" ? "+2 obrażenia" : "+2 do trafienia"} do końca tury.`);
      }
      me.actionsLeft = (me.actionsLeft || 0) - 1;
      next[i] = me;
      return next;
    });
  };

  const useElfCharge = (i) => {
    const c = sets[i];
    if (c.race !== "Elf") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (c.elfChargeUsed) return;

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.elfChargeUsed = true;
      me.elfChargedTurn = turn;
      me.actionsLeft = (me.actionsLeft || 0) - 1;
      next[i] = me;
      return next;
    });
    addLog(`🌪️ Elf (Postać ${i + 1}) kumuluje energię — eksplozja nastąpi na początku kolejnej tury.`);
  };

  const armDwarfHibernate = (i) => {
    const c = sets[i];
    if (c.race !== "Krasnolud") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (c.dwarfPassiveArmed) return;

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.dwarfPassiveArmed = true;
      me.actionsLeft = (me.actionsLeft || 0) - 1;
      next[i] = me;
      return next;
    });
    addLog(`⛏️ Krasnolud (Postać ${i + 1}): hibernacja uzbrojona (zadziała przy spadku do 0 HP).`);
  };

  const useFaeykaiBless = (i, targetIndex) => {
    const c = sets[i];
    if (c.race !== "Faeykai") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if ((c.faeykaiChargesLeft || 0) <= 0) return addLog("❌ Brak ładunków Faeykai.");

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      const target = { ...next[targetIndex] };

      target.effects = [...(target.effects || []), { type: "bless", value: 3, turnsLeft: 3 }];
      me.faeykaiChargesLeft = (me.faeykaiChargesLeft || 0) - 1;
      me.actionsLeft = (me.actionsLeft || 0) - 1;

      next[i] = me;
      next[targetIndex] = target;
      return next;
    });
    addLog(`🌿 Faeykai (Postać ${i + 1}): błogosławieństwo dla Postaci ${targetIndex + 1} (+3 HP/ turę przez 3 tury).`);
  };

  const useFaeykaiCurse = (i, enemyId) => {
    const c = sets[i];
    if (c.race !== "Faeykai") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if ((c.faeykaiChargesLeft || 0) <= 0) return addLog("❌ Brak ładunków Faeykai.");

    setEnemies((prev) => prev.map(e => e.id === enemyId ? { ...e, curse: Math.max(e.curse, 3) } : e));
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.faeykaiChargesLeft = (me.faeykaiChargesLeft || 0) - 1;
      me.actionsLeft = (me.actionsLeft || 0) - 1;
      next[i] = me;
      return next;
    });
    const en = getEnemy(enemyId);
    addLog(`🕯️ Faeykai (Postać ${i + 1}): przekleństwo na wroga ${(en?.name)||enemyId} (−3 do trafienia przez 3 tury).`);
  };

  /* ===== KLASOWE: aktywacje ===== */
const useClassPower = (i) => {
  const c = sets[i];
  if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
  if (c.classUsed) return addLog("❌ Umiejętność klasowa już użyta w tym odpoczynku.");

  if (c.clazz === "Wojownik") {
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.classUsed = true;
      me.warriorReady = true;
      me.actionsLeft -= 1;
      next[i] = me;
      return next;
    });
    addLog(`🎖️ Wojownik (Postać ${i + 1}): przygotował „maksymalny cios”.`);
    return;
  }

  if (c.clazz === "Łucznik") {
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.classUsed = true;
      me.archerReady = true;
      me.actionsLeft -= 1;
      next[i] = me;
      return next;
    });
    addLog(`🏹 Łucznik (Postać ${i + 1}): „celny strzał” — po następnym trafieniu łukiem Obrona celu −5 (3 tury).`);
    return;
  }

  if (c.clazz === "Strzelec") {
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.classUsed = true;
      me.shooterReady = true;
      me.actionsLeft -= 1;
      next[i] = me;
      return next;
    });
    addLog(`🔫 Strzelec (Postać ${i + 1}): „druzgocący strzał” — po następnym trafieniu muszkietem pancerz celu ×0.5 (3 tury).`);
    return;
  }

  if (c.clazz === "Mag") {
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.classUsed = true;
      me.mageReady = true;
      me.actionsLeft -= 1;
      next[i] = me;
      return next;
    });
    addLog(`🔮 Mag (Postać ${i + 1}): „tarcza” — po następnym czarze z obrażeniami tarcza = 50% zadanych obrażeń.`);
    return;
  }

  if (c.clazz === "Dyplomata") {
    // 🔹 teraz Dyplomata wybiera wroga i zmusza go do zaatakowania innego wroga
    if (!diploEnemyId || !diploTarget) return addLog("❌ Wybierz wroga i cel (innego wroga).");

    setEnemies(prev => prev.map(e => 
      e.id === diploEnemyId 
        ? { ...e, forcedTarget: { type: "enemy", value: diploTarget } } // 🔹
        : e
    ));

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.classUsed = true;
      me.actionsLeft -= 1;
      next[i] = me;
      return next;
    });

    const en = getEnemy(diploEnemyId);
    const targetEn = getEnemy(diploTarget);
    addLog(`🗣️ Dyplomata (Postać ${i + 1}) zmusza ${en?.name || diploEnemyId} do zaatakowania ${targetEn?.name || diploTarget} przy jego następnym ataku.`);
    return;
  }
};


  /* ===== WALKA: Atak fizyczny (GRACZ) ===== */
  const doAttack = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");
    if (!chosenEnemyId) return addLog("❌ Wybierz cel (wroga).");

    const w = weaponData[weapon];
    const e = getEnemy(chosenEnemyId);
    if (!e) return addLog("❌ Nie znaleziono wybranego wroga.");

    const statVal = Number(c[w.stat] ?? 0);
    const humanToHitBonus = c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? 2 : 0;

    // Wojownik: maksymalny cios
    if (c.clazz === "Wojownik" && c.warriorReady && w.type === "physical") {
      const maxDmg = w.dmgDie;
      addLog(`💥 Wojownik (maksymalny cios): auto-trafienie, brak obrony/pancerza. Obrażenia = k${w.dmgDie} max (${maxDmg}).`);
      spendAction(activeSet);
      setSets((prev) => {
        const next = [...prev];
        next[activeSet] = { ...next[activeSet], warriorReady: false };
        return next;
      });
      damageEnemy(chosenEnemyId, maxDmg);
      return;
    }

    const effDefense = effectiveEnemyDefense(chosenEnemyId);
    const roll20 = d(20);
    const toHit = roll20 + statVal + humanToHitBonus;
    const hit = toHit >= effDefense;

    addLog(
      `⚔️ Atak (${w.name}) — k20=${roll20} + ${w.stat}(${statVal})` +
      (humanToHitBonus ? ` + human(+2)` : "") +
      ` = ${toHit} vs Obrona ${effDefense} → ${hit ? "✅" : "❌"}`
    );

    spendAction(activeSet);
    if (!hit) return;

    // obrażenia
    const rawDie = d(w.dmgDie);
    const humanDmgBonus = c.race === "Człowiek" && c.humanBuff?.type === "dmg" ? 2 : 0;
    const raw = rawDie + humanDmgBonus;
    const effArmor = effectiveEnemyArmor(chosenEnemyId);
    const afterArmor = Math.max(0, raw - effArmor);

    addLog(
      `🗡️ Obrażenia: k${w.dmgDie}=${rawDie}` +
      (humanDmgBonus ? ` + human(+2)` : "") +
      ` = ${raw} − Pancerz(${effArmor}) = ${afterArmor}`
    );

    // Łucznik debuff
    if (c.clazz === "Łucznik" && c.archerReady && weapon === "bow") {
      setEnemies(prev => prev.map(en => en.id === chosenEnemyId ? { ...en, defenseDebuff: { value: 5, turns: 3 } } : en));
      setSets(prev => {
        const next = [...prev];
        next[activeSet] = { ...next[activeSet], archerReady: false };
        return next;
      });
      addLog(`🏹 Debuff: Obrona celu −5 na 3 tury.`);
    }

    // Strzelec debuff
    if (c.clazz === "Strzelec" && c.shooterReady && weapon === "musket") {
      setEnemies(prev => prev.map(en => en.id === chosenEnemyId ? { ...en, armorDebuff: { factor: 0.5, turns: 3 } } : en));
      setSets(prev => {
        const next = [...prev];
        next[activeSet] = { ...next[activeSet], shooterReady: false };
        return next;
      });
      addLog(`🔧 Debuff: Pancerz celu ×0.5 na 3 tury.`);
    }

    damageEnemy(chosenEnemyId, afterArmor);
  };

  /* ===== ZAKLĘCIA (GRACZ) ===== */
  const castSelectedSpell = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");

    const spell = SPELLS[selectedSpellName];
    if (!spell) return;

    if (spell.type !== "heal" && !chosenEnemyId) return addLog("❌ Wybierz cel (wroga).");

    if (c.essence < spell.cost) return addLog(`❌ Esencja: ${c.essence} < koszt ${spell.cost}.`);

    const MAG = Number(c.MAG ?? 0);
    const faeykaiPenalty = c.race === "Faeykai" && c.faeykaiOutsideHomeland && c.faeykaiMaskBroken ? 5 : 0;

    let lines = [`✨ „${selectedSpellName}” — koszt ${spell.cost} (Esencja przed: ${c.essence})`];
    setActiveEssence(c.essence - spell.cost);
    spendAction(activeSet);

    if (spell.type === "damage") {
      const e = getEnemy(chosenEnemyId);
      if (!e) return addLog("❌ Nie znaleziono celu.");

      const roll20 = d(20);
      const effDefense = effectiveEnemyDefense(chosenEnemyId);
      const toHit = roll20 + MAG - faeykaiPenalty + (c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? 2 : 0);
      const hit = toHit >= effDefense;
      lines.push(
        `🎯 Trafienie: k20=${roll20} + MAG(${MAG})` +
        (faeykaiPenalty ? ` − Faeykai(−5)` : "") +
        (c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? ` + human(+2)` : "") +
        ` = ${toHit} vs Obrona ${effDefense} → ${hit ? "✅" : "❌"}`
      );
      if (!hit) return addLog(lines.join("\n"));

      const rollDmg = d(spell.dmgDie);
      const mod = statMod(MAG);
      const humanDmgBonus = c.race === "Człowiek" && c.humanBuff?.type === "dmg" ? 2 : 0;
      const raw = rollDmg + mod + humanDmgBonus;
      const reduced = Math.max(0, raw - Number(e.magicDefense));
      lines.push(
        `💥 Obrażenia: k${spell.dmgDie}=${rollDmg} + mod(MAG)=${mod}` +
        (humanDmgBonus ? ` + human(+2)` : "") +
        ` = ${raw}`
      );
      lines.push(`🛡️ Redukcja magią (cel): −${e.magicDefense} → ${reduced}`);
      addLog(lines.join("\n"));

      // Mag: tarcza po czarze
      if (c.clazz === "Mag" && c.mageReady && reduced > 0) {
        const shield = Math.floor(reduced * 0.5);
        setSets((prev) => {
          const next = [...prev];
          next[activeSet] = { ...next[activeSet], mageReady: false, mageShield: shield };
          return next;
        });
        addLog(`🛡️ Tarcza Maga aktywna: ${shield}.`);
      }

      damageEnemy(chosenEnemyId, reduced);
      return;
    }

    if (spell.type === "heal") {
      const rollHeal = d(spell.healDie);
      setSets((prev) => {
        const next = [...prev];
        const target = { ...next[healTarget] };
        target.hp = Math.min(target.maxHp ?? 20, (target.hp ?? 0) + rollHeal);
        next[healTarget] = target;
        return next;
      });
      lines.push(
        `💚 Leczenie: k${spell.healDie}=${rollHeal} → ` +
        `${sets[activeSet].name || `Postać ${activeSet + 1}`} leczy ` +
        `${sets[healTarget].name || `Postać ${healTarget + 1}`} o +${rollHeal} HP`
      );
      addLog(lines.join("\n"));
      return;
    }

    addLog(lines.concat("🌑 Efekt zaklęcia zastosowany.").join("\n"));
  };

  /* ===== ATAK WROGA (broń) ===== */
const enemyAttack = (enemyId, targetIndex, weaponKey) => {
  const e = getEnemy(enemyId);
  if (!e) return addLog("❌ Nie znaleziono wroga.");
  if (e.actionsLeft <= 0) return addLog(`❌ ${e.name} nie ma akcji.`);

  // 🔹 sprawdzamy, czy Dyplomata zmusił go do ataku
  if (e.forcedTarget) {
    if (e.forcedTarget.type === "enemy") {
      const victim = getEnemy(e.forcedTarget.value);
      if (!victim) return addLog("❌ Cel (wróg) nie istnieje.");

      const w = weaponData[weaponKey];
      const roll20 = d(20);
      const toHit = roll20 + e.toHit;
      const effDefense = effectiveEnemyDefense(victim.id);
      const hit = toHit >= effDefense;

      addLog(`🤺 ${e.name} (wymuszony) atakuje ${victim.name} → k20=${roll20}+${e.toHit} = ${toHit} vs Obrona ${effDefense} → ${hit ? "✅" : "❌"}`);

      setEnemies(prev => prev.map(x => x.id === e.id ? { ...x, actionsLeft: x.actionsLeft - 1, forcedTarget: null } : x));

      if (hit) {
        const raw = d(w.dmgDie);
        const dmg = Math.max(0, raw - effectiveEnemyArmor(victim.id));
        addLog(`💥 Obrażenia: k${w.dmgDie}=${raw} − pancerz(${effectiveEnemyArmor(victim.id)}) = ${dmg}`);
        damageEnemy(victim.id, dmg);
      }
      return;
    }
  }

  // 🔹 standardowy atak na gracza (jak wcześniej)
  const overriddenTarget = targetIndex;
  if (e.stun > 0) {
    addLog(`🌀 ${e.name} jest ogłuszony (pozostało ${e.stun} tur).`);
    return;
  }

  const w = weaponData[weaponKey];
  const roll20 = d(20);
  const needDelta = (e.curse > 0 ? 3 : 0);
  const toHit = roll20 + e.toHit - needDelta;

  const target = sets[overriddenTarget];
  if (!target) return addLog("❌ Brak celu (postać).");

  const defenseThreshold = 10 + (Number(target.DEX ?? 0));
  const hit = toHit >= defenseThreshold;

  addLog(
    `👹 ${e.name} atakuje (${w.name}) → k20=${roll20} + toHit(${e.toHit})` +
    (needDelta ? ` − przeklęstwo(${needDelta})` : "") +
    ` = ${toHit} vs próg ${defenseThreshold} → ${hit ? "✅" : "❌"}`
  );

  setEnemies(prev => prev.map(x => x.id === e.id ? { ...x, actionsLeft: x.actionsLeft - 1, forcedTarget: null } : x));
  if (!hit) return;

  let incoming = d(w.dmgDie);
  addLog(`💥 Rzut obrażeń: k${w.dmgDie}=${incoming}`);

  if (target.dwarfHibernating) {
    addLog(`🛌 Postać ${overriddenTarget + 1} hibernuje — obrażenia zignorowane.`);
    return;
  }

  incoming = Math.max(0, incoming - Number(target.armor || 0));
  let reflected = 0;

  setSets(prev => prev.map((c, i) => {
    if (i !== overriddenTarget) return c;
    let useShield = 0;
    if ((c.mageShield || 0) > 0 && incoming > 0) {
      useShield = Math.min(c.mageShield, incoming);
      reflected = useShield;
      incoming = Math.max(0, incoming - useShield);
    }
    const before = c.hp;
    let hp = Math.max(0, before - incoming);
    if (c.race === "Faeykai") {
      const thresh = Math.ceil((c.maxHp || 20) * 0.1);
      if (hp < thresh) c.faeykaiMaskBroken = true;
    }
    if (c.race === "Krasnolud" && c.dwarfPassiveArmed && before > 0 && hp <= 0) {
      hp = 0;
      return { ...c, hp, dwarfHibernating: true, dwarfHibernateTurns: 2, mageShield: Math.max(0, (c.mageShield||0) - useShield) };
    }
    return { ...c, hp, mageShield: Math.max(0, (c.mageShield||0) - useShield) };
  }));

  if (reflected > 0) {
    damageEnemy(e.id, reflected);
    addLog(`🔮 Tarcza Maga odbija ${reflected} do ${e.name}.`);
  }
  if (incoming > 0) addLog(`❤️ Postać ${overriddenTarget + 1} otrzymuje ${incoming} obrażeń po pancerzu.`);
};


  /* ===== ZAKLĘCIA WROGÓW =====
     - Wszystkie to ataki magiczne (redukcja Obr.magią celu)
     - Koszty / działanie wg specyfikacji
  */
  const enemyCastSpell = (enemyId, spellName, targetIndexes) => {
    const e = getEnemy(enemyId);
    if (!e) return;
    if (e.actionsLeft <= 0) return addLog(`❌ ${e.name} brak akcji.`);
    if (e.stun > 0) {
      addLog(`🌀 ${e.name} jest ogłuszony i nie może czarować (pozostało ${e.stun} tur).`);
      return;
    }

    // koszty wg specyfikacji
    const costs = {
      "Mroczny Pakt": 2,
      "Wyssanie życia": 5,
      "Magiczny pocisk": 3,
      "Wybuch energii": 5,
    };
    const cost = costs[spellName] || 0;
    if (e.essence < cost) return addLog(`❌ ${e.name} nie ma esencji (${e.essence}/${cost}).`);

    // zużyj akcję i esencję
    setEnemies(prev => prev.map(x => x.id === e.id ? { ...x, essence: x.essence - cost, actionsLeft: x.actionsLeft - 1 } : x));

    // helper: zadaj magiczne obrażenia pojedynczemu celowi (postać)
    const magicDamageToChar = (charIndex, dmg) => {
      setSets(prev => prev.map((c, i) => {
        if (i !== charIndex) return c;
        // redukcja obroną magii postaci
        const reduced = Math.max(0, dmg - Number(c.magicDefense || 0));
        let hp = Math.max(0, (c.hp || 0) - reduced);

        // Faeykai maska
        if (c.race === "Faeykai") {
          const thresh = Math.ceil((c.maxHp || 20) * 0.1);
          if (hp < thresh) c.faeykaiMaskBroken = true;
        }

        return { ...c, hp };
      }));
    };

    if (e.type === "elfCultist") {
      if (spellName === "Mroczny Pakt") {
        // cel może być wróg lub gracz – w UI dajemy targetIndexes jako [indexGracza] (w tej wersji: gracz)
        const t = targetIndexes?.[0] ?? 0;
        magicDamageToChar(t, 4);
        // +4 do Trafienia dla celu (buff na 3 tury)
        setSets(prev => prev.map((c, i) => i === t ? { ...c, effects: [...(c.effects||[]), { type:"buffHit", value:4, turnsLeft:3 }] } : c));
        addLog(`🕯️ ${e.name} rzuca Mroczny Pakt → Postać ${t+1}: -4 HP, +4 Trafienie (3 tury).`);
        return;
      }
      if (spellName === "Wyssanie życia") {
        const t = targetIndexes?.[0] ?? 0;
        magicDamageToChar(t, 5);
        setEnemies(prev => prev.map(x => x.id === e.id ? { ...x, hp: Math.min(x.maxHp, x.hp + 5) } : x));
        addLog(`🩸 ${e.name} wyssał życie → Postać ${t+1}: -5 HP, ${e.name} +5 HP.`);
        return;
      }
      if (spellName === "Magiczny pocisk") {
        const t = targetIndexes?.[0] ?? 0;
        const roll = d(6);
        magicDamageToChar(t, roll);
        addLog(`✨ ${e.name} rzuca Magiczny pocisk → Postać ${t+1}: -${roll} HP (magia).`);
        return;
      }
    }

    if (e.type === "spy") {
      if (spellName === "Magiczny pocisk") {
        const t = targetIndexes?.[0] ?? 0;
        const roll = d(6);
        magicDamageToChar(t, roll);
        addLog(`✨ ${e.name} rzuca Magiczny pocisk → Postać ${t+1}: -${roll} HP (magia).`);
        return;
      }
      if (spellName === "Wybuch energii") {
        // obszarowe: można wybrać kilka celów; jeśli brak, trafia wszystkich graczy
        const targets = (targetIndexes && targetIndexes.length) ? targetIndexes : [0,1,2,3].filter(i => sets[i]);
        const roll = d(4);
        targets.forEach(idx => magicDamageToChar(idx, roll));
        addLog(`💥 ${e.name} rzuca Wybuch energii → Postacie ${targets.map(i=>i+1).join(", ")}: -${roll} HP (magia).`);
        return;
      }
    }

    addLog(`🤔 ${e.name} próbuje rzucić nieznane zaklęcie: ${spellName}.`);
  };

  /* ===== PODNIEŚ SOJUSZNIKA ===== */
  const reviveAlly = (casterIndex, targetIndex) => {
    if (targetIndex == null) return addLog("❌ Wybierz sojusznika do podniesienia.");
    const caster = sets[casterIndex];
    const target = sets[targetIndex];

    if ((caster.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (!lockedSets[casterIndex]) return addLog("❌ Najpierw zatwierdź postać wykonującą akcję.");
    if (!target || (target.hp ?? 0) > 0) return addLog("❌ Wybrana postać nie jest na 0 HP.");

    spendAction(casterIndex);

    const healValue = Math.floor((target.maxHp || 20) * 0.25);
    setSets((prev) => {
      const next = [...prev];
      const t = { ...next[targetIndex] };
      t.hp = healValue;
      t.dwarfHibernating = false;
      t.dwarfHibernateTurns = 0;
      next[targetIndex] = t;
      return next;
    });

    addLog(`🛡️ Postać ${casterIndex + 1} podniosła Postać ${targetIndex + 1} → HP = ${healValue} (25% maks).`);

    setReviveTargetIndex((prev) => {
      const next = [...prev];
      next[casterIndex] = null;
      return next;
    });
  };

  /* ===== TURY ===== */
  const nextTurn = () => {
    // Postacie
    setSets((prev) => {
      const next = prev.map((c, idx) => {
        const me = { ...c };

        // odśwież akcje
        me.actionsLeft = 2;

        // Człowiek — buff wygasa
        if (me.humanBuff && me.humanBuff.expiresTurn < turn + 1) {
          me.humanBuff = null;
        }

        // Elf: eksplozja jeśli ładował turę temu
        if (me.race === "Elf" && me.elfChargeUsed && me.elfChargedTurn === turn) {
          const before = me.hp || 0;
          me.hp = Math.max(0, before - 5);
          addLog(`🌩️ Elf (Postać ${idx + 1}) — eksplozja: −5 HP dla elfa, wszyscy wrogowie −10 HP + ogłuszenie 1 turę.`);

          setEnemies((prevEnemies) => prevEnemies.map(en => ({ ...en, hp: Math.max(0, en.hp - 10), stun: Math.max(en.stun, 1) })));

          me.elfChargeUsed = false;
          me.elfChargedTurn = null;
        }

        // Regeneracje/błogosławieństwa
        if (me.effects && me.effects.length) {
          me.effects = me.effects
            .map((ef) => {
              if (ef.type === "bless" && ef.turnsLeft > 0) {
                me.hp = Math.min(me.maxHp ?? 20, (me.hp ?? 0) + (ef.value || 0));
                return { ...ef, turnsLeft: ef.turnsLeft - 1 };
              }
              if (ef.type === "buffHit" && ef.turnsLeft > 0) {
                return { ...ef, turnsLeft: ef.turnsLeft - 1 };
              }
              return { ...ef, turnsLeft: ef.turnsLeft - 1 };
            })
            .filter((ef) => ef.turnsLeft > 0);
        }

        // Krasnolud: hibernacja tic
        if (me.dwarfHibernating) {
          me.dwarfHibernateTurns = Math.max(0, (me.dwarfHibernateTurns || 0) - 1);
          if (me.dwarfHibernateTurns === 0) {
            me.dwarfHibernating = false;
            addLog(`⛏️ Krasnolud (Postać ${idx + 1}) kończy hibernację.`);
          }
        }

        // Faeykai maska
        if (me.race === "Faeykai") {
          const thresh = Math.ceil((me.maxHp || 20) * 0.1);
          if ((me.hp || 0) < thresh) me.faeykaiMaskBroken = true;
        }

        return me;
      });

      return next;
    });

    // Wrogowie — odśwież akcje, obniż timery
    setEnemies(prev => prev.map(e => {
      const defDeb = e.defenseDebuff?.turns > 0 ? { value: e.defenseDebuff.value, turns: e.defenseDebuff.turns - 1 } : { value: 0, turns: 0 };
      const armDeb = e.armorDebuff?.turns > 0 ? { factor: e.armorDebuff.factor, turns: e.armorDebuff.turns - 1 } : { factor: 1, turns: 0 };
      return {
        ...e,
        actionsLeft: 2,
        stun: Math.max(0, e.stun - 1),
        curse: Math.max(0, e.curse - 1),
        defenseDebuff: defDeb,
        armorDebuff: armDeb,
      };
    }));

    setTurn((t) => t + 1);
    addLog(`⏱️ Rozpoczyna się tura ${turn + 1}.`);
  };

  /* ===== UI ===== */
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>🕒 Tura: {turn}</h2>
        <button onClick={nextTurn}>➡️ Następna tura</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
        {/* LEWA KOLUMNA — POSTACIE + TEST WALKI */}
        <div>
          <h3>1) Statystyki postaci</h3>
          {sets.map((set, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong>Postać {i + 1}</strong>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="activeSet" checked={activeSet === i} onChange={() => setActiveSet(i)} />
                  Aktywna
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 6 }}>
                <label>Imię <input value={set.name || ""} onChange={(e) => updateSetField(i, "name", e.target.value)} /></label>
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
                <label>Akcje (na tę turę) <input type="number" value={set.actionsLeft ?? 0} readOnly /></label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 6 }}>
                {["STR","DEX","PER","MAG","CHA"].map((k) => (
                  <label key={k}>{k}
                    <input type="number" value={set[k] ?? ""} onChange={(e)=>updateSetField(i,k,e.target.value)} disabled={lockedSets[i]} />
                    <small>mod: {set[k] != null ? statMod(Number(set[k])) : "-"}</small>
                  </label>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 6 }}>
                <label>HP <input type="number" value={set.hp ?? 0} onChange={(e)=>updateSetField(i,"hp",e.target.value)} /></label>
                <label>Max HP <input type="number" value={set.maxHp ?? 20} onChange={(e)=>updateSetField(i,"maxHp",e.target.value)} /></label>
                <label>Esencja <input type="number" value={set.essence ?? 0} onChange={(e)=>updateSetField(i,"essence",e.target.value)} /></label>
                <label>Max Esencja <input type="number" value={set.maxEssence ?? 20} onChange={(e)=>updateSetField(i,"maxEssence",e.target.value)} /></label>
                <label>Pancerz <input type="number" value={set.armor ?? 0} onChange={(e)=>updateSetField(i,"armor",e.target.value)} /></label>
                <label>Obrona magii <input type="number" value={set.magicDefense ?? 0} onChange={(e)=>updateSetField(i,"magicDefense",e.target.value)} /></label>
              </div>

              {/* RASOWE UI */}
              <div style={{ marginTop: 8, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
                {set.race === "Człowiek" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <strong>Rasowe (Człowiek):</strong>
                      <select value={set.humanPendingChoice} onChange={(e)=>updateSetField(i, "humanPendingChoice", e.target.value)}>
                        <option value="dmg">+2 do obrażeń (do końca tury)</option>
                        <option value="tohit">+2 do trafienia (do końca tury)</option>
                        <option value="hp">+2 HP natychmiast</option>
                      </select>
                      <small>5×/odpoczynek</small>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {set.humanCharges.map((used, idx) => (
                        <button
                          key={idx}
                          onClick={() => useHumanCharge(i, idx)}
                          style={{
                            width: 18, height: 18, borderRadius: 3, border: "1px solid #555",
                            background: used ? "#e74c3c" : "#2ecc71", cursor: used ? "not-allowed" : "pointer"
                          }}
                          title={used ? "Zużyte" : "Użyj (1 akcja)"}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {set.race === "Elf" && (
                  <div>
                    <strong>Rasowe (Elf):</strong> 1×/odp. Ładowanie → następna tura: eksplozja.
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button
                        onClick={() => useElfCharge(i)}
                        disabled={set.elfChargeUsed}
                        style={{ padding: "2px 8px", background: set.elfChargeUsed ? "#e74c3c" : "#2ecc71" }}
                        title="1 akcja"
                      >
                        {set.elfChargeUsed ? "Naładowane" : "Ładuj energię"}
                      </button>
                      {set.elfChargeUsed && <span>⚡ eksplozja w nast. turze</span>}
                    </div>
                  </div>
                )}

                {set.race === "Krasnolud" && (
                  <div>
                    <strong>Rasowe (Krasnolud):</strong> 1×/odp. Hibernacja po spadku do 0 HP (2 tury niewrażliwy).
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button
                        onClick={() => armDwarfHibernate(i)}
                        disabled={set.dwarfPassiveArmed}
                        style={{ padding: "2px 8px", background: set.dwarfPassiveArmed ? "#e74c3c" : "#2ecc71" }}
                        title="1 akcja"
                      >
                        {set.dwarfPassiveArmed ? "Uzbrojone" : "Uzbrój hibernację"}
                      </button>
                      {set.dwarfHibernating && <span>🛌 Hibernacja: {set.dwarfHibernateTurns} t.</span>}
                    </div>
                  </div>
                )}

                {set.race === "Faeykai" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <strong>Rasowe (Faeykai):</strong>
                      <span>Pozostało: {set.faeykaiChargesLeft}</span>
                      <span>Maska: {set.faeykaiMaskBroken ? "❌ pęknięta" : "✅ ok"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          const raw = prompt("Podaj numer Postaci 1-4 (błogosławieństwo +3 HP/3 tury):");
                          const tIdx = Number(raw) - 1;
                          if (tIdx >= 0 && tIdx < sets.length) useFaeykaiBless(i, tIdx);
                        }}
                        disabled={(set.faeykaiChargesLeft || 0) <= 0}
                        title="1 akcja"
                      >
                        🌿 Rzuć błogosławieństwo
                      </button>
                      <button
                        onClick={() => {
                          if (!enemies.length) return alert("Najpierw dodaj wrogów.");
                          const id = prompt(`Podaj ID wroga (np. ${enemies.map(e=>e.id).join(", ")}):`);
                          if (id && enemies.some(e=>e.id===id)) useFaeykaiCurse(i, id);
                        }}
                        disabled={(set.faeykaiChargesLeft || 0) <= 0}
                        title="1 akcja"
                      >
                        🕯️ Rzuć przekleństwo (na wroga)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* KLASOWE */}
              <div style={{ marginTop: 8, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
                <strong>Umiejętność klasowa (1×/odp):</strong>
{set.clazz === "Dyplomata" && (
  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
    <label>Wróg (którego zmuszasz):
      <select value={diploEnemyId || ""} onChange={(e)=>setDiploEnemyId(e.target.value || null)}>
        <option value="">—</option>
        {enemies.map((en)=> <option key={en.id} value={en.id}>{en.name}</option>)}
      </select>
    </label>
    <label>Cel ataku (inny wróg):
      <select value={diploTarget || ""} onChange={(e)=>setDiploTarget(e.target.value || null)}>
        <option value="">—</option>
        {enemies
          .filter(en => en.id !== diploEnemyId) // 🔹 nie pozwalamy wybrać samego siebie
          .map((en)=> <option key={en.id} value={en.id}>{en.name}</option>)}
      </select>
    </label>
  </div>
)}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => useClassPower(i)} disabled={set.classUsed} title="1 akcja">
                    {set.classUsed ? "Użyto" : `Użyj (${set.clazz})`}
                  </button>
                  {set.warriorReady && <span style={{ marginLeft: 8 }}>🗡️ Wojownik: maks. cios gotowy</span>}
                  {set.archerReady && <span style={{ marginLeft: 8 }}>🏹 Łucznik: celny strzał gotowy</span>}
                  {set.shooterReady && <span style={{ marginLeft: 8 }}>🔫 Strzelec: druzgocący strzał gotowy</span>}
                  {set.mageReady && <span style={{ marginLeft: 8 }}>🔮 Mag: tarcza po nast. czarze</span>}
                  {set.mageShield > 0 && <span style={{ marginLeft: 8 }}>🛡️ Tarcza: {set.mageShield}</span>}
                </div>
              </div>

              {/* PODNIEŚ SOJUSZNIKA */}
              <div style={{ marginTop: 8, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
                <strong>Podnieś sojusznika (1 akcja):</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <label>
                    Wybierz:
                    <select
                      value={reviveTargetIndex[i] ?? ""}
                      onChange={(e)=>setReviveTargetIndex(prev=>{
                        const nxt = [...prev];
                        nxt[i] = e.target.value === "" ? null : Number(e.target.value);
                        return nxt;
                      })}
                      style={{ marginLeft: 6 }}
                    >
                      <option value="">—</option>
                      {sets.map((s, idx)=>(
                        (idx !== i && (s.hp ?? 0) <= 0) ? <option key={idx} value={idx}>Postać {idx+1}</option> : null
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={()=>reviveAlly(i, reviveTargetIndex[i])}
                    disabled={reviveTargetIndex[i]==null}
                  >
                    🛡️ Podnieś
                  </button>
                </div>
                <small>Przywraca 25% Max HP. Jeśli krasnolud był w hibernacji — kończy hibernację.</small>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={() => lockSet(i)} disabled={lockedSets[i]}>✔️ Zatwierdź</button>
                <button onClick={() => {
                  // odpoczynek postaci + globalny reset efektów na wrogach (jak wcześniej)
                  setSets((prev) => {
                    const next = [...prev];
                    const c = { ...next[i] };

                    c.hp = c.maxHp ?? 20;
                    c.essence = c.maxEssence ?? 20;
                    c.actionsLeft = 2;

                    c.humanCharges = [false, false, false, false, false];
                    c.humanBuff = null;

                    c.elfChargeUsed = false;
                    c.elfChargedTurn = null;

                    c.dwarfPassiveArmed = false;
                    c.dwarfHibernating = false;
                    c.dwarfHibernateTurns = 0;

                    c.faeykaiChargesLeft = 3;
                    c.faeykaiMaskBroken = false;

                    c.effects = [];

                    c.classUsed = false;
                    c.warriorReady = false;
                    c.archerReady = false;
                    c.shooterReady = false;
                    c.mageReady = false;
                    c.mageShield = 0;

                    next[i] = c;
                    return next;
                  });
                  resetAllEnemyEffects();
                  addLog(`💤 Postać ${i + 1} odpoczęła: HP/Esencja odnowione, efekty i liczniki zresetowane.`);
                }}>💤 Odpocznij</button>
              </div>
            </div>
          ))}

          {/* Test walki */}
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <h3>2) Test walki</h3>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
              <h4>Atak</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
<label>Broń
  <select value={weapon} onChange={(e)=>setWeapon(e.target.value)}>
    <option value="sword">Miecz krótki (STR)</option>
    <option value="bow">Łuk (PER)</option>
    <option value="musket">Muszkiet (PER, k8)</option>
    <option value="staff">Kij magiczny (MAG)</option>
    <option value="crossbow">Prosta kusza (PER, k6)</option>
    <option value="dagger">Sztylet (STR, k4)</option>
    <option value="fists">Pięści (STR, k4)</option>
  </select>
</label>
                <label>Cel (wróg)
                  <select value={chosenEnemyId || ""} onChange={(e)=>setChosenEnemyId(e.target.value || null)}>
                    <option value="">—</option>
                    {enemies.map((en)=> <option key={en.id} value={en.id}>{en.name}</option>)}
                  </select>
                </label>
                <label>Obrona celu <input type="number" value={chosenEnemyId ? effectiveEnemyDefense(chosenEnemyId) : 0} readOnly /></label>
                <label>Pancerz celu <input type="number" value={chosenEnemyId ? effectiveEnemyArmor(chosenEnemyId) : 0} readOnly /></label>
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={doAttack} disabled={!chosenEnemyId}>⚔️ Wykonaj atak</button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 8 }}>
              <h4>Zaklęcia</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <label>Zaklęcie
                  <select value={selectedSpellName} onChange={(e)=>setSelectedSpellName(e.target.value)}>
                    {Object.keys(SPELLS).map((n)=> <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>Cel (wróg)
                  <select value={chosenEnemyId || ""} onChange={(e)=>setChosenEnemyId(e.target.value || null)} disabled={selectedSpellName==="Zasklepienie ran"}>
                    <option value="">—</option>
                    {enemies.map((en)=> <option key={en.id} value={en.id}>{en.name}</option>)}
                  </select>
                </label>
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
                <button onClick={castSelectedSpell}>✨ Rzuć zaklęcie</button>
              </div>
            </div>
          </div>
        </div>

        {/* ŚRODKOWA KOLUMNA — WROGOWIE */}
        <div>
          <h3>3) Wrogowie</h3>

          {/* Dodawanie wrogów */}
          <div style={{ marginBottom: 12, border: "1px solid #ddd", padding: 8, borderRadius: 8 }}>
            <h4 style={{ marginTop: 0 }}>Dodaj wrogów</h4>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={newEnemyType} onChange={(e) => setNewEnemyType(e.target.value)}>
                {Object.values(ENEMY_TYPES).map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
              <input type="number" min={1} value={newEnemyCount}
                onChange={(e) => setNewEnemyCount(Number(e.target.value))}
                style={{ width: 60 }} />
              <button onClick={addEnemies}>➕ Dodaj</button>
            </div>
          </div>

          {enemies.length === 0 && <div style={{ color:"#777" }}>Brak wrogów — dodaj ich powyżej.</div>}

          {enemies.map((e) => (
            <div key={e.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, marginBottom: 8, background: chosenEnemyId === e.id ? "#eef" : "#fff" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="radio" name="enemy" checked={chosenEnemyId === e.id} onChange={()=>setChosenEnemyId(e.id)} />
                <strong>{e.name}</strong>
              </label>
              <div>❤️ HP: {e.hp}/{e.maxHp} | 🔮 Esencja: {e.essence}/{e.maxEssence} | 🎯 Trafienie: {e.toHit} | Akcje: {e.actionsLeft}</div>
              <div>🛡 Obrona: {e.defense} (efektywna: {effectiveEnemyDefense(e.id)}) | Pancerz: {e.armor} (ef: {effectiveEnemyArmor(e.id)}) | Obr. magii: {e.magicDefense}</div>
              <div>Efekty: 🌀 Ogłuszenie {e.stun}t | ☠ Przeklęty {e.curse}t | Obrona −{e.defenseDebuff.value} ({e.defenseDebuff.turns}t) | Pancerz ×{e.armorDebuff.factor} ({e.armorDebuff.turns}t)</div>

              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setChosenEnemyId(e.id)}>🎯 Ustaw jako cel</button>
                {/* przykładowe szybkie akcje wroga */}
                <button onClick={() => enemyAttack(e.id, activeSet, "dagger")} disabled={e.actionsLeft<=0}>
  ⚔️ Atak (sztylet → aktywna postać)
</button>

                {/* Zaklęcia dostępne dla typu */}
                {ENEMY_TYPES[e.type].enemySpells.map(sp => (
                  <button key={sp} onClick={() => {
                    if (sp === "Wybuch energii") {
                      // przykład: na wszystkich graczy
                      enemyCastSpell(e.id, sp, [0,1,2,3].filter(idx=> sets[idx]));
                    } else {
                      // w cel: aktywna postać
                      enemyCastSpell(e.id, sp, [activeSet]);
                    }
                  }} disabled={e.actionsLeft<=0 || e.essence <= 0}>✨ {sp}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* PRAWA KOLUMNA — INFO / SZYBKIE AKCJE WROGA */}
        <div>
          <h3>4) Szybkie akcje wroga</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <button onClick={()=>{
              if (!chosenEnemyId) return addLog("❌ Wybierz wroga.");
              enemyAttack(chosenEnemyId, activeSet, "dagger");
            }}>👹 Wybrany wróg strzela do aktywnej (sztylet)</button>

            <button onClick={()=>{
              if (!chosenEnemyId) return addLog("❌ Wybierz wroga.");
              enemyCastSpell(chosenEnemyId, "Magiczny pocisk", [activeSet]);
            }}>👹 Wybrany wróg → Magiczny pocisk w aktywną</button>

            <button onClick={()=>{
              if (!chosenEnemyId) return addLog("❌ Wybierz wroga.");
              enemyCastSpell(chosenEnemyId, "Wybuch energii", [0,1,2,3].filter(i=>sets[i]));
            }}>👹 Wybrany wróg → Wybuch energii (AOE)</button>
          </div>

          <div style={{ marginTop: 8 }}>
            <div>Wymuszenia Dyplomaty per wróg ustawisz w sekcji „Wrogowie” (Domyślnie trafia aktywną postać).</div>
          </div>
        </div>
      </div>

      {/* Log */}
      <div style={{ marginTop: 16, background: "#111", color: "#eee", padding: 10, borderRadius: 8, maxHeight: 260, overflow: "auto", fontSize: 13 }}>
        {log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

