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

/* ===== Dane broni / wrogów / zaklęć ===== */
const weaponData = {
  sword:  { name: "Miecz krótki", stat: "STR", dmgDie: 6, type: "physical" },
  bow:    { name: "Łuk",          stat: "PER", dmgDie: 6, type: "physical" },
  musket: { name: "Muszkiet",     stat: "PER", dmgDie: 6, type: "physical" },
  staff:  { name: "Kij magiczny", stat: "MAG", dmgDie: 4, type: "physical" }, // trafienie traktujemy jak fizyczne
};

const ENEMIES = [
  { id: "cultist", name: "Kultysta", defense: 12, armor: 1, magicDefense: 2, toHit: 14, dmgDie: 4, dmgType: "magiczny", hp: 13 },
  { id: "warrior", name: "Wojownik", defense: 17, armor: 3, magicDefense: 1, toHit: 12, dmgDie: 6, dmgType: "fizyczny",  hp: 15 },
];

const SPELLS = {
  "Magiczny pocisk": { key: "missile", cost: 3, dmgDie: 6, needsToHit: true,  type: "damage" },
  "Wybuch energii":  { key: "burst",   cost: 5, dmgDie: 4, needsToHit: true,  type: "damage" },
  "Zasklepienie ran":{ key: "heal",    cost: 5, healDie: 6, needsToHit: false, type: "heal" },
  "Oślepienie":      { key: "blind",   cost: 8, needsToHit: false, type: "effect" },
};

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

    // KLASOWE — 1×/odp i „ready” (=zadziała przy nast. akcji)
    classUsed: false,
    warriorReady: false,
    archerReady: false,
    shooterReady: false,
    mageReady: false,
    mageShield: 0, // tarcza po czarze (wartość)
  });

  const [sets, setSets] = useState([makeChar(), makeChar(), makeChar(), makeChar()]);
  const [lockedSets, setLockedSets] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  /* --- Test walki / log / tury --- */
  const [weapon, setWeapon] = useState("sword");
  const [defense, setDefense] = useState(0);
  const [enemyArmor, setEnemyArmor] = useState(0);
  const [enemyMagicDefense, setEnemyMagicDefense] = useState(0);
  const [selectedSpellName, setSelectedSpellName] = useState("Magiczny pocisk");
  const [healTarget, setHealTarget] = useState(0);

  // Dyplomata: wybór wroga i celu przy aktywacji
  const [diploEnemy, setDiploEnemy] = useState("cultist");
  const [diploTarget, setDiploTarget] = useState(0);

  const [chosenEnemyId, setChosenEnemyId] = useState("cultist");
  const [enemyStates, setEnemyStates] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: e.hp }), {}));

  // Efekty na wrogach
  const [enemyStun, setEnemyStun] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: 0 }), {}));
  const [enemyCurse, setEnemyCurse] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: 0 }), {})); // +3 do progu trafienia
  const [enemyDefenseDebuff, setEnemyDefenseDebuff] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: { value: 0, turns: 0 } }), {})); // -5, 3 tury
  const [enemyArmorDebuff, setEnemyArmorDebuff] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: { factor: 1, turns: 0 } }), {})); // x0.5, 3 tury

  // Dyplomata: wymuszenie celu (jednorazowe)
  const [forcedTarget, setForcedTarget] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: null }), {})); // { enemyId: playerIndex | null }

  // Revive dropdown per postać
  const [reviveTargetIndex, setReviveTargetIndex] = useState([null, null, null, null]);

  const [turn, setTurn] = useState(1);

  const [log, setLog] = useState([]);
  const addLog = (line) => {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [`[${t}] ${line}`, ...prev]);
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

  const getEnemyBase = (id) => ENEMIES.find((e) => e.id === id) || ENEMIES[0];

  const effectiveEnemyDefense = (id) => {
    const base = getEnemyBase(id).defense;
    const deb = enemyDefenseDebuff[id];
    return Math.max(0, base - (deb?.value || 0));
  };

  const effectiveEnemyArmor = (id) => {
    const base = getEnemyBase(id).armor;
    const deb = enemyArmorDebuff[id];
    const factor = deb?.factor || 1;
    return Math.max(0, Math.floor(base * factor));
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

  const resetAllEnemyEffects = () => {
    // globalny reset efektów na wrogach (zgodnie z prośbą o czyszczenie efektów przy odpoczynku)
    setEnemyStun(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: 0 }), {}));
    setEnemyCurse(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: 0 }), {}));
    setEnemyDefenseDebuff(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: { value: 0, turns: 0 } }), {}));
    setEnemyArmorDebuff(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: { factor: 1, turns: 0 } }), {}));
    setForcedTarget(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: null }), {}));
    addLog("🧹 Zresetowano efekty na wrogach (ogłuszenia, przekleństwa, debuffy, wymuszenia celu).");
  };

  const restSet = (i) => {
    setSets((prev) => {
      const next = [...prev];
      const c = { ...next[i] };

      // pełne odnowienie
      c.hp = c.maxHp ?? 20;
      c.essence = c.maxEssence ?? 20;
      c.actionsLeft = 2;

      // reset rasowych i klasowych
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

    // Global: reset efektów na wrogach
    resetAllEnemyEffects();

    addLog(`💤 Postać ${i + 1} odpoczęła: HP/Esencja odnowione, efekty i liczniki zresetowane.`);
  };

  const applyEnemy = () => {
    const e = getEnemyBase(chosenEnemyId);
    if (!e) return;
    setDefense(e.defense);
    setEnemyArmor(e.armor);
    setEnemyMagicDefense(e.magicDefense);
    addLog(`🎯 Wybrano wroga: ${e.name}`);
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

  const damageEnemy = (enemyId, dmg) => {
    if (dmg <= 0) return;
    setEnemyStates((prev) => {
      const next = { ...prev };
      next[enemyId] = Math.max(0, (next[enemyId] ?? 0) - dmg);
      return next;
    });
    addLog(`💔 Wróg (${enemyId}) otrzymał ${dmg} obrażeń (pozostało ${Math.max(0, (enemyStates[enemyId] ?? 0) - dmg)} HP).`);
  };

  /* ===== RASOWE ===== */
  const useHumanCharge = (i, idx) => {
    const c = sets[i];
    if (c.race !== "Człowiek") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (c.humanCharges[idx]) return; // już użyty

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      const charges = [...me.humanCharges];
      charges[idx] = true;
      me.humanCharges = charges;

      const buffType = me.humanPendingChoice; // 'dmg' | 'tohit' | 'hp'
      if (buffType === "hp") {
        me.hp = Math.min(me.maxHp ?? 20, (me.hp ?? 0) + 2);
        addLog(`🧬 Człowiek (Postać ${i + 1}): natychmiastowe +2 HP.`);
      } else {
        me.humanBuff = { type: buffType, expiresTurn: turn }; // wygasa przy Next Turn
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

    setEnemyCurse((prev) => {
      const next = { ...prev };
      next[enemyId] = Math.max(next[enemyId], 3); // 3 tury kary
      return next;
    });
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.faeykaiChargesLeft = (me.faeykaiChargesLeft || 0) - 1;
      me.actionsLeft = (me.actionsLeft || 0) - 1;
      next[i] = me;
      return next;
    });
    addLog(`🕯️ Faeykai (Postać ${i + 1}): przekleństwo na wroga ${enemyId} (−3 do trafienia przez 3 tury).`);
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
        me.warriorReady = true; // następny atak fizyczny: auto-hit + pełne obrażenia bez obrony/pancerza
        me.actionsLeft = (me.actionsLeft || 0) - 1;
        next[i] = me;
        return next;
      });
      addLog(`🎖️ Wojownik (Postać ${i + 1}): przygotował „maksymalny cios” na następny atak fizyczny.`);
      return;
    }

    if (c.clazz === "Łucznik") {
      setSets((prev) => {
        const next = [...prev];
        const me = { ...next[i] };
        me.classUsed = true;
        me.archerReady = true; // następny atak łukiem nakłada debuff obrony
        me.actionsLeft = (me.actionsLeft || 0) - 1;
        next[i] = me;
        return next;
      });
      addLog(`🏹 Łucznik (Postać ${i + 1}): przygotował „celny strzał” — po następnym trafieniu łukiem obniży Obr. celu o 5 (3 tury).`);
      return;
    }

    if (c.clazz === "Strzelec") {
      setSets((prev) => {
        const next = [...prev];
        const me = { ...next[i] };
        me.classUsed = true;
        me.shooterReady = true; // następny atak muszkietem nakłada 50% pancerza
        me.actionsLeft = (me.actionsLeft || 0) - 1;
        next[i] = me;
        return next;
      });
      addLog(`🔫 Strzelec (Postać ${i + 1}): przygotował „druzgocący strzał” — po następnym trafieniu muszkietem pancerz celu spada o 50% (3 tury).`);
      return;
    }

    if (c.clazz === "Mag") {
      setSets((prev) => {
        const next = [...prev];
        const me = { ...next[i] };
        me.classUsed = true;
        me.mageReady = true; // po następnym czarze damage → tarcza 50%
        me.actionsLeft = (me.actionsLeft || 0) - 1;
        next[i] = me;
        return next;
      });
      addLog(`🔮 Mag (Postać ${i + 1}): przygotował „tarczę” — po następnym czarze z obrażeniami utworzy się tarcza = 50% zadanych obrażeń.`);
      return;
    }

    if (c.clazz === "Dyplomata") {
      // wymagamy wyboru wroga i celu (postać)
      const enemyId = diploEnemy;
      const targetIdx = diploTarget;
      setForcedTarget((prev) => ({ ...prev, [enemyId]: targetIdx }));
      setSets((prev) => {
        const next = [...prev];
        const me = { ...next[i] };
        me.classUsed = true;
        me.actionsLeft = (me.actionsLeft || 0) - 1;
        next[i] = me;
        return next;
      });
      addLog(`🗣️ Dyplomata (Postać ${i + 1}) zmusza wroga ${enemyId} do zaatakowania Postaci ${targetIdx + 1} przy jego następnym ataku.`);
      return;
    }
  };

  /* ===== WALKA: Atak fizyczny ===== */
  const doAttack = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");

    const w = weaponData[weapon];
    const statVal = Number(c[w.stat] ?? 0);

    const humanToHitBonus = c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? 2 : 0;

    // Wojownik: jeżeli gotowy i atak fizyczny → auto-hit + max dmg bez obrony/pancerza
    if (c.clazz === "Wojownik" && c.warriorReady && w.type === "physical") {
      const maxDmg = w.dmgDie; // „pełne obrażenia” = maksymalna wartość kości
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
      ` = ${toHit} vs Obrona ${effDefense} → ${hit ? "✅ TRAFIENIE" : "❌ PUDŁO"}`
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

    // Łucznik: jeżeli „ready” i to był łuk → debuff obrony
    if (c.clazz === "Łucznik" && c.archerReady && weapon === "bow") {
      setEnemyDefenseDebuff((prev) => {
        const next = { ...prev };
        next[chosenEnemyId] = { value: 5, turns: 3 };
        return next;
      });
      setSets((prev) => {
        const next = [...prev];
        next[activeSet] = { ...next[activeSet], archerReady: false };
        return next;
      });
      addLog(`🏹 Debuff: Obrona celu −5 na 3 tury.`);
    }

    // Strzelec: jeżeli „ready” i to był muszkiet → debuff pancerza x0.5
    if (c.clazz === "Strzelec" && c.shooterReady && weapon === "musket") {
      setEnemyArmorDebuff((prev) => {
        const next = { ...prev };
        next[chosenEnemyId] = { factor: 0.5, turns: 3 };
        return next;
      });
      setSets((prev) => {
        const next = [...prev];
        next[activeSet] = { ...next[activeSet], shooterReady: false };
        return next;
      });
      addLog(`🔧 Debuff: Pancerz celu ×0.5 na 3 tury.`);
    }

    damageEnemy(chosenEnemyId, afterArmor);
  };

  /* ===== ZAKLĘCIA ===== */
  const castSelectedSpell = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");

    const spell = SPELLS[selectedSpellName];
    if (!spell) return;
    if (c.essence < spell.cost) return addLog(`❌ Esencja: ${c.essence} < koszt ${spell.cost}.`);

    const MAG = Number(c.MAG ?? 0);
    const faeykaiPenalty = c.race === "Faeykai" && c.faeykaiOutsideHomeland && c.faeykaiMaskBroken ? 5 : 0;

    let lines = [`✨ „${selectedSpellName}” — koszt ${spell.cost} (Esencja przed: ${c.essence})`];
    setActiveEssence(c.essence - spell.cost);
    spendAction(activeSet);

    if (spell.type === "damage") {
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
      const reduced = Math.max(0, raw - Number(enemyMagicDefense));
      lines.push(
        `💥 Obrażenia: k${spell.dmgDie}=${rollDmg} + mod(MAG)=${mod}` +
        (humanDmgBonus ? ` + human(+2)` : "") +
        ` = ${raw}`
      );
      lines.push(`🛡️ Redukcja magią: −${enemyMagicDefense} → ${reduced}`);
      addLog(lines.join("\n"));

      // Mag: tarcza po czarze (jeśli mageReady)
      if (c.clazz === "Mag" && c.mageReady && reduced > 0) {
        const shield = Math.floor(reduced * 0.5);
        setSets((prev) => {
          const next = [...prev];
          next[activeSet] = { ...next[activeSet], mageReady: false, mageShield: shield };
          return next;
        });
        addLog(`🛡️ Tarcza Maga aktywna: ${Math.floor(reduced * 0.5)} (odbije i zablokuje przy następnym ataku wroga).`);
      }

      damageEnemy(chosenEnemyId, reduced);
      return;
    }

    if (spell.type === "heal") {
      const rollHeal = d(spell.healDie);
      setSets((prev) => {
        const next = [...prev];
        const caster = { ...next[activeSet] };
        const target = { ...next[healTarget] };

        // caster.essence — już odjęliśmy
        target.hp = Math.min(target.maxHp ?? 20, (target.hp ?? 0) + rollHeal);

        next[activeSet] = caster;
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

  /* ===== ATAK WROGA ===== */
  const enemyAttack = () => {
    const enemy = getEnemyBase(chosenEnemyId);
    if (!enemy) return addLog("❌ Nie wybrano wroga.");

    // cel: wymuszenie dyplomaty?
    const forced = forcedTarget[enemy.id];
    const targetIndex = typeof forced === "number" ? forced : activeSet;
    const target = sets[targetIndex];

    // ogłuszenie?
    if ((enemyStun[enemy.id] || 0) > 0) {
      addLog(`🌀 ${enemy.name} jest ogłuszony (pozostało ${enemyStun[enemy.id]} tur).`);
      return;
    }

    const toHitNeed = enemy.toHit + (enemyCurse[enemy.id] > 0 ? 3 : 0); // przekleństwo utrudnia trafienie
    let lines = [`👹 Wróg: ${enemy.name} → cel: Postać ${targetIndex + 1}`];
    const roll20 = d(20);
    const hit = roll20 >= toHitNeed;
    lines.push(`🎲 Trafienie: k20=${roll20} vs próg ${toHitNeed}${enemyCurse[enemy.id] > 0 ? " (przekleństwo +3)" : ""} → ${hit ? "✅" : "❌"}`);

    if (!hit) {
      if (typeof forced === "number") setForcedTarget((prev) => ({ ...prev, [enemy.id]: null }));
      return addLog(lines.join("\n"));
    }

    // tarcza Maga na celu?
    let incoming = d(enemy.dmgDie);
    lines.push(`💥 Rzut na obrażenia: k${enemy.dmgDie}=${incoming}`);

    let reflected = 0;

    // krasnolud w hibernacji — ignoruje obrażenia
    if (target.dwarfHibernating) {
      lines.push(`🛌 Cel w hibernacji — obrażenia zignorowane.`);
    } else {
      // redukcje
      if (enemy.dmgType === "magiczny") {
        incoming = Math.max(0, incoming - Number(target.magicDefense ?? 0));
        lines.push(`🛡️ Redukcja: − Obrona magii (${target.magicDefense}) → ${incoming}`);
      } else {
        incoming = Math.max(0, incoming - Number(target.armor ?? 0));
        lines.push(`🛡️ Redukcja: − Pancerz (${target.armor}) → ${incoming}`);
      }

      // tarcza maga (jeżeli cel ma)
      if ((target.mageShield || 0) > 0) {
        const use = Math.min(target.mageShield, incoming);
        reflected = use;
        incoming = Math.max(0, incoming - use);

        setSets((prev) => {
          const next = [...prev];
          const t = { ...next[targetIndex] };
          t.mageShield = Math.max(0, (t.mageShield || 0) - use);
          next[targetIndex] = t;
          return next;
        });

        lines.push(`🔮 Tarcza Maga: −${use} obrażeń, odbija ${use} we wroga.`);
        if (reflected > 0) damageEnemy(enemy.id, reflected);
      }

      // zadaj obrażenia celowi
      if (incoming > 0) {
        setSets((prev) => {
          const next = [...prev];
          const cur = { ...next[targetIndex] };
          const before = cur.hp ?? 0;
          cur.hp = Math.max(0, before - incoming);

          // Faeykai: maska pęka poniżej 10%
          if (cur.race === "Faeykai") {
            const thresh = Math.ceil((cur.maxHp || 20) * 0.1);
            if (cur.hp < thresh) cur.faeykaiMaskBroken = true;
          }

          // Krasnolud: jeśli uzbrojony i spadnie do 0 → hibernacja 2 tury
          if (cur.race === "Krasnolud" && cur.dwarfPassiveArmed && before > 0 && cur.hp <= 0) {
            cur.dwarfHibernating = true;
            cur.dwarfHibernateTurns = 2;
            lines.push(`🛡️ Krasnolud: wchodzi w hibernację na 2 tury (niewrażliwy).`);
          }

          next[targetIndex] = cur;
          return next;
        });
        lines.push(`❤️ HP Postaci ${targetIndex + 1} −${incoming}`);
      }
    }

    // skonsumuj jednorazowe wymuszenie celu
    if (typeof forced === "number") setForcedTarget((prev) => ({ ...prev, [enemy.id]: null }));

    addLog(lines.join("\n"));
  };

  /* ===== PODNIEŚ SOJUSZNIKA ===== */
  const reviveAlly = (casterIndex, targetIndex) => {
    if (targetIndex == null) return addLog("❌ Wybierz sojusznika do podniesienia.");
    const caster = sets[casterIndex];
    const target = sets[targetIndex];

    if ((caster.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (!lockedSets[casterIndex]) return addLog("❌ Najpierw zatwierdź postać wykonującą akcję.");
    if (!target || (target.hp ?? 0) > 0) return addLog("❌ Wybrana postać nie jest nieprzytomna/na 0 HP.");

    // zużyj akcję i podnieś
    spendAction(casterIndex);

    const healValue = Math.floor((target.maxHp || 20) * 0.25);
    setSets((prev) => {
      const next = [...prev];
      const t = { ...next[targetIndex] };
      t.hp = healValue;
      // jeśli był krasnolud w hibernacji — zakończ hibernację
      t.dwarfHibernating = false;
      t.dwarfHibernateTurns = 0;
      next[targetIndex] = t;
      return next;
    });

    addLog(`🛡️ Postać ${casterIndex + 1} podniosła Postać ${targetIndex + 1} → HP = ${healValue} (25% maksymalnego).`);

    // wyczyść wybór w dropdownie
    setReviveTargetIndex((prev) => {
      const next = [...prev];
      next[casterIndex] = null;
      return next;
    });
  };

  /* ===== TURY: „Następna tura” ===== */
  const nextTurn = () => {
    // Postacie
    setSets((prev) => {
      const next = prev.map((c, idx) => {
        const me = { ...c };

        // odśwież akcje
        me.actionsLeft = 2;

        // Człowiek — buff wygasa z końcem zeszłej tury
        if (me.humanBuff && me.humanBuff.expiresTurn < turn + 1) {
          me.humanBuff = null;
        }

        // Elf: jeśli ładował w poprzedniej turze -> teraz eksplozja
        if (me.race === "Elf" && me.elfChargeUsed && me.elfChargedTurn === turn) {
          const before = me.hp || 0;
          me.hp = Math.max(0, before - 5);
          addLog(`🌩️ Elf (Postać ${idx + 1}) — eksplozja: −5 HP dla elfa, wrogowie −10 HP + ogłuszenie 1 turę.`);

          setEnemyStates((prevEnemies) => {
            const nxt = { ...prevEnemies };
            for (const id of Object.keys(nxt)) {
              nxt[id] = Math.max(0, nxt[id] - 10);
            }
            return nxt;
          });
          setEnemyStun((prevStun) => {
            const nxt = { ...prevStun };
            for (const id of Object.keys(nxt)) {
              nxt[id] = Math.max(nxt[id], 1);
            }
            return nxt;
          });

          me.elfChargeUsed = false;
          me.elfChargedTurn = null;
        }

        // Regeneracje/błogosławieństwa: +3 HP/turę
        if (me.effects && me.effects.length) {
          me.effects = me.effects
            .map((ef) => {
              if (ef.type === "bless" && ef.turnsLeft > 0) {
                me.hp = Math.min(me.maxHp ?? 20, (me.hp ?? 0) + (ef.value || 0));
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

        // Faeykai: maska pęknięta, jeśli HP < 10%
        if (me.race === "Faeykai") {
          const thresh = Math.ceil((me.maxHp || 20) * 0.1);
          if ((me.hp || 0) < thresh) me.faeykaiMaskBroken = true;
        }

        return me;
      });

      return next;
    });

    // Wrogowie — tury efektów
    setEnemyStun((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) next[id] = Math.max(0, next[id] - 1);
      return next;
    });
    setEnemyCurse((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) next[id] = Math.max(0, next[id] - 1);
      return next;
    });
    setEnemyDefenseDebuff((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const t = next[id]?.turns || 0;
        next[id] = t > 1 ? { ...next[id], turns: t - 1 } : { value: 0, turns: 0 };
      }
      return next;
    });
    setEnemyArmorDebuff((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const t = next[id]?.turns || 0;
        next[id] = t > 1 ? { ...next[id], turns: t - 1 } : { factor: 1, turns: 0 };
      }
      return next;
    });

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
                <label>HP <input type="number" value={set.hp} onChange={(e)=>updateSetField(i,"hp",e.target.value)} /></label>
                <label>Max HP <input type="number" value={set.maxHp} onChange={(e)=>updateSetField(i,"maxHp",e.target.value)} /></label>
                <label>Esencja <input type="number" value={set.essence} onChange={(e)=>updateSetField(i,"essence",e.target.value)} /></label>
                <label>Max Esencja <input type="number" value={set.maxEssence} onChange={(e)=>updateSetField(i,"maxEssence",e.target.value)} /></label>
                <label>Pancerz <input type="number" value={set.armor} onChange={(e)=>updateSetField(i,"armor",e.target.value)} /></label>
                <label>Obrona magii <input type="number" value={set.magicDefense} onChange={(e)=>updateSetField(i,"magicDefense",e.target.value)} /></label>
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
                      <label>
                        Błogosławieństwo → Postać:
                        <select onChange={()=>{}} value="">
                          <option value="" disabled>Wybierz</option>
                          {sets.map((_, idx) => <option key={idx} value={idx}>Postać {idx + 1}</option>)}
                        </select>
                      </label>
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

                      <label>
                        Przekleństwo → Wróg:
                        <select onChange={()=>{}} value="">
                          <option value="" disabled>Wybierz</option>
                          {ENEMIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </label>
                      <button
                        onClick={() => {
                          const id = prompt("Podaj id wroga: cultist / warrior (przekleństwo −3 do trafienia na 3 tury)");
                          if (id === "cultist" || id === "warrior") useFaeykaiCurse(i, id);
                        }}
                        disabled={(set.faeykaiChargesLeft || 0) <= 0}
                        title="1 akcja"
                      >
                        🕯️ Rzuć przekleństwo
                      </button>
                    </div>
                    <small>Jeśli Faeykai ma &lt; 10% max HP i jest poza ojczyzną, zaklęcia mają −5 do trafienia do czasu odpoczynku/maski.</small>
                  </div>
                )}
              </div>

              {/* KLASOWE */}
              <div style={{ marginTop: 8, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
                <strong>Umiejętność klasowa (1×/odp):</strong>
                {set.clazz === "Dyplomata" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <label>Wróg:
                      <select value={diploEnemy} onChange={(e)=>setDiploEnemy(e.target.value)}>
                        {ENEMIES.map((e)=><option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </label>
                    <label>Cel (postać):
                      <select value={diploTarget} onChange={(e)=>setDiploTarget(Number(e.target.value))}>
                        {sets.map((_, idx)=><option key={idx} value={idx}>Postać {idx+1}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => useClassPower(i)} disabled={set.classUsed} title="1 akcja">
                    {set.classUsed ? "Użyto" : `Użyj (${set.clazz})`}
                  </button>
                  {/* Wskaźniki „ready” */}
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
                <button onClick={() => restSet(i)}>💤 Odpocznij</button>
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
                    <option value="musket">Muszkiet (PER)</option>
                    <option value="staff">Kij magiczny (MAG)</option>
                  </select>
                </label>
                <label>Obrona celu <input type="number" value={effectiveEnemyDefense(chosenEnemyId)} readOnly /></label>
                <label>Pancerz celu <input type="number" value={effectiveEnemyArmor(chosenEnemyId)} readOnly /></label>
                <label>Obrona magii <input type="number" value={enemyMagicDefense} readOnly /></label>
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={doAttack}>⚔️ Wykonaj atak</button>
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
                <label>Obrona magii <input type="number" value={enemyMagicDefense} readOnly /></label>
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
          {ENEMIES.map((e) => (
            <div key={e.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, marginBottom: 8, background: chosenEnemyId === e.id ? "#eef" : "#fff" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="radio" name="enemy" checked={chosenEnemyId === e.id} onChange={()=>setChosenEnemyId(e.id)} />
                {e.name}
              </label>
              <div>Obrona (bazowa): {e.defense} | Pancerz (bazowy): {e.armor} | Obrona magii: {e.magicDefense}</div>
              <div>Efekty: Obrona −{enemyDefenseDebuff[e.id].value} ({enemyDefenseDebuff[e.id].turns} t.), Pancerz ×{enemyArmorDebuff[e.id].factor} ({enemyArmorDebuff[e.id].turns} t.)</div>
              <div>Trafienie: {e.toHit} | Obrażenia: 1k{e.dmgDie} ({e.dmgType})</div>
              <div>❤️ HP: {enemyStates[e.id]} | 🌀 Ogłuszenie: {enemyStun[e.id]} | ☠ Przekl.: {enemyCurse[e.id]} t.</div>
              <button onClick={applyEnemy} style={{ marginTop: 6 }}>✔️ Ustaw jako cel</button>
            </div>
          ))}
        </div>

        {/* PRAWA KOLUMNA — ATAK WROGA */}
        <div>
          <h3>4) Atak wroga</h3>
          <button onClick={enemyAttack}>👹 Wróg atakuje (cel: aktywna lub wymuszony)</button>
          <div style={{ marginTop: 8 }}>
            <div>Wymuszenie celu (Dyplomata): {Object.entries(forcedTarget).some(([,v])=>v!==null) ? "aktywne" : "brak"}</div>
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

