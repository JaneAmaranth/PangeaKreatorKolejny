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
  sword: { name: "Miecz krótki", stat: "STR", dmgDie: 6 },
  bow: { name: "Łuk", stat: "PER", dmgDie: 6 },
  staff: { name: "Kij magiczny", stat: "MAG", dmgDie: 4 },
};

const ENEMIES = [
  { id: "cultist", name: "Kultysta", defense: 12, armor: 1, magicDefense: 2, toHit: 14, dmgDie: 4, dmgType: "magiczny", hp: 13 },
  { id: "warrior", name: "Wojownik", defense: 17, armor: 3, magicDefense: 1, toHit: 12, dmgDie: 6, dmgType: "fizyczny", hp: 15 },
];

const SPELLS = {
  "Magiczny pocisk": { key: "missile", cost: 3, dmgDie: 6, needsToHit: true, type: "damage" },
  "Wybuch energii": { key: "burst", cost: 5, dmgDie: 4, needsToHit: true, type: "damage" },
  "Zasklepienie ran": { key: "heal", cost: 5, healDie: 6, needsToHit: false, type: "heal" },
  "Oślepienie": { key: "blind", cost: 8, needsToHit: false, type: "effect" },
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

    // RASOWE — użycia i stany
    humanCharges: [false, false, false, false, false], // false=zielony dostępny, true=zużyty
    humanBuff: null, // { type: 'dmg'|'tohit', expiresTurn: number }
    humanPendingChoice: "dmg", // wybór efektu przy kliknięciu

    elfChargeUsed: false,
    elfChargedTurn: null, // tura, w której naładował
    // eksplozja dzieje się automatycznie po 1 turze

    dwarfPassiveArmed: false, // aktywowana umiejętność (1/odp)
    dwarfHibernating: false,
    dwarfHibernateTurns: 0,

    faeykaiChargesLeft: 3,
    faeykaiMaskBroken: false, // pęka, gdy HP < 10% max
    faeykaiOutsideHomeland: true, // zakładamy poza ojczyzną

    // efekty okresowe na postaci (np. błogosławieństwo z Faeykai): [{type:"bless", value:3, turnsLeft:3}]
    effects: [],

    // Klasowe — 1/odpoczynek
    classUsed: false, // flaga ogólna 1/odp (możesz rozbić na osobne jeśli chcesz różne liczniki)
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

  const [chosenEnemyId, setChosenEnemyId] = useState("cultist");
  const [enemyStates, setEnemyStates] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: e.hp }), {}));
  const [enemyStun, setEnemyStun] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: 0 }), {})); // tury ogłuszenia
  const [enemyCurse, setEnemyCurse] = useState(ENEMIES.reduce((a, e) => ({ ...a, [e.id]: 0 }), {})); // -3 do trafienia (dodatkowy próg)

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
      const parsed = key === "name" || key === "race" || key === "clazz" ? val : (val === "" ? null : Number(val));
      next[i] = { ...next[i], [key]: parsed };
      // sprawdź maskę Faeykai po zmianie HP
      if (key === "hp") {
        const s = next[i];
        if (s.race === "Faeykai") {
          const thresh = Math.ceil((s.maxHp || 20) * 0.1);
          next[i].faeykaiMaskBroken = (s.hp || 0) < thresh ? true : next[i].faeykaiMaskBroken;
        }
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

      next[i] = c;
      return next;
    });
    addLog(`💤 Postać ${i + 1} odpoczęła: HP/Esencja odnowione, liczniki zresetowane.`);
  };

  const applyEnemy = () => {
    const e = ENEMIES.find((x) => x.id === chosenEnemyId);
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

  const ensureFaeykaiMaskCheck = (i) => {
    setSets((prev) => {
      const next = [...prev];
      const c = { ...next[i] };
      if (c.race === "Faeykai") {
        const thresh = Math.ceil((c.maxHp || 20) * 0.1);
        if ((c.hp || 0) < thresh) c.faeykaiMaskBroken = true;
      }
      next[i] = c;
      return next;
    });
  };

  /* ===== Walka: Atak fizyczny ===== */
  const doAttack = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");

    const w = weaponData[weapon];
    const statVal = Number(c[w.stat] ?? 0);

    // bonus człowieka do trafienia?
    const humanToHitBonus = c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? 2 : 0;

    const roll20 = d(20);
    const toHit = roll20 + statVal + humanToHitBonus;
    const hit = toHit >= Number(defense);

    addLog(
      `⚔️ Atak (${w.name}) — k20=${roll20} + ${w.stat}(${statVal}) ` +
      (humanToHitBonus ? `+ human(+2 do trafienia) ` : "") +
      `= ${toHit} vs Obrona ${defense} → ${hit ? "✅ TRAFIENIE" : "❌ PUDŁO"}`
    );

    spendAction(activeSet);
    if (!hit) return;

    const rawDie = d(w.dmgDie);
    const humanDmgBonus = c.race === "Człowiek" && c.humanBuff?.type === "dmg" ? 2 : 0;
    const raw = rawDie + humanDmgBonus;
    const afterArmor = Math.max(0, raw - Number(enemyArmor));

    addLog(
      `🗡️ Obrażenia: k${w.dmgDie}=${rawDie}` +
      (humanDmgBonus ? ` + human(+2 dmg)` : "") +
      ` = ${raw} − Pancerz ${enemyArmor} = ${afterArmor}`
    );

    damageEnemy(chosenEnemyId, afterArmor);
  };

  /* ===== Zaklęcia ===== */
  const castSelectedSpell = () => {
    if (!lockedSets[activeSet]) return addLog("❌ Najpierw zatwierdź wybraną postać.");
    const c = getActiveStats();
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji w tej turze.");

    const spell = SPELLS[selectedSpellName];
    if (!spell) return;
    if (c.essence < spell.cost) return addLog(`❌ Esencja: ${c.essence} < koszt ${spell.cost}.`);

    const MAG = Number(c.MAG ?? 0);
    // Faeykai kara do trafienia zaklęciami, jeśli maska pęknięta i poza ojczyzną
    const faeykaiSpellPenalty = c.race === "Faeykai" && c.faeykaiOutsideHomeland && c.faeykaiMaskBroken ? 5 : 0;

    let lines = [`✨ „${selectedSpellName}” — koszt ${spell.cost} (Esencja przed: ${c.essence})`];
    setActiveEssence(c.essence - spell.cost);
    spendAction(activeSet);

    if (spell.type === "damage") {
      const roll20 = d(20);
      const toHit = roll20 + MAG - faeykaiSpellPenalty + (c.humanBuff?.type === "tohit" && c.race === "Człowiek" ? 2 : 0);
      const hit = toHit >= Number(defense);
      lines.push(
        `🎯 Trafienie: k20=${roll20} + MAG(${MAG})` +
        (faeykaiSpellPenalty ? ` − Faeykai maska(−5)` : "") +
        (c.race === "Człowiek" && c.humanBuff?.type === "tohit" ? ` + human(+2)` : "") +
        ` = ${toHit} vs Obrona ${defense} → ${hit ? "✅" : "❌"}`
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

      damageEnemy(chosenEnemyId, reduced);
      return;
    }

    if (spell.type === "heal") {
      const rollHeal = d(spell.healDie);
      setSets((prev) => {
        const next = [...prev];
        const caster = { ...next[activeSet] };
        const target = { ...next[healTarget] };

        caster.essence = Math.max(0, caster.essence - 0); // już odjęliśmy wcześniej
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

    // Oślepienie – efekt statusu, bez obrażeń (tu: zapis do logu)
    addLog(lines.concat("🌑 Efekt zaklęcia zastosowany.").join("\n"));
  };

  /* ===== Atak wroga ===== */
  const enemyAttack = () => {
    const enemy = ENEMIES.find((e) => e.id === chosenEnemyId);
    const c = getActiveStats();
    if (!enemy) return addLog("❌ Nie wybrano wroga.");

    // ogłuszenie?
    if ((enemyStun[enemy.id] || 0) > 0) {
      addLog(`🌀 ${enemy.name} jest ogłuszony (pozostało ${enemyStun[enemy.id]} tur).`);
      return;
    }

    const toHitNeed = enemy.toHit + (enemyCurse[enemy.id] > 0 ? 3 : 0); // przekleństwo: trudniej trafić
    let lines = [`👹 Wróg: ${enemy.name}`];
    const roll20 = d(20);
    const hit = roll20 >= toHitNeed;
    lines.push(`🎲 Trafienie: k20=${roll20} vs próg ${toHitNeed}${enemyCurse[enemy.id] > 0 ? " (przekleństwo +3)" : ""} → ${hit ? "✅" : "❌"}`);
    if (!hit) return addLog(lines.join("\n"));

    // krasnolud w hibernacji — ignoruje obrażenia
    if (c.dwarfHibernating) {
      lines.push(`🛌 Postać w hibernacji — obrażenia zignorowane.`);
      return addLog(lines.join("\n"));
    }

    const rollDmg = d(enemy.dmgDie);
    lines.push(`💥 Rzut na obrażenia: k${enemy.dmgDie}=${rollDmg}`);

    let reduced = rollDmg;
    if (enemy.dmgType === "magiczny") {
      reduced = Math.max(0, rollDmg - Number(c.magicDefense ?? 0));
      lines.push(`🛡️ Redukcja: − Obrona magii (${c.magicDefense}) → ${reduced}`);
    } else {
      reduced = Math.max(0, rollDmg - Number(c.armor ?? 0));
      lines.push(`🛡️ Redukcja: − Pancerz (${c.armor}) → ${reduced}`);
    }

    // zadaj obrażenia
    setSets((prev) => {
      const next = [...prev];
      const cur = { ...next[activeSet] };
      const before = cur.hp ?? 0;
      cur.hp = Math.max(0, before - reduced);

      // sprawdź Faeykai maskę
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

      next[activeSet] = cur;
      return next;
    });

    lines.push(`❤️ HP postaci −${reduced}`);
    addLog(lines.join("\n"));
  };

  /* ===== RASOWE: UI i działania ===== */
  const useHumanCharge = (i, idx) => {
    const c = sets[i];
    if (c.race !== "Człowiek") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (c.humanCharges[idx]) return; // już użyty

    // ustaw buff (trwa do końca tej tury)
    const buffType = c.humanPendingChoice; // 'dmg' | 'tohit' | 'hp'
    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      const charges = [...me.humanCharges];
      charges[idx] = true;
      me.humanCharges = charges;

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

  const useFaeykaiCharge = (i, kind, enemyIdOrPlayerIndex = null) => {
    // kind: 'blessPlayer' | 'curseEnemy'
    const c = sets[i];
    if (c.race !== "Faeykai") return;
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if ((c.faeykaiChargesLeft || 0) <= 0) return addLog("❌ Brak ładunków Faeykai.");

    if (kind === "blessPlayer" && typeof enemyIdOrPlayerIndex === "number") {
      // +3 HP przez 3 tury (na początku tury)
      setSets((prev) => {
        const next = [...prev];
        const me = { ...next[i] };
        const target = { ...next[enemyIdOrPlayerIndex] };

        target.effects = [...(target.effects || []), { type: "bless", value: 3, turnsLeft: 3 }];
        me.faeykaiChargesLeft = (me.faeykaiChargesLeft || 0) - 1;
        me.actionsLeft = (me.actionsLeft || 0) - 1;

        next[i] = me;
        next[enemyIdOrPlayerIndex] = target;
        return next;
      });
      addLog(`🌿 Faeykai (Postać ${i + 1}): błogosławieństwo dla Postaci ${enemyIdOrPlayerIndex + 1} (+3 HP/ turę przez 3 tury).`);
      return;
    }

    if (kind === "curseEnemy" && typeof enemyIdOrPlayerIndex === "string") {
      setEnemyCurse((prev) => {
        const next = { ...prev };
        next[enemyIdOrPlayerIndex] = Math.max(next[enemyIdOrPlayerIndex], 3); // 3 tury kary
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
      addLog(`🕯️ Faeykai (Postać ${i + 1}): przekleństwo na wroga ${enemyIdOrPlayerIndex} (−3 do trafienia przez 3 tury).`);
    }
  };

  /* ===== KLASOWE (flagi 1/odp, hook pod logikę) ===== */
  const useClassPower = (i) => {
    const c = sets[i];
    if ((c.actionsLeft || 0) <= 0) return addLog("❌ Brak akcji.");
    if (c.classUsed) return addLog("❌ Umiejętność klasowa już użyta w tym odpoczynku.");

    setSets((prev) => {
      const next = [...prev];
      const me = { ...next[i] };
      me.classUsed = true;
      me.actionsLeft = (me.actionsLeft || 0) - 1;
      next[i] = me;
      return next;
    });

    // Tylko wpis do logu + opis co powinna robić — właściwe działanie możesz dodać w swoich testach/akcjach
    const note =
      c.clazz === "Wojownik" ? "Atak z maks. skutecznością (ignoruje pancerz) — 1×/odp." :
      c.clazz === "Łucznik" ? "Celny strzał — obniża obronę celu — 1×/odp." :
      c.clazz === "Strzelec" ? "Druzgocący strzał — −50% pancerza na 3 tury — 1×/odp." :
      c.clazz === "Mag" ? "Tarcza = 50% obrażeń poprzedniego czaru — 1×/odp." :
      "Dyplomata — rzut na charyzmę: przekierowanie ataku wroga — 1×/odp.";
    addLog(`🎖️ ${c.clazz} (Postać ${i + 1}): ${note}`);
  };

  /* ===== Tury: „Następna tura” ===== */
  const nextTurn = () => {
    // 1) przetwórz efekt Elfa (eksplozja)
    setSets((prev) => {
      const next = prev.map((c, idx) => {
        const me = { ...c };

        // odśwież akcje
        me.actionsLeft = 2;

        // Człowiek: buff wygasa z końcem tury, więc na początku następnej go czyścimy
        if (me.humanBuff && me.humanBuff.expiresTurn < turn + 1) {
          me.humanBuff = null;
        }

        // Elf: jeśli ładował w poprzedniej turze -> teraz eksplozja
        if (me.race === "Elf" && me.elfChargeUsed && me.elfChargedTurn === turn) {
          // sam −5 HP
          const before = me.hp || 0;
          me.hp = Math.max(0, before - 5);
          addLog(`🌩️ Elf (Postać ${idx + 1}) — eksplozja: −5 HP dla elfa, wrogowie −10 HP + ogłuszenie 1 turę.`);

          // maska Faeykai nie dotyczy elfa
          // obrażenia i ogłuszenia na wszystkich wrogach
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

          // zużycie efektu
          me.elfChargeUsed = false;
          me.elfChargedTurn = null;
        }

        // Faeykai: sprawdź maskę po ewentualnych zmianach HP
        if (me.race === "Faeykai") {
          const thresh = Math.ceil((me.maxHp || 20) * 0.1);
          if ((me.hp || 0) < thresh) me.faeykaiMaskBroken = true;
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

        return me;
      });

      return next;
    });

    // 2) wrogowie — zmniejsz czasy efektów
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
                      {/* Błogosławieństwo (na postać) */}
                      <label>
                        Błogosławieństwo → Postać:
                        <select
                          onChange={() => {}}
                          value=""
                          style={{ marginLeft: 6 }}
                        >
                          <option value="" disabled>Wybierz cel</option>
                          {sets.map((_, idx) => (
                            <option key={idx} value={idx}>Postać {idx + 1}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => {
                          const target = prompt("Podaj numer Postaci 1-4 dla Błogosławieństwa:");
                          const tIdx = Number(target) - 1;
                          if (tIdx >= 0 && tIdx < sets.length) useFaeykaiCharge(i, "blessPlayer", tIdx);
                        }}
                        disabled={(set.faeykaiChargesLeft || 0) <= 0}
                        title="1 akcja"
                      >
                        🌿 Rzuć błogosławieństwo
                      </button>

                      {/* Przekleństwo (na wroga) */}
                      <label>
                        Przekleństwo → Wróg:
                        <select onChange={() => {}} value="">
                          <option value="" disabled>Wybierz</option>
                          {ENEMIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </label>
                      <button
                        onClick={() => {
                          const id = prompt("Podaj id wroga: cultist / warrior (przekleństwo −3 do trafienia na 3 tury)");
                          if (id === "cultist" || id === "warrior") useFaeykaiCharge(i, "curseEnemy", id);
                        }}
                        disabled={(set.faeykaiChargesLeft || 0) <= 0}
                        title="1 akcja"
                      >
                        🕯️ Rzuć przekleństwo
                      </button>
                    </div>
                    <small>Zaklęcia Faeykai: jeśli HP &lt; 10% max i poza ojczyzną, zaklęcia mają −5 do trafienia (maska się odnawia po odpoczynku).</small>
                  </div>
                )}
              </div>

              {/* KLASOWE */}
              <div style={{ marginTop: 8, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
                <strong>Umiejętność klasowa:</strong> 1×/odp.
                <div>
                  <button onClick={() => useClassPower(i)} disabled={set.classUsed} title="1 akcja">
                    {set.classUsed ? "Użyto" : `Użyj (${set.clazz})`}
                  </button>
                </div>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <label>Broń
                  <select value={weapon} onChange={(e)=>setWeapon(e.target.value)}>
                    <option value="sword">Miecz krótki (STR)</option>
                    <option value="bow">Łuk (PER)</option>
                    <option value="staff">Kij magiczny (MAG)</option>
                  </select>
                </label>
                <label>Obrona celu <input type="number" value={defense} readOnly /></label>
                <label>Pancerz celu <input type="number" value={enemyArmor} readOnly /></label>
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
              <div>Obrona: {e.defense} | Pancerz: {e.armor} | Obrona magii: {e.magicDefense}</div>
              <div>Trafienie: {e.toHit} | Obrażenia: 1k{e.dmgDie} ({e.dmgType})</div>
              <div>❤️ HP: {enemyStates[e.id]} | 🌀 Ogłuszenie: {enemyStun[e.id]} | ☠ Przekleństwo: {enemyCurse[e.id]} t.</div>
              <button onClick={applyEnemy} style={{ marginTop: 6 }}>✔️ Ustaw jako cel</button>
            </div>
          ))}
        </div>

        {/* PRAWA KOLUMNA — ATAK WROGA */}
        <div>
          <h3>4) Atak wroga</h3>
          <button onClick={enemyAttack}>👹 Wróg atakuje aktywną postać</button>
        </div>
      </div>

      {/* Log */}
      <div style={{ marginTop: 16, background: "#111", color: "#eee", padding: 10, borderRadius: 8, maxHeight: 260, overflow: "auto", fontSize: 13 }}>
        {log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}


