import React, { useState, useEffect, useRef } from "react";

/* ====== DANE ====== */
const races = {
  Ludzie: {
    description: "test ludzie",
    racialPassive: "test 123",
    img: "/images/ludzie.png",
    subraces: {
      "Ludzie Słońca": { description: "test ludzi slonca", passive: "test ludzi slonca", img: "/images/ludzie_slonca.png" },
      "Ludzie Księżyca": { description: "test ludzie księzyca", passive: "test ludzie księzyca", img: "/images/ludzie_ksiezyca.png" },
      "Ludzie Mrocznego Słońca": { description: "test ludzi mrocznego slonca", passive: "test ludzi mrocznego slonca", img: "/images/ludzie_mrocznego_slonca.png" },
      "Ludzie Mrocznego Księżyca": { description: "test ludzie mrocznego ksiezyca", passive: "test ludzie mrocznego ksiezyca", img: "/images/ludzie_mrocznego_ksiezyca.png" },
    },
  },
  Krasnoludy: {
    description: "test krasnoludy",
    racialPassive: "test 456",
    img: "/images/krasnoludy.png",
    subraces: {
      "Krasnoludy Diamentu": { description: "...", passive: "...", img: "/images/krasnoludy_diament.png" },
      "Krasnoludy Rubinu": { description: "...", passive: "...", img: "/images/krasnoludy_rubin.png" },
      "Krasnoludy Szafira": { description: "...", passive: "...", img: "/images/krasnoludy_szafir.png" },
      "Krasnoludy Szmaragdu": { description: "...", passive: "...", img: "/images/krasnoludy_szmaragd.png" },
    },
  },
  Elfy: {
    description: "test elfy",
    racialPassive: "test 789",
    img: "/images/elfy.png",
    subraces: {
      "Pierwotne Elfy Ognia": { description: "test Elfy Ognia", passive: "test Elfy Ognia", img: "/images/elfy_ognia.png" },
      "Pierwotne Elfy Wody": { description: "test Elfy Wody", passive: "test Elfy Wody", img: "/images/elfy_wody.png" },
      "Pierwotne Elfy Ziemii": { description: "test Elfy Ziemii", passive: "test Elfy Ziemii", img: "/images/elfy_ziemii.png" },
      "Pierwotne Elfy Powietrza": { description: "test Elfy Powietrza", passive: "test Elfy Powietrza", img: "/images/elfy_powietrza.png" },
    },
  },
  Faeykai: {
    description: "test dziecko Asi",
    racialPassive: "test 000",
    img: "/images/faeykai.png",
    subraces: {
      "Faeykai Życia - lato": { description: "test dziecko Asi 1", passive: "test dziecko Asi 12", img: "/images/faeykai_lato.png" },
      "Faeykai Życia - wiosna": { description: "test dziecko Asi 2", passive: "test dziecko Asi 23", img: "/images/faeykai_wiosna.png" },
      "Faeykai Śmierci - jesień": { description: "test dziecko Asi 3", passive: "test dziecko Asi 34", img: "/images/faeykai_jesien.png" },
      "Faeykai Śmierci - zima": { description: "test dziecko Asi 4", passive: "test dziecko Asi 45", img: "/images/faeykai_zima.png" },
    },
  },
};

const passives = {
  Wojownik:
    "Raz na odpoczynek wojownik może zaatakować z maksymalną skutecznością (czyli wchodzą pełne obrażenia, nie liczy się pancerz ani uniki).",
  Łucznik:
    "Raz na odpoczynek łucznik może oddać celny strzał który obniża przeciwnikowi o -5 rzuty na unik (czas trwania 3 tury)",
  Strzelec:
    "Raz na odpoczynek strzelec może oddać druzgocący strzał który obniża wartość pancerza przeciwnika o 50% na 3 tury.",
  Mag:
    "Raz na odpoczynek mag, po rzuceniu zaklęcia może dodać żywioł zaklęcia i 50% zadanych obrażeń jako tarczę dla siebie. Każdy kto zaatakuje maga z tarczą otrzyma obrażenia równe wysokości tarczy.",
  Dyplomata:
    "Raz na odpoczynek dyplomata może wykonać rzut na charyzmę aby zmusić jednego wroga do zaatakowania konkretnego celu. Jeśli atak się odbędzie wybrany wróg nie może już zaatakować w swojej turze.",
};

// Statystyki wg Twoich nazw
const STATS = [
  { key: "strength", label: "Siła" },
  { key: "dexterity", label: "Zręczność" },
  { key: "perception", label: "Spostrzegawczość" },
  { key: "charisma", label: "Charyzma" },
  { key: "magic", label: "magia" },
];

/* ===== Fallback obrazków PNG ⇄ JPG ===== */
const swapExt = (url) => {
  if (!url) return url;
  if (/\.png$/i.test(url)) return url.replace(/\.png$/i, ".jpg");
  if (/\.(jpg|jpeg)$/i.test(url)) return url.replace(/\.(jpg|jpeg)$/i, ".png");
  return url;
};
const ImageWithFallback = ({ src, alt, style }) => {
  const [source, setSource] = useState(src);
  const [triedAlt, setTriedAlt] = useState(false);
  useEffect(() => {
    setSource(src);
    setTriedAlt(false);
  }, [src]);
  if (!source) return null;
  return (
    <img
      src={source}
      alt={alt}
      style={style}
      onError={() => {
        if (!triedAlt) {
          setSource(swapExt(source));
          setTriedAlt(true);
        } else {
          setSource(null);
        }
      }}
    />
  );
};

/* ===== Symulator – pomocnicze ===== */
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

export default function CharacterCreator() {
  const [tab, setTab] = useState("creator");

  // --- kreator ---
  const [character, setCharacter] = useState({
    name: "",
    race: "",
    subrace: "",
    passive: "",
    life: 0,
    essence: 0,
    armor: 0,
    strength: null,
    dexterity: null,
    perception: null,
    charisma: null,
    magic: null,
  });
  const [rolls, setRolls] = useState([]);
  const [activeStat, setActiveStat] = useState(null);

  // --- symulator ---
  const [rolledValues, setRolledValues] = useState([]);
  const emptyStats = { STR: null, DEX: null, PER: null, MAG: null, CHA: null };
  const [simStatsList, setSimStatsList] = useState([ { ...emptyStats }, { ...emptyStats }, { ...emptyStats }, { ...emptyStats } ]);
  const [lockedList, setLockedList] = useState([false, false, false, false]);
  const [activeSet, setActiveSet] = useState(0);

  const [log, setLog] = useState([]);

  const [weapon, setWeapon] = useState("sword");
  const [defense, setDefense] = useState(12);
  const [enemyArmor, setEnemyArmor] = useState(2);
  const [magicDefense, setMagicDefense] = useState(0);

  const [simEssence, setSimEssence] = useState(20);
  const [selectedSpell, setSelectedSpell] = useState("");

  const ENEMIES = [
    { name: "Kultysta", defense: 12, armor: 1, mdef: 6 },
    { name: "Wojownik", defense: 17, armor: 3, mdef: 1 },
  ];
  const [selectedEnemy, setSelectedEnemy] = useState(null);

  const SPELLS = [
    { id: "magic_missile", name: "Magiczny pocisk", cost: 3, dmgDie: 6, type: "damage", needsHit: true },
    { id: "energy_burst", name: "Wybuch energii", cost: 5, dmgDie: 4, type: "damage", needsHit: true },
    { id: "heal_seal", name: "Zasklepienie ran", cost: 5, dmgDie: 6, type: "heal", needsHit: false },
    { id: "blind", name: "Oślepienie", cost: 8, type: "blind", needsHit: false },
  ];

  function addLog(line) {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`[${stamp}] ${line}`, ...prev].slice(0, 200));
  }

  function rollFive() {
    const mods = [2, 1, 0, -1, -2];
    const rolls = mods.map((m) => d(6) + m);
    setRolledValues(rolls);
    setSimStatsList([{ ...emptyStats }, { ...emptyStats }, { ...emptyStats }, { ...emptyStats }]);
    setLockedList([false, false, false, false]);
    setActiveSet(0);
    addLog(
      `Wylosowane wartości: ${rolls
        .map((v, i) => `${v}(${mods[i] >= 0 ? "+" : ""}${mods[i]})`)
        .join(", ")}`
    );
  }

  function lockStatsFor(index, values) {
    if (Object.values(values).some((v) => v === null || v === "")) {
      addLog(`❌ Zestaw #${index + 1}: każda statystyka musi otrzymać wartość.`);
      return;
    }
    setSimStatsList((prev) => {
      const copy = prev.slice();
      copy[index] = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, Number(v)])
      );
      return copy;
    });
    setLockedList((prev) => {
      const copy = prev.slice();
      copy[index] = true;
      return copy;
    });
    addLog(
      `✔️ Zestaw #${index + 1} zatwierdzony: ${Object.entries(values)
        .map(([k, v]) => `${k} ${v} (mod ${statMod(Number(v))})`)
        .join(", ")}`
    );
  }

  function lockStats(values) {
    lockStatsFor(activeSet, values);
  }

  function selectEnemy(e) {
    setSelectedEnemy(e);
    setDefense(e.defense);
    setEnemyArmor(e.armor);
    setMagicDefense(e.mdef);
    addLog(`🎯 Wybrano wroga: ${e.name} — Obrona ${e.defense}, Pancerz ${e.armor}, Obrona przed magią ${e.mdef}.`);
  }

  function doAttack() {
    const stats = simStatsList[activeSet];
    if (!lockedList[activeSet]) {
      addLog(`❌ Najpierw zatwierdź statystyki wybranego zestawu (#${activeSet + 1}).`);
      return;
    }
    const w = weaponData[weapon];
    const usedVal =
      w.stat === "STR" ? Number(stats.STR) || 0 :
      w.stat === "PER" ? Number(stats.PER) || 0 :
      Number(stats.MAG) || 0;

    const toHitRoll = d(20);
    const toHitTotal = toHitRoll + usedVal;
    const hit = toHitTotal >= Number(defense);

    addLog(`🗡️ Atak: ${w.name} (używa ${w.stat})`);
    addLog(`• Rzut na trafienie: k20=${toHitRoll} + ${usedVal} = ${toHitTotal} vs Obrona ${defense} → ${hit ? "✅ TRAFIENIE" : "❌ PUDŁO"}`);

    if (!hit) return;

    const rawDie = d(w.dmgDie);
    const mod = statMod(usedVal);
    const raw = rawDie + mod;
    const dmg = Math.max(0, raw - Number(enemyArmor));
    addLog(`• Obrażenia: k${w.dmgDie}=${rawDie} + mod(${w.stat})=${mod} = ${raw}`);
    addLog(`• Redukcja pancerza: −${enemyArmor}`);
    addLog(`➡️ **Wynik obrażeń**: ${dmg}`);
  }

  function castSpell() {
    const stats = simStatsList[activeSet];
    if (!lockedList[activeSet]) {
      addLog(`❌ Najpierw zatwierdź statystyki wybranego zestawu (#${activeSet + 1}).`);
      return;
    }
    if (!selectedSpell) {
      addLog("❌ Wybierz zaklęcie.");
      return;
    }

    const spell = SPELLS.find((s) => s.id === selectedSpell);
    if (!spell) {
      addLog("❌ Nieznane zaklęcie.");
      return;
    }
    if (simEssence < spell.cost) {
      addLog(`❌ Za mało esencji: potrzebujesz ${spell.cost}, masz ${simEssence}.`);
      return;
    }

    const MAG = Number(stats.MAG) || 0;
    const toHitRoll = spell.needsHit ? d(20) : null;

    addLog(`✨ Zaklęcie: ${spell.name} (koszt ${spell.cost} esencji)`);
    setSimEssence((v) => Math.max(0, v - spell.cost));

    if (spell.type === "damage") {
      const toHitTotal = toHitRoll + MAG;
      const hit = toHitTotal >= Number(defense);
      addLog(`• Rzut na trafienie: k20=${toHitRoll} + MAG(${MAG}) = ${toHitTotal} vs Obrona ${defense} → ${hit ? "✅ TRAFIENIE" : "❌ PUDŁO"}`);
      if (!hit) return;

      const rawDie = d(spell.dmgDie);
      const mod = statMod(MAG);
      const raw = rawDie + mod;
      const afterMDef = Math.max(0, raw - Number(magicDefense));
      addLog(`• Obrażenia: k${spell.dmgDie}=${rawDie} + mod(MAG)=${mod} = ${raw}`);
      addLog(`• Obrona przed magią: −${magicDefense}`);
      addLog(`➡️ **Wynik obrażeń magicznych**: ${afterMDef}`);
      return;
    }

    if (spell.type === "heal") {
      const healDie = d(spell.dmgDie);
      addLog(`• Leczenie: k6=${healDie}`);
      addLog(`➡️ **Wyleczono**: ${healDie} punktów obrażeń`);
      return;
    }

    if (spell.type === "blind") {
      addLog("• Efekt: Oślepienie (ustalcie dokładne działanie w zasadach).");
      addLog("➡️ Zaklęcie zadziałało — brak rzutów na obrażenia.");
      return;
    }
  }

  // --- MAPA ---
  const [mapImage, setMapImage] = useState("");
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(4);
  const [mode, setMode] = useState("draw"); // "draw" | "erase"

  // Zoom/pan
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Prawy-przyciskowe panning
  const [isRightPanning, setIsRightPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mouseStartRef = useRef({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // dopasowanie rozmiaru canvasu do kontenera (z zachowaniem rysunku)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = container;

      // zachowaj dotychczasowy rysunek
      const prev = document.createElement("canvas");
      prev.width = canvas.width;
      prev.height = canvas.height;
      const pctx = prev.getContext("2d");
      pctx.drawImage(canvas, 0, 0);

      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);

      const ctx = canvas.getContext("2d");
      // współrzędne logiczne ≈ CSS px
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // przywróć rysunek w skali do nowych wymiarów (tu 1:1 do CSS)
      if (prev.width && prev.height) {
        ctx.drawImage(prev, 0, 0, canvas.width / dpr, canvas.height / dpr);
      }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [tab]);

  // Rysowanie lewym przyciskiem z korekcją zoomu i panningu
  useEffect(() => {
    if (tab !== "map") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPos = (e) => {
      // BIERZEMY RECT Z KONTENERA (nietransformowanego), nie z canvasu
      const rect = containerRef.current.getBoundingClientRect();
      const isTouch = e.touches && e.touches.length;
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;

      const xScreen = clientX - rect.left;
      const yScreen = clientY - rect.top;

      // odwrócenie transformacji CSS: translate(panX, panY) scale(scale)
      const xWorld = (xScreen - panX) / scale;
      const yWorld = (yScreen - panY) / scale;
      return { x: xWorld, y: yWorld };
    };

    const start = (e) => {
      // tylko lewy przycisk (0) — rysowanie
      if (e.button !== undefined && e.button !== 0) return;
      drawing = true;
      const { x, y } = getPos(e);
      lastX = x;
      lastY = y;
    };

    const move = (e) => {
      if (!drawing) return;
      const { x, y } = getPos(e);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // stała grubość w pikselach ekranu niezależnie od zoomu
      ctx.lineWidth = brushSize / scale;
      ctx.strokeStyle = brushColor;
      ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
      e.preventDefault();
    };

    const end = () => {
      drawing = false;
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    // touch
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }, [tab, brushColor, brushSize, mode, scale, panX, panY]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    // czyścimy obszar logiczny (dopasowany do CSS przez setTransform)
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  const handleMapFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setMapImage(url);
  };

  // Panning prawym przyciskiem
  const onMouseDownMap = (e) => {
    e.preventDefault(); // blokuj menu kontekstowe / zaznaczanie
    if (e.button === 2) {
      setIsRightPanning(true);
      panStartRef.current = { x: panX, y: panY };
      mouseStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onMouseMoveMap = (e) => {
    if (isRightPanning) {
      const dx = e.clientX - mouseStartRef.current.x;
      const dy = e.clientY - mouseStartRef.current.y;
      setPanX(panStartRef.current.x + dx);
      setPanY(panStartRef.current.y + dy);
      e.preventDefault();
    }
  };
  const onMouseUpMap = (e) => {
    if (e.button === 2 && isRightPanning) {
      setIsRightPanning(false);
      e.preventDefault();
    }
  };
  const onContextMenu = (e) => {
    e.preventDefault(); // wyłącz natywne menu
  };

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  // Zoom na kółku myszy (bez trzymania przycisku) — zoom do kursora
  const onWheelMap = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - panX) / scale;
    const worldY = (mouseY - panY) / scale;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = clamp(scale * zoomFactor, 0.2, 6);

    const newPanX = mouseX - worldX * newScale;
    const newPanY = mouseY - worldY * newScale;

    setScale(newScale);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  const resetView = () => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  };
  /* ====== Kreator – handlery ====== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "race") {
      setCharacter((prev) => ({ ...prev, race: value, subrace: "" }));
    } else {
      setCharacter((prev) => ({ ...prev, [name]: value }));
    }
  };

  const rollDice = () => {
    const mods = [2, 1, 0, -1, -2];
    const newRolls = mods.map((m, i) => ({ id: Date.now() + i, value: Math.floor(Math.random() * 6) + 1 + m }));
    const cleared = { strength: null, dexterity: null, perception: null, charisma: null, magic: null };
    setCharacter((prev) => ({ ...prev, ...cleared }));
    setRolls(newRolls);
    setActiveStat(null);
  };

  const handleStatClick = (key) => {
    if (character[key] !== null) {
      setRolls((prev) => [...prev, { id: Date.now(), value: character[key] }]);
      setCharacter((prev) => ({ ...prev, [key]: null }));
      setActiveStat(key);
    } else {
      setActiveStat(key);
    }
  };

  const handleRollClick = (rollId) => {
    if (!activeStat) return;
    setRolls((prev) => {
      const idx = prev.findIndex((r) => r.id === rollId);
      if (idx === -1) return prev;
      const chosen = prev[idx];
      setCharacter((c) => ({ ...c, [activeStat]: chosen.value }));
      setActiveStat(null);
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };

  /* ====== UI – zakładki ====== */
  const Tabs = () => (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {[
        { id: "creator", label: "Kreator postaci" },
        { id: "sim", label: "Symulator walki" },
        { id: "map", label: "Mapa" },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            padding: "8px 14px",
            border: "1px solid #ccc",
            borderBottom: tab === t.id ? "2px solid #333" : "1px solid #ccc",
            background: tab === t.id ? "#f7f7f7" : "#fff",
            fontWeight: tab === t.id ? 700 : 400,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 16, height: "100%", minHeight: "100vh" }}>
      <Tabs />

      {/* ====== KREATOR ====== */}
      {tab === "creator" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 24, alignItems: "start" }}>
          {/* Lewa kolumna */}
          <div>
            <h2>Imię</h2>
            <input type="text" name="name" value={character.name} onChange={handleChange} />

            <h2 style={{ marginTop: 16 }}>Rasa</h2>
            <select name="race" value={character.race} onChange={handleChange}>
              <option value="">Wybierz rasę</option>
              {Object.keys(races).map((race) => (
                <option key={race} value={race}>
                  {race}
                </option>
              ))}
            </select>

            {character.race && (
              <>
                <h3 style={{ marginTop: 12 }}>Podrasa</h3>
                <select name="subrace" value={character.subrace} onChange={handleChange}>
                  <option value="">Wybierz podrase</option>
                  {Object.keys(races[character.race].subraces).map((sr) => (
                    <option key={sr} value={sr}>
                      {sr}
                    </option>
                  ))}
                </select>

                <p>
                  <strong>Pasywka Rasowa:</strong> {races[character.race].racialPassive}
                </p>
                {character.subrace && (
                  <p>
                    <strong>Pasywka Podrasy:</strong> {races[character.race].subraces[character.subrace].passive}
                  </p>
                )}
              </>
            )}

            <h2 style={{ marginTop: 16 }}>Pasywki klasowe</h2>
            <select name="passive" value={character.passive} onChange={handleChange}>
              <option value="">Wybierz pasywkę</option>
              {Object.keys(passives).map((pass) => (
                <option key={pass} value={pass}>
                  {pass}
                </option>
              ))}
            </select>
            {character.passive && <p style={{ marginTop: 8 }}>{passives[character.passive]}</p>}
          </div>

          {/* Środkowa kolumna */}
          <div>
            <h2>Statystyki stałe</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 8 }}>
              <label>
                Życie
                <input type="number" name="life" value={character.life} onChange={handleChange} />
              </label>
              <label>
                Esencja
                <input type="number" name="essence" value={character.essence} onChange={handleChange} />
              </label>
              <label>
                Pancerz
                <input type="number" name="armor" value={character.armor} onChange={handleChange} />
              </label>
            </div>

            <div style={{ marginTop: 10 }}>
              <button onClick={rollDice}>Rzut kośćmi</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <h3>Kości</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {rolls.length === 0 ? (
                  <span style={{ opacity: 0.7 }}>Brak kości w puli</span>
                ) : (
                  rolls.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => handleRollClick(r.id)}
                      title={activeStat ? `Przypisz do: ${activeStat}` : "Najpierw kliknij statystykę"}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: activeStat ? "#4fa3ff" : "#6aa9ff",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: activeStat ? "pointer" : "not-allowed",
                        userSelect: "none",
                      }}
                    >
                      {r.value}
                    </div>
                  ))
                )}
              </div>

              <h3>Przypisywanie do statystyk</h3>
              {STATS.map((s) => (
                <div
                  key={s.key}
                  onClick={() => handleStatClick(s.key)}
                  style={{
                    marginBottom: 10,
                    padding: "4px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background:
                      character[s.key] !== null
                        ? "#d4edda"
                        : activeStat === s.key
                        ? "#fceabb"
                        : "transparent",
                  }}
                >
                  <strong style={{ width: 200, display: "inline-block" }}>{s.label}:</strong>
                  <span style={{ fontWeight: 700 }}>
                    {character[s.key] !== null ? character[s.key] : activeStat === s.key ? "Wybierz kość" : "-"}
                  </span>
                </div>
              ))}

              <h2 style={{ marginTop: 16 }}>Ekwipunek</h2>
              <p style={{ opacity: 0.7 }}>(dodamy w następnej iteracji)</p>
            </div>
          </div>

          {/* Prawa kolumna — Lore */}
          <div>
            <h2>Lore</h2>
            {character.race && (
              <>
                {races[character.race].img && (
                  <ImageWithFallback
                    src={races[character.race].img}
                    alt={character.race}
                    style={{ width: "100%", borderRadius: 8, marginBottom: 12, objectFit: "cover" }}
                  />
                )}
                <p>{races[character.race].description}</p>
                {character.subrace && <p>{races[character.race].subraces[character.subrace].description}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ====== SYMULATOR ====== */}
{tab === "sim" && (
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h1>⚔️ Symulator testu walki</h1>
          <p>Rozdaj 5 rzutów k6 z modyfikatorami (+2, +1, 0, −1, −2). Wybierz broń lub rzuć zaklęcie, wybierz wroga po prawej i wykonaj akcję.</p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 16,
              marginTop: 16,
              alignItems: "start",
            }}
          >
            {/* LEWA KOLUMNA: Statystyki + Test walki */}
            <div>
              {/* STATYSTYKI — wspólne rzuty */}
              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <h2>1) Statystyki postaci (4 zestawy)</h2>
                <button onClick={rollFive}>🎲 Rzuć 5×k6</button>

                {rolledValues.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rolledValues.map((v, i) => (
                      <span
                        key={i}
                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #bbb", background: "#eee", fontSize: 12 }}
                      >
                        #{i + 1}: {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* 4 niezależne zestawy statystyk */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
                  {simStatsList.map((stats, idx) => (
                    <div key={idx} style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong>Zestaw #{idx + 1}</strong>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="radio"
                            name="activeSet"
                            checked={activeSet === idx}
                            onChange={() => setActiveSet(idx)}
                          />
                          Użyj tego zestawu
                        </label>
                      </div>

                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(5, 1fr)" }}>
                        {["STR", "DEX", "PER", "MAG", "CHA"].map((k) => (
                          <label key={k} style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
                            {k}
                            <input
                              type="number"
                              value={stats[k] ?? ""}
                              disabled={lockedList[idx]}
                              onChange={(e) =>
                                setSimStatsList((prev) => {
                                  const copy = prev.slice();
                                  copy[idx] = { ...copy[idx], [k]: e.target.value === "" ? null : Number(e.target.value) };
                                  return copy;
                                })
                              }
                            />
                            <small style={{ opacity: 0.7 }}>
                              mod: {stats[k] != null ? statMod(Number(stats[k])) : "-"}
                            </small>
                          </label>
                        ))}
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button onClick={() => lockStatsFor(idx, stats)} disabled={lockedList[idx]}>
                          ✔️ Zatwierdź zestaw
                        </button>
                        {lockedList[idx] && <span style={{ fontSize: 12, color: "#2e7d32" }}>Zatwierdzony</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TEST WALKI */}
              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <h2>2) Test walki</h2>

                {/* BROŃ / OBRONA / PANCERZ */}
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <label>
                    Broń
                    <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
                      <option value="sword">Miecz krótki (Siła)</option>
                      <option value="bow">Łuk (Spostrzegawczość)</option>
                      <option value="staff">Kij magiczny (Magia)</option>
                    </select>
                  </label>
                  <label>
                    Obrona celu
                    <input type="number" value={defense} onChange={(e) => setDefense(Number(e.target.value))} />
                  </label>
                  <label>
                    Pancerz celu
                    <input type="number" value={enemyArmor} onChange={(e) => setEnemyArmor(Number(e.target.value))} />
                  </label>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button onClick={doAttack}>⚔️ Wykonaj atak bronią</button>
                </div>

                {/* ZAKLĘCIA */}
                <div style={{ borderTop: "1px solid #eee", marginTop: 12, paddingTop: 12 }}>
                  <h3>Zaklęcia</h3>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr 1fr" }}>
                    <label>
                      Zaklęcie
                      <select value={selectedSpell} onChange={(e) => setSelectedSpell(e.target.value)}>
                        <option value="">— wybierz zaklęcie —</option>
                        {SPELLS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (koszt {s.cost})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Obrona przed magią
                      <input
                        type="number"
                        value={magicDefense}
                        onChange={(e) => setMagicDefense(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Esencja (max 20)
                      <input
                        type="number"
                        value={simEssence}
                        min={0}
                        max={20}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setSimEssence(Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : 0);
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button onClick={castSpell}>✨ Rzuć zaklęcie</button>
                  </div>
                </div>

                {/* LOG */}
                <div
                  style={{
                    background: "#111",
                    color: "#eee",
                    borderRadius: 6,
                    padding: 10,
                    marginTop: 12,
                    maxHeight: 220,
                    overflow: "auto",
                    fontSize: 13,
                  }}
                >
                  {log.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* PRAWA KOLUMNA: Lista wrogów */}
            <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <h2>Wrogowie</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ENEMIES.map((e) => (
                  <div key={e.name} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{e.name}</strong>
                      <button onClick={() => selectEnemy(e)}>Wybierz</button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>
                      <div>Obrona celu: <b>{e.defense}</b></div>
                      <div>Pancerz celu: <b>{e.armor}</b></div>
                      <div>Obrona przed magią: <b>{e.mdef}</b></div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedEnemy && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#555" }}>
                  Aktualny wybór: <b>{selectedEnemy.name}</b>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== MAPA ====== */}
      {tab === "map" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 16,
            height: "calc(100vh - 80px)",
          }}
        >
          {/* Obszar mapy */}
          <div
            ref={containerRef}
            onMouseDown={onMouseDownMap}
            onMouseMove={onMouseMoveMap}
            onMouseUp={onMouseUpMap}
            onWheel={onWheelMap}
            onContextMenu={onContextMenu}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              background: "#222",
              borderRadius: 8,
              userSelect: "none",
              cursor: isRightPanning ? "grabbing" : "crosshair",
            }}
          >
            {/* viewport */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                transformOrigin: "0 0",
              }}
            >
              {/* Obraz mapy */}
              {mapImage ? (
                <img
                  src={mapImage}
                  alt="Mapa"
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    background: "#111",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#bbb",
                    fontStyle: "italic",
                  }}
                >
                  Wgraj grafikę mapy po prawej stronie.
                </div>
              )}

              {/* Warstwa rysunku */}
              <canvas
                ref={canvasRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "auto",
                }}
              />
            </div>
          </div>

          {/* Panel narzędzi */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h2>Mapa — narzędzia</h2>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              Wgraj obraz mapy
              <input type="file" accept="image/*" onChange={handleMapFile} />
            </label>

            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>Tryb pędzla</div>
              <label style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name="mode"
                  value="draw"
                  checked={mode === "draw"}
                  onChange={() => setMode("draw")}
                />{" "}
                Rysuj (lewy przycisk)
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="erase"
                  checked={mode === "erase"}
                  onChange={() => setMode("erase")}
                />{" "}
                Gumka (lewy przycisk)
              </label>
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                Przesuwanie mapy: <b>prawy przycisk myszy</b>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Kolor pędzla
              <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Grubość
              <input
                type="range"
                min="1"
                max="30"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
              <span style={{ width: 32, textAlign: "right" }}>{brushSize}px</span>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={clearCanvas}>🧹 Wyczyść rysunek</button>
              <button onClick={resetView}>🔄 Resetuj widok</button>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#666", lineHeight: 1.4 }}>
              <div>🔍 <strong>Zoom</strong>: kręć kółkiem (zoom do kursora).</div>
              <div>🖱️ <strong>Przesuwanie</strong>: przeciągaj <em>prawym</em> przyciskiem myszy.</div>
              <div>✍️ Rysujesz na przezroczystej warstwie nad obrazem — mapa nie jest modyfikowana.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

