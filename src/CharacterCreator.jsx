import React, { useState } from "react";

/* ====== POMOCNICZE ====== */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const d = (sides) => Math.floor(Math.random() * sides) + 1;

function statMod(value) {
  if (value <= 1) return 0;
  if (value <= 4) return 1;
  if (value <= 7) return 2;
  if (value <= 10) return 3;
  return 4;
}

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

/* ====== KOMPONENT ====== */
export default function BattleSimulator() {
  const [sets, setSets] = useState([
    { name: "", STR: null, DEX: null, PER: null, MAG: null, CHA: null, armor: 0, magicDefense: 0, hp: 20, essence: 20, maxHp: 20, maxEssence: 20 },
    { name: "", STR: null, DEX: null, PER: null, MAG: null, CHA: null, armor: 0, magicDefense: 0, hp: 20, essence: 20, maxHp: 20, maxEssence: 20 },
    { name: "", STR: null, DEX: null, PER: null, MAG: null, CHA: null, armor: 0, magicDefense: 0, hp: 20, essence: 20, maxHp: 20, maxEssence: 20 },
    { name: "", STR: null, DEX: null, PER: null, MAG: null, CHA: null, armor: 0, magicDefense: 0, hp: 20, essence: 20, maxHp: 20, maxEssence: 20 },
  ]);
  const [lockedSets, setLockedSets] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  const [weapon, setWeapon] = useState("sword");
  const [defense, setDefense] = useState(0);
  const [enemyArmor, setEnemyArmor] = useState(0);
  const [enemyMagicDefense, setEnemyMagicDefense] = useState(0);
  const [selectedSpellName, setSelectedSpellName] = useState("Magiczny pocisk");
  const [healTarget, setHealTarget] = useState(0);

  const [chosenEnemyId, setChosenEnemyId] = useState("cultist");
  const [enemyStates, setEnemyStates] = useState(
    ENEMIES.reduce((acc, e) => ({ ...acc, [e.id]: e.hp }), {})
  );

  const [log, setLog] = useState([]);
  const addLog = (line) => {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [`[${t}] ${line}`, ...prev]);
  };

  /* ====== Handlery ====== */
  const updateSetField = (i, key, val) => {
    setSets((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val === "" ? null : isNaN(val) ? val : Number(val) };
      return next;
    });
  };

  const lockSet = (i) => {
    const s = sets[i];
    if (Object.values(s).some((v) => v === null || v === "")) {
      addLog(`❌ Postać ${i + 1}: wszystkie pola muszą mieć wartość.`);
      return;
    }
    setLockedSets((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    addLog(`✔️ Postać ${i + 1} (${s.name}) zatwierdzona.`);
  };

  const restSet = (i) => {
    setSets((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], hp: next[i].maxHp, essence: next[i].maxEssence };
      return next;
    });
    addLog(`💤 Postać ${i + 1} (${sets[i].name || "bez nazwy"}) odpoczęła: HP=${sets[i].maxHp}, Esencja=${sets[i].maxEssence}.`);
  };

  const applyEnemy = () => {
    const enemy = ENEMIES.find((e) => e.id === chosenEnemyId);
    if (!enemy) return;
    setDefense(enemy.defense);
    setEnemyArmor(enemy.armor);
    setEnemyMagicDefense(enemy.magicDefense);
    addLog(`🎯 Wybrano wroga: ${enemy.name}`);
  };

  const getActiveStats = () => sets[activeSet];

  const setActiveEssence = (newVal) => {
    setSets((prev) => {
      const next = [...prev];
      const maxE = next[activeSet].maxEssence ?? 20;
      next[activeSet] = { ...next[activeSet], essence: clamp(newVal, 0, maxE) };
      return next;
    });
  };

  const damageEnemy = (enemyId, dmg) => {
    setEnemyStates((prev) => {
      const next = { ...prev };
      next[enemyId] = Math.max(0, (next[enemyId] ?? 0) - dmg);
      return next;
    });
    addLog(`💔 Wróg (${enemyId}) otrzymał ${dmg} obrażeń (HP: ${enemyStates[enemyId] - dmg} pozostało).`);
  };

  /* ====== Test ataku ====== */
  const doAttack = () => {
    if (!lockedSets[activeSet]) {
      addLog("❌ Najpierw zatwierdź wybraną postać.");
      return;
    }
    const stats = getActiveStats();
    const w = weaponData[weapon];
    const statVal = Number(stats[w.stat] ?? 0);
    const roll20 = d(20);
    const toHit = roll20 + statVal;
    const hit = toHit >= Number(defense);

    addLog(`⚔️ Atak (${w.name}) — k20=${roll20} + ${w.stat}(${statVal}) = ${toHit} vs Obrona ${defense} → ${hit ? "✅ TRAFIENIE" : "❌ PUDŁO"}`);
    if (!hit) return;

    const rawDie = d(w.dmgDie);
    const afterArmor = Math.max(0, rawDie - Number(enemyArmor));
    addLog(`🗡️ Obrażenia: k${w.dmgDie}=${rawDie} − Pancerz ${enemyArmor} = ${afterArmor}`);

    if (afterArmor > 0) damageEnemy(chosenEnemyId, afterArmor);
  };

  /* ====== Zaklęcia ====== */
  const castSelectedSpell = () => {
    if (!lockedSets[activeSet]) {
      addLog("❌ Najpierw zatwierdź wybraną postać.");
      return;
    }
    const spell = SPELLS[selectedSpellName];
    if (!spell) return;
    const stats = getActiveStats();
    if (stats.essence < spell.cost) {
      addLog(`❌ Za mało esencji (${stats.essence}) na „${selectedSpellName}” (koszt ${spell.cost}).`);
      return;
    }
    const MAG = Number(stats.MAG ?? 0);
    let logLines = [`✨ „${selectedSpellName}” — koszt ${spell.cost} (Esencja przed: ${stats.essence})`];
    setActiveEssence(stats.essence - spell.cost);

    if (spell.type === "damage") {
      const roll20 = d(20);
      const toHit = roll20 + MAG;
      const hit = toHit >= Number(defense);
      logLines.push(`🎯 Trafienie: k20=${roll20} + MAG(${MAG}) = ${toHit} vs Obrona ${defense} → ${hit ? "✅" : "❌"}`);
      if (!hit) return addLog(logLines.join("\n"));
      const rollDmg = d(spell.dmgDie);
      const mod = statMod(MAG);
      const raw = rollDmg + mod;
      const reduced = Math.max(0, raw - Number(enemyMagicDefense));
      logLines.push(`💥 Obrażenia: k${spell.dmgDie}=${rollDmg} + mod=${mod} = ${raw}`);
      logLines.push(`🛡️ Redukcja: −${enemyMagicDefense} → ${reduced}`);
      addLog(logLines.join("\n"));
      if (reduced > 0) damageEnemy(chosenEnemyId, reduced);
      return;
    }

    if (spell.type === "heal") {
      const rollHeal = d(spell.healDie);
      const casterIndex = activeSet;
      const targetIndex = healTarget;
      setSets((prev) => {
        const next = [...prev];
        const caster = { ...next[casterIndex] };
        const target = { ...next[targetIndex] };

        caster.essence = Math.max(0, caster.essence - spell.cost);
        target.hp = Math.min(target.maxHp ?? 20, (target.hp ?? 0) + rollHeal);

        next[casterIndex] = caster;
        next[targetIndex] = target;
        return next;
      });
      logLines.push(`👤 ${sets[casterIndex].name || "Postać " + (casterIndex + 1)} leczy ${sets[targetIndex].name || "Postać " + (targetIndex + 1)} → +${rollHeal} HP`);
      addLog(logLines.join("\n"));
      return;
    }

    logLines.push("🌑 Efekt zaklęcia zastosowany.");
    addLog(logLines.join("\n"));
  };

  /* ====== Atak wroga ====== */
  const enemyAttack = () => {
    const enemy = ENEMIES.find((e) => e.id === chosenEnemyId);
    const stats = getActiveStats();
    if (!enemy) return addLog("❌ Nie wybrano wroga.");
    let logLines = [`👹 Wróg: ${enemy.name}`];
    const roll20 = d(20);
    const hit = roll20 >= enemy.toHit;
    logLines.push(`🎲 Trafienie: k20=${roll20} vs ${enemy.toHit} → ${hit ? "✅" : "❌"}`);
    if (!hit) return addLog(logLines.join("\n"));
    const rollDmg = d(enemy.dmgDie);
    logLines.push(`💥 Obrażenia: k${enemy.dmgDie}=${rollDmg}`);
    let reduced = rollDmg;
    if (enemy.dmgType === "magiczny") {
      reduced = Math.max(0, rollDmg - Number(stats.magicDefense ?? 0));
      logLines.push(`🛡️ Redukcja magią ${stats.magicDefense} → ${reduced}`);
    } else {
      reduced = Math.max(0, rollDmg - Number(stats.armor ?? 0));
      logLines.push(`🛡️ Redukcja pancerzem ${stats.armor} → ${reduced}`);
    }
    setSets((prev) => {
      const next = [...prev];
      const current = { ...next[activeSet] };
      current.hp = Math.max(0, (current.hp ?? 0) - reduced);
      next[activeSet] = current;
      return next;
    });
    logLines.push(`❤️ HP gracza −${reduced}`);
    addLog(logLines.join("\n"));
  };

  /* ====== UI ====== */
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
        {/* LEWA KOLUMNA */}
        <div>
          <h2>1) Statystyki postaci</h2>
          {sets.map((set, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, marginBottom: 8 }}>
              <strong>Postać {i + 1}</strong>
              <input type="radio" checked={activeSet === i} onChange={() => setActiveSet(i)} />
              <div>
                <label>Imię: <input value={set.name} onChange={(e) => updateSetField(i, "name", e.target.value)} /></label>
                <label>HP: <input type="number" value={set.hp} onChange={(e) => updateSetField(i, "hp", e.target.value)} /></label>
                <label>Max HP: <input type="number" value={set.maxHp} onChange={(e) => updateSetField(i, "maxHp", e.target.value)} /></label>
                <label>Esencja: <input type="number" value={set.essence} onChange={(e) => updateSetField(i, "essence", e.target.value)} /></label>
                <label>Max Esencja: <input type="number" value={set.maxEssence} onChange={(e) => updateSetField(i, "maxEssence", e.target.value)} /></label>
              </div>
              <div>
                {["STR","DEX","PER","MAG","CHA"].map((k) => (
                  <label key={k}>{k}: 
                    <input type="number" value={set[k] ?? ""} onChange={(e)=>updateSetField(i,k,e.target.value)} />
                  </label>
                ))}
              </div>
              <div>
                <label>Pancerz: <input type="number" value={set.armor} onChange={(e)=>updateSetField(i,"armor",e.target.value)} /></label>
                <label>Obrona magii: <input type="number" value={set.magicDefense} onChange={(e)=>updateSetField(i,"magicDefense",e.target.value)} /></label>
              </div>
              <button onClick={()=>lockSet(i)}>✔️ Zatwierdź</button>
              <button onClick={()=>restSet(i)}>💤 Odpocznij</button>
            </div>
          ))}
          <div style={{ border:"1px solid #ddd", padding:8, borderRadius:8 }}>
            <h2>2) Test walki</h2>
            <h3>Atak</h3>
            <select value={weapon} onChange={(e)=>setWeapon(e.target.value)}>
              <option value="sword">Miecz (Siła)</option>
              <option value="bow">Łuk (Percepcja)</option>
              <option value="staff">Kij (Magia)</option>
            </select>
            <label>Obrona: <input type="number" value={defense} readOnly /></label>
            <label>Pancerz: <input type="number" value={enemyArmor} readOnly /></label>
            <button onClick={doAttack}>⚔️ Atak</button>
            <h3>Zaklęcia</h3>
            <select value={selectedSpellName} onChange={(e)=>setSelectedSpellName(e.target.value)}>
              {Object.keys(SPELLS).map((n)=><option key={n}>{n}</option>)}
            </select>
            {selectedSpellName === "Zasklepienie ran" && (
              <label>
                Cel leczenia:
                <select value={healTarget} onChange={(e)=>setHealTarget(Number(e.target.value))}>
                  {sets.map((s, idx)=><option key={idx} value={idx}>Postać {idx+1}</option>)}
                </select>
              </label>
            )}
            <label>Obrona magii: <input type="number" value={enemyMagicDefense} readOnly /></label>
            <label>Esencja: <input type="number" value={getActiveStats().essence} readOnly /></label>
            <button onClick={castSelectedSpell}>✨ Zaklęcie</button>
          </div>
        </div>

        {/* ŚRODKOWA KOLUMNA */}
        <div>
          <h2>3) Wrogowie</h2>
          {ENEMIES.map((enemy)=>(
            <div key={enemy.id} style={{border:"1px solid #ddd", padding:8, marginBottom:8}}>
              <strong>{enemy.name}</strong>
              <p>Obrona: {enemy.defense}, Pancerz: {enemy.armor}, Obrona magii: {enemy.magicDefense}</p>
              <p>Trafienie: {enemy.toHit}, Obrażenia: 1k{enemy.dmgDie} ({enemy.dmgType})</p>
              <p>HP: {enemyStates[enemy.id]}</p>
              <button onClick={()=>{setChosenEnemyId(enemy.id); applyEnemy();}}>🎯 Wybierz</button>
            </div>
          ))}
        </div>

        {/* PRAWA KOLUMNA */}
        <div>
          <h2>4) Atak wroga</h2>
          <button onClick={enemyAttack}>👹 Atakuj</button>
        </div>
      </div>

      <div style={{marginTop:16, background:"#111", color:"#eee", padding:8, borderRadius:8, maxHeight:250, overflow:"auto"}}>
        {log.map((line,i)=><div key={i}>{line}</div>)}
      </div>
    </div>
  );
}
