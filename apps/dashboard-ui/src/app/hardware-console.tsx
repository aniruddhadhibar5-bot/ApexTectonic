"use client";

import { useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ja-JP";
type Phase = "operating" | "scan" | "release" | "lifting" | "exploded" | "connections" | "reassembly" | "verified";
type PartId = "board" | "processor" | "cooling" | "memory" | "power" | "radio" | "enclosure";

const phaseSequence: { id: Phase; duration: number }[] = [
  { id: "operating", duration: 4600 },
  { id: "scan", duration: 3200 },
  { id: "release", duration: 1800 },
  { id: "lifting", duration: 3000 },
  { id: "exploded", duration: 4700 },
  { id: "connections", duration: 3800 },
  { id: "reassembly", duration: 5200 },
  { id: "verified", duration: 2200 },
];

const partLabels: Record<Locale, Record<PartId, { name: string; role: string }>> = {
  "en-US": {
    board: { name: "Multilayer mainboard", role: "Illustrative four-layer board with power, memory, and signal traces." },
    processor: { name: "Compute module", role: "Illustrative signal-processing module on a shielded socket." },
    cooling: { name: "Cooling assembly", role: "Finned heat spreader and twin fan concept." },
    memory: { name: "Memory bank", role: "Paired memory modules connected to the simulated data bus." },
    power: { name: "Power stage", role: "Input conditioning and power regulation concept." },
    radio: { name: "Radio interface", role: "Antenna and communications module concept." },
    enclosure: { name: "Protective enclosure", role: "Transparent outer shell, fasteners, and mounting frame." },
  },
  "ja-JP": {
    board: { name: "多層メインボード", role: "電源、メモリ、信号配線を備えた4層基板の概念。" },
    processor: { name: "演算モジュール", role: "シールド付きソケット上の信号処理モジュール概念。" },
    cooling: { name: "冷却アセンブリ", role: "フィン付きヒートスプレッダーと2基のファン概念。" },
    memory: { name: "メモリバンク", role: "シミュレーション用データバスに接続するメモリ。" },
    power: { name: "電源ステージ", role: "入力調整・電源制御回路の概念。" },
    radio: { name: "無線インターフェース", role: "アンテナ・通信モジュールの概念。" },
    enclosure: { name: "保護エンクロージャ", role: "透明外装、固定具、マウントフレーム。" },
  },
};

const translations = {
  "en-US": {
    title: "ROBOTIC EDGE COMPUTE / CONCEPT",
    disclaimer: "SIMULATED TELEMETRY · NO PHYSICAL HARDWARE CONNECTED",
    phase: "CYCLE PHASE",
    selected: "SELECTED COMPONENT",
    progress: "ASSEMBLY STATE",
    play: "Play cycle",
    pause: "Pause cycle",
    replay: "Replay",
    staticMotion: "STATIC VIEW · REDUCED MOTION",
    assembled: "Assembled",
    exploded: "Exploded",
    speed: "Speed",
    selectPart: "SELECT A COMPONENT",
    processor: "CPU ACTIVITY",
    memory: "MEMORY",
    temperature: "TEMPERATURE",
    power: "POWER",
    network: "NETWORK",
    phases: {
      operating: "OPERATING · DIAGNOSTICS",
      scan: "NON-CONTACT COMPONENT SCAN",
      release: "RELEASING ENCLOSURE & FASTENERS",
      lifting: "CONTROLLED LAYER SEPARATION",
      exploded: "EXPLODED VIEW · INSPECT",
      connections: "POWER & DATA PATHS",
      reassembly: "ALIGNING & REASSEMBLING",
      verified: "ASSEMBLY CHECK · COMPLETE",
    } satisfies Record<Phase, string>,
    parts: ["MAINBOARD", "COMPUTE", "COOLING", "MEMORY", "POWER", "RADIO", "ENCLOSURE"],
  },
  "ja-JP": {
    title: "ロボティック・エッジ演算 / 概念",
    disclaimer: "テレメトリーはシミュレーションです · 実機未接続",
    phase: "サイクル状態",
    selected: "選択中の部品",
    progress: "組立状態",
    play: "サイクル再生",
    pause: "一時停止",
    replay: "再実行",
    staticMotion: "静止表示 · モーション軽減設定",
    assembled: "組立状態",
    exploded: "分解図",
    speed: "速度",
    selectPart: "部品を選択",
    processor: "CPU動作",
    memory: "メモリ",
    temperature: "温度",
    power: "電力",
    network: "ネットワーク",
    phases: {
      operating: "稼働 · 診断",
      scan: "非接触部品スキャン",
      release: "外装・固定具を解除",
      lifting: "各層を制御して分離",
      exploded: "分解図 · 点検",
      connections: "電源・データ経路",
      reassembly: "位置合わせ・再組立",
      verified: "組立確認 · 完了",
    } satisfies Record<Phase, string>,
    parts: ["基板", "演算", "冷却", "メモリ", "電源", "無線", "外装"],
  },
} as const;

const partIds: PartId[] = ["board", "processor", "cooling", "memory", "power", "radio", "enclosure"];

function isSeparated(phase: Phase) {
  return phase === "lifting" || phase === "exploded" || phase === "connections";
}

function HardwareSvg({
  phase,
  selected,
  forcedExploded,
  selectPart,
  componentLabel,
}: {
  phase: Phase;
  selected: PartId;
  forcedExploded: boolean | null;
  selectPart: (part: PartId) => void;
  componentLabel: string;
}) {
  const exploded = forcedExploded ?? isSeparated(phase);
  const reassembling = phase === "reassembly";
  const scanning = phase === "scan";
  const offsets: Record<PartId, [number, number]> = {
    board: [0, 0],
    enclosure: [0, -48],
    cooling: [0, -83],
    processor: [0, -45],
    memory: [0, -58],
    power: [-48, 16],
    radio: [38, 15],
  };
  const offsetFor = (part: PartId): [number, number] => {
    if (forcedExploded === false) return [0, 0];
    if (forcedExploded === true) return offsets[part];
    if (phase === "release") return part === "enclosure" ? [0, -15] : [0, 0];
    if (reassembling) return [0, 0];
    return exploded ? offsets[part] : [0, 0];
  };
  const calloutAnchor: Record<PartId, [number, number]> = {
    board: [388, 324],
    processor: [382, 186],
    cooling: [380, 128],
    memory: [526, 190],
    power: [222, 194],
    radio: [560, 198],
    enclosure: [360, 85],
  };
  const [baseAnchorX, baseAnchorY] = calloutAnchor[selected];
  const [anchorOffsetX, anchorOffsetY] = offsetFor(selected);
  const anchorX = baseAnchorX + anchorOffsetX;
  const anchorY = baseAnchorY + anchorOffsetY;
  const transformFor = (part: PartId) => {
    const [x, y] = offsetFor(part);
    return `translate(${x}px, ${y}px)`;
  };

  const groupStyle = (part: PartId) => ({
    transform: transformFor(part),
    transitionDelay: reassembling && forcedExploded !== true
      ? `${(["board", "radio", "power", "processor", "memory", "cooling", "enclosure"] as PartId[]).indexOf(part) * 170}ms`
      : phase === "lifting"
        ? `${(["enclosure", "cooling", "memory", "processor", "power", "radio", "board"] as PartId[]).indexOf(part) * 110}ms`
        : part === "enclosure" && phase === "release" ? "0ms" : "90ms",
  });

  return (
    <svg className={`hardware-blueprint${scanning ? " is-scanning" : ""}${phase === "connections" ? " show-connections" : ""}`} viewBox="0 0 760 400" role="img" aria-label="Animated isometric robotic edge-computing module concept">
      <defs>
        <linearGradient id="boardTop" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#173c50" /><stop offset="1" stopColor="#0b1c2a" />
        </linearGradient>
        <linearGradient id="metalTop" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#8daeb5" /><stop offset=".45" stopColor="#466575" /><stop offset="1" stopColor="#1c3444" />
        </linearGradient>
        <linearGradient id="lidGradient" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#6be1d2" stopOpacity=".12" /><stop offset="1" stopColor="#5598b8" stopOpacity=".035" />
        </linearGradient>
        <radialGradient id="processorGlow">
          <stop stopColor="#63f2d3" stopOpacity=".28" /><stop offset="1" stopColor="#63f2d3" stopOpacity="0" />
        </radialGradient>
        <pattern id="boardGrid" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" fill="none" stroke="#53a7a9" strokeOpacity=".06" />
        </pattern>
      </defs>
      <g className="hardware-grid">
        <path d="M30 340H730M90 365H670M145 380H615" />
        <path d="M380 24V372M160 75L600 327M600 75L160 327" />
      </g>
      <ellipse cx="382" cy="320" rx="270" ry="55" fill="#02070c" opacity=".58" />

      <g className={`hardware-part hardware-board selectable ${selected === "board" ? "is-selected" : ""}`} onClick={() => selectPart("board")}>
        <path d="M104 220 362 92 655 218 388 352Z" fill="#0b1722" stroke="#4b8a92" strokeWidth="2" />
        <path d="M117 217 362 101 640 219 388 340Z" fill="url(#boardTop)" stroke="#6bc8be" strokeOpacity=".58" />
        <path d="m140 220 246 105 232-109" fill="none" stroke="#254b5b" strokeWidth="9" />
        <path d="m117 217 271 123V352L104 229Z" fill="#09131e" stroke="#345967" />
        <path d="m388 340 267-131v12L388 352Z" fill="#101c27" stroke="#345967" />
        <path d="M117 217 362 101 640 219 388 340Z" fill="url(#boardGrid)" opacity=".8" />
        <g className="circuit-traces">
          <path d="m245 211 71 33 0-48 38-20m-10 91 45-22v-40l54-26m-48 99 68-32v-26l47-23m-235-8 43-21v-30m142 146 55-26v-31" />
          <path d="m190 224 39 17v-39m272-1 48 21v33m-216 78 0-37 34-17" />
        </g>
        <g className="data-pulses"><path d="m245 211 71 33v-48l38-20" /><path d="m405 270 45-22v-40l54-26" /></g>
        {Array.from({ length: 10 }, (_, index) => {
          const x = 138 + index * 55;
          return <g key={x} className="board-fastener"><circle cx={x} cy={229 + Math.sin(index * 0.6) * 16} r="5" /><path d={`M${x - 2} ${226 + Math.sin(index * 0.6) * 16}l4 6`} /></g>;
        })}
        <path d="m126 214-17-8v28l17 8m514-22 20-10v29l-20 10" fill="#192d3b" stroke="#80cfc4" />
        <text x="284" y="310" className="svg-part-label">4-LAYER MAINBOARD / CONCEPT</text>
      </g>

      <g className={`hardware-part selectable ${selected === "power" ? "is-selected" : ""}`} style={groupStyle("power")} onClick={() => selectPart("power")}>
        <path className="component-base" d="m157 200 65-32 73 32-66 34Z" />
        <path d="m177 195 44-22 48 21-45 24Z" fill="#284658" stroke="#70bdb2" />
        <path d="m183 193 38-19v15l-38 19Zm39-4 42-11v16l-42 15Z" fill="#b07c52" stroke="#e4b585" />
        <path d="m188 188 28-14m13 13 27-9" stroke="#ffe0a9" strokeWidth="2" />
        <text x="167" y="254" className="svg-micro-label">POWER / PWR</text>
      </g>

      <g className={`hardware-part selectable ${selected === "radio" ? "is-selected" : ""}`} style={groupStyle("radio")} onClick={() => selectPart("radio")}>
        <path className="component-base" d="m500 218 57-29 66 29-59 31Z" />
        <path d="m518 214 39-20 44 20-40 21Z" fill="#203d4e" stroke="#79cfc4" />
        <rect x="534" y="201" width="32" height="13" rx="3" transform="rotate(25 534 201)" fill="#577c88" stroke="#a8eee1" />
        <path d="m552 194 12-36m0 0-8 8m8-8 3 10" fill="none" stroke="#86d8d1" strokeWidth="2" />
        <path d="m583 215 31 12" stroke="#ffc783" strokeWidth="2" />
        <text x="525" y="259" className="svg-micro-label">RF / LINK</text>
      </g>

      <g className={`hardware-part selectable ${selected === "memory" ? "is-selected" : ""}`} style={groupStyle("memory")} onClick={() => selectPart("memory")}>
        <path className="component-base" d="m438 165 27-14 112 47-29 15Z" />
        {[0, 1].map((index) => <g key={index} transform={`translate(${index * 46} ${index * 19})`}>
          <path d="m451 153 18-9 49 21-18 10Z" fill="#182e3e" stroke="#64bcae" />
          <path d="m456 153 9-5 38 16-9 5Z" fill="#225361" stroke="#93e0ce" strokeOpacity=".6" />
          {[0, 1, 2, 3].map((chip) => <rect key={chip} x={461 + chip * 8} y={153 + chip * 3.2} width="5" height="4" rx=".7" fill="#91aa9c" transform={`rotate(23 ${461 + chip * 8} ${153 + chip * 3.2})`} />)}
        </g>)}
        <text x="469" y="225" className="svg-micro-label">DDR / MEMORY</text>
      </g>

      <g className={`hardware-part selectable processor-part ${selected === "processor" ? "is-selected" : ""}`} style={groupStyle("processor")} onClick={() => selectPart("processor")}>
        <ellipse cx="379" cy="203" rx="75" ry="40" fill="url(#processorGlow)" />
        <path d="m320 195 62-31 70 30-64 33Z" fill="#0b1720" stroke="#7ea8aa" strokeWidth="2" />
        <path d="m331 194 52-26 57 25-53 28Z" fill="#172a37" stroke="#86b9ae" />
        {Array.from({ length: 8 }, (_, index) => <path key={index} d={`M${340 + index * 6} ${188 + index * 2.8}v-8m${-2} 7h4`} stroke="#e8bd7d" strokeWidth="1.2" />)}
        <path d="m346 190 37-19 41 18-39 20Z" fill="#090f17" stroke="#83e7d2" strokeWidth="2" />
        <path d="m354 188 29-14 32 14-30 15Z" fill="url(#metalTop)" stroke="#c3f6e8" />
        <path d="m360 186 23-11 24 11-23 12Z" fill="#142634" stroke="#80e4d1" />
        <text x="368" y="188" className="chip-mark">H</text>
        <text x="354" y="242" className="svg-micro-label">EDGE SoC / SOCKET</text>
      </g>

      <g className={`hardware-part selectable ${selected === "cooling" ? "is-selected" : ""}`} style={groupStyle("cooling")} onClick={() => selectPart("cooling")}>
        <path d="m318 139 60-30 82 35-62 32Z" fill="#0b1822" stroke="#6bbeb7" strokeWidth="2" />
        <path d="m327 137 51-25 66 28-53 27Z" fill="url(#metalTop)" stroke="#b6d6d3" strokeWidth="1.4" />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => <path key={index} d={`M${338 + index * 7} ${135 + index * 3.1}l15-22`} stroke="#c1d9d4" strokeOpacity=".76" strokeWidth="2" />)}
        <path d="m349 136 29-15 33 14-30 16Z" fill="#263e4b" stroke="#bad5cd" />
        <circle cx="380" cy="136" r="13" fill="#132531" stroke="#8fdacc" />
        <g className="fan-rotor"><path d="M380 124v24m-12-12h24m-20-8 16 16m0-16-16 16" stroke="#8ecfcb" strokeWidth="1" /></g>
        <text x="351" y="170" className="svg-micro-label">THERMAL / ACTIVE</text>
      </g>

      <g className={`hardware-part selectable enclosure-part ${selected === "enclosure" ? "is-selected" : ""}`} style={groupStyle("enclosure")} onClick={() => selectPart("enclosure")}>
        <path d="m105 210 255-127 291 125-264 132Z" fill="url(#lidGradient)" stroke="#72c9d0" strokeOpacity=".65" strokeWidth="2" />
        <path d="m105 210v-18l255-127 291 125v18" fill="none" stroke="#89d9de" strokeOpacity=".4" strokeWidth="2" />
        <path d="m105 210 282 122v16L105 226Zm282 122 264-132v17L387 348Z" fill="#4a9ba0" fillOpacity=".08" stroke="#6bbabf" strokeOpacity=".4" />
        <path d="m120 204 239-118 275 118" fill="none" stroke="#a5f4e3" strokeOpacity=".34" strokeDasharray="3 7" />
        {[{ x: 114, y: 207 }, { x: 359, y: 85 }, { x: 651, y: 207 }, { x: 387, y: 336 }].map((point) => <g key={point.x} className="housing-screw"><circle cx={point.x} cy={point.y} r="6" /><path d={`M${point.x - 3} ${point.y}h6`} /></g>)}
      </g>

      <g className="hardware-cables" fill="none">
        <path d="M252 205c-38 22-34 60 11 67s87-2 110-24" stroke="#d1955c" strokeWidth="3" />
        <path d="M519 219c34 7 39 31 21 45s-57 9-85-7" stroke="#65c7bb" strokeWidth="3" />
        <path d="M279 212c-17 17-11 37 10 43m227-24c15 8 18 18 9 25" stroke="#6f9ca4" strokeWidth="1" />
      </g>

      <g className={`hardware-scanner${scanning ? " active" : ""}`}>
        <path d="M80 80H680" />
        <path d="M80 80h600v170H80Z" />
      </g>
      <g className={`hardware-callout callout-${selected}`} aria-hidden="true">
        <path d={`M${anchorX} ${anchorY}L490 82H650l20 2`} />
        <circle cx={anchorX} cy={anchorY} r="2.5" />
        <circle cx="670" cy="84" r="2.5" />
      </g>
      <text x="510" y="59" className="svg-status-label">{phase === "connections" ? "BUS / POWER PATH ACTIVE" : componentLabel.toUpperCase()}</text>
      <text x="34" y="378" className="svg-micro-label">ISOMETRIC ASSEMBLY VIEW · SYNTHETIC DESIGN</text>
    </svg>
  );
}

export default function HardwareConsole({ locale }: { locale: Locale }) {
  const consoleRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("operating");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [forcedExploded, setForcedExploded] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<PartId>("processor");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const elapsedRef = useRef(0);
  const phaseIndexRef = useRef(0);
  const labels = partLabels[locale];
  const t = translations[locale];

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setReducedMotion(motionPreference.matches);
      if (motionPreference.matches) {
        setPlaying(false);
        elapsedRef.current = 0;
        phaseIndexRef.current = 0;
        setPhase("operating");
      }
    };
    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const panel = consoleRef.current;
    if (!panel) return;
    const updateVisibility = () => panel.classList.toggle("is-document-hidden", document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    if (!("IntersectionObserver" in window)) {
      panel.classList.add("is-visible");
      return () => document.removeEventListener("visibilitychange", updateVisibility);
    }
    const observer = new IntersectionObserver(([entry]) => {
      panel.classList.toggle("is-visible", entry.isIntersecting);
    });
    observer.observe(panel);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const panel = consoleRef.current;
    if (!panel) return;
    let frame = 0;
    let lastTime = 0;
    let visible = false;
    let lastPhase = phaseIndexRef.current;
    const total = phaseSequence.reduce((sum, item) => sum + item.duration, 0);

    const tick = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (lastTime) elapsedRef.current += (time - lastTime) * speed;
      lastTime = time;
      const cyclePosition = elapsedRef.current % total;
      let sum = 0;
      const index = phaseSequence.findIndex((item) => {
        sum += item.duration;
        return cyclePosition < sum;
      });
      if (index >= 0 && index !== lastPhase) {
        lastPhase = index;
        phaseIndexRef.current = index;
        const nextPhase = phaseSequence[index].id;
        setPhase(nextPhase);
        if (nextPhase === "scan") {
          setSelected((current) => partIds[(partIds.indexOf(current) + 1) % partIds.length]);
        }
      }
      frame = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      lastTime = 0;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
        else if (frame) window.cancelAnimationFrame(frame);
      })
      : null;
    if (observer) observer.observe(panel);
    else {
      visible = true;
      schedule();
    }
    const visibilityHandler = () => {
      if (document.hidden && frame) window.cancelAnimationFrame(frame);
      else schedule();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [playing, speed, replayKey]);

  const replay = () => {
    elapsedRef.current = 0;
    phaseIndexRef.current = 0;
    setPhase("operating");
    setForcedExploded(null);
    setPlaying(true);
    setReplayKey((key) => key + 1);
  };
  const phaseProgress = phase === "operating" || phase === "verified" ? 100 : phase === "scan" ? 88 : phase === "release" ? 75 : phase === "lifting" ? 58 : phase === "exploded" || phase === "connections" ? 42 : 72;
  const progress = forcedExploded === null ? phaseProgress : forcedExploded ? 42 : 100;
  const viewExploded = forcedExploded ?? isSeparated(phase);
  const simulatedCpu = phase === "operating" || phase === "connections" ? 47 : phase === "scan" ? 31 : 12;

  return (
    <section ref={consoleRef} className={`hardware-console is-visible${playing && !reducedMotion ? "" : " is-paused"}`} aria-label={t.title}>
      <div className="hardware-console-heading">
        <div><p className="hardware-console-kicker">{t.title}</p><p className="hardware-console-disclaimer"><i />{t.disclaimer}</p></div>
        <span className="hardware-mode-badge">DESIGN / R&amp;D</span>
      </div>
      <div className="hardware-vitals" aria-live="polite">
        <div><span>{t.phase}</span><strong>{t.phases[phase]}</strong></div>
        <div><span>{t.selected}</span><strong>{labels[selected].name}</strong></div>
        <div><span>{t.progress}</span><strong>{`${progress}% · SIM`}</strong></div>
      </div>
      <div className="hardware-progress" role="progressbar" aria-label={t.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
      <div className="hardware-stage">
        <HardwareSvg phase={phase} selected={selected} forcedExploded={forcedExploded} selectPart={setSelected} componentLabel={labels[selected].name} />
        <div className="hardware-scan-label" aria-hidden="true">{phase === "scan" ? `SCAN / ${labels[selected].name}` : phase === "connections" ? "SIGNAL PATH / ACTIVE" : "FIELD SERVICE MODEL"}</div>
      </div>
      {reducedMotion && <p className="hardware-static-note">{t.staticMotion}</p>}
      <div className="hardware-selected-info">
        <span className="selected-index">PART / {String(partIds.indexOf(selected) + 1).padStart(2, "0")}</span>
        <div><strong>{labels[selected].name}</strong><p>{labels[selected].role}</p></div>
      </div>
      <div className="hardware-controls" aria-label="Hardware animation controls">
        <button type="button" className="hardware-control-primary" onClick={() => setPlaying((current) => !current)} aria-label={playing ? t.pause : t.play} disabled={reducedMotion}>{playing ? "Ⅱ" : "▶"} <span>{playing ? t.pause : t.play}</span></button>
        <button type="button" onClick={replay} aria-label={t.replay} disabled={reducedMotion}>↻ <span>{t.replay}</span></button>
        <div className="hardware-view-toggle" role="group" aria-label="Assembly view">
          <button type="button" aria-pressed={!viewExploded} onClick={() => setForcedExploded(false)}>{t.assembled}</button>
          <button type="button" aria-pressed={viewExploded} onClick={() => setForcedExploded(true)}>{t.exploded}</button>
        </div>
        <label className="hardware-speed">{t.speed}
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label={t.speed}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option>
          </select>
        </label>
      </div>
      <div className="hardware-part-picker" role="group" aria-label={t.selectPart}>
        {partIds.map((part, index) => (
          <button type="button" key={part} className={selected === part ? "is-selected" : ""} aria-pressed={selected === part} onClick={() => setSelected(part)}>
            <span>0{index + 1}</span>{t.parts[index]}
          </button>
        ))}
      </div>
      <div className="hardware-metrics" aria-label={t.disclaimer}>
        <div><span>{t.processor}</span><strong>{simulatedCpu}% <i>SIM</i></strong><meter min="0" max="100" value={simulatedCpu} /></div>
        <div><span>{t.memory}</span><strong>4.8 / 16 GB <i>SIM</i></strong><meter min="0" max="16" value="4.8" /></div>
        <div><span>{t.temperature}</span><strong>42 °C <i>SIM</i></strong></div>
        <div><span>{t.power}</span><strong>12.4 W <i>SIM</i></strong></div>
        <div><span>{t.network}</span><strong>18.2 MB/s <i>SIM</i></strong></div>
      </div>
    </section>
  );
}
