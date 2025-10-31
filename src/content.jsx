// src/content.jsx
import "./style.css";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import { summarize, translate, rewrite, proofread, write } from "./aiBuiltins";

/* ------------ Layout + Theme Defaults ------------ */
const defaultPos = { left: null, right: 24, top: null, bottom: 24, width: 560, height: 520 };
const defaultTheme = {
  bg: "", border: "", accent: "", text: "", bubble: 44,
  bgRaw: "", borderRaw: "", accentRaw: "", textRaw: ""
};
const defaultFeatures = { summarize: true, translate: true, proofread: true, rewrite: true, write: false };

/* Preset tokens (match CSS preset classes) */
const THEME_PRESETS = {
  default:  { bg: "rgba(17,24,39,.98)",    border: "#4b5563", accent: "#a3a3a3", text: "#e5e7eb" },
  ocean:    { bg: "rgba(10,20,35,.96)",    border: "#1e3a5f", accent: "#60a5fa", text: "#e6f2ff" },
  forest:   { bg: "rgba(14,24,19,.96)",    border: "#1c3b33", accent: "#34d399", text: "#e8f5f0" },
  midnight: { bg: "rgba(15,15,19,.96)",    border: "#262a40", accent: "#a78bfa", text: "#f3f4f6" },
  sunrise:  { bg: "rgba(255,248,240,.96)", border: "#ffd8b5", accent: "#fb923c", text: "#2b1a10" },
  lavender: { bg: "rgba(248,245,255,.96)", border: "#d9ccff", accent: "#7c3aed", text: "#231b3a" },
};

function useStorage(key, initial) {
  const [val, setVal] = useState(initial);
  useEffect(() => { chrome.storage.local.get({ [key]: initial }, s => setVal(s[key])); }, [key]);
  useEffect(() => {
    const l = (c) => { if (key in c) setVal(c[key].newValue); };
    chrome.storage.local.onChanged.addListener(l);
    return () => chrome.storage.local.onChanged.removeListener(l);
  }, [key]);
  const save = (next) => chrome.storage.local.set({ [key]: next });
  return [val, save];
}

/* Helpers */
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function isColorLike(s){ return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) || /^rgb/i.test(s) || /^hsl/i.test(s); }

/* Swatch (used in Custom mode) */
function ColorSwatch({ label, color, onOpen }) {
  return (
    <div className="fai-color">
      <span className="fai-label">{label}</span>
      <button
        type="button"
        className="fai-color-swatch"
        style={{ background: color || "#4b5563" }}
        onClick={onOpen}
        aria-label={`${label} color`}
        title={`${label} color`}
      />
    </div>
  );
}

/* Centered color modal — live preview + cancel reverts */
function ColorModal({ open, label, value, rawValue, onLive, onConfirm, onClear, onCancel }) {
  const [text, setText] = useState(rawValue || value || "");
  const [pick, setPick] = useState(isColorLike(value) ? value : "#4b5563");
  const boxRef = useRef(null);

  useEffect(() => { setText(rawValue || value || ""); setPick(isColorLike(value) ? value : "#4b5563"); }, [open, value, rawValue]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const handleBackdrop = (e) => {
    if (!boxRef.current) return;
    if (!boxRef.current.contains(e.target)) onCancel();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fai-modal"
          onMouseDown={handleBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            ref={boxRef}
            className="fai-modal-box"
            role="dialog"
            aria-modal="true"
            aria-label={`${label} color editor`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="fai-modal-title">{label}</div>
            <div className="fai-pop-row" style={{ marginTop: 8 }}>
              <input
                type="color"
                className="fai-color-native"
                value={isColorLike(pick) ? pick : "#4b5563"}
                onChange={(e) => {
                  const c = e.target.value;
                  setPick(c);
                  setText(c);
                  onLive(c, c); // live preview
                }}
                aria-label={`${label} color picker`}
              />
              <input
                className="fai-color-text"
                placeholder="#hex or rgb()"
                value={text}
                onChange={(e) => {
                  const t = e.target.value;
                  setText(t);
                  if (isColorLike(t)) { setPick(t); onLive(t, t); }
                }}
                onFocus={(e)=> e.target.select()}
              />
            </div>
            <div className="fai-pop-actions">
              <button className="fai-pop-btn" onClick={() => { onClear(); }}>Clear</button>
              <div style={{ flex: 1 }} />
              <button className="fai-pop-btn" onClick={() => onCancel()}>Cancel</button>
              <button className="fai-pop-btn" onClick={() => onConfirm()} style={{ borderColor: "var(--fai-accent)" }}>
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------ App ------------ */
function App() {
  const [enabled, setEnabled] = useStorage("enabled", true);
  const [pos, setPos] = useStorage("fai_pos", defaultPos);
  const [theme, setTheme] = useStorage("fai_theme", defaultTheme);
  const [features, setFeatures] = useStorage("fai_features", defaultFeatures);
  const [preset, setPreset] = useStorage("fai_theme_preset", "default"); // "default" | "ocean" | "forest" | "midnight" | "sunrise" | "lavender" | "custom"

  const [active, setActive] = useState("summarize");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [paneKey, setPaneKey] = useState(1);

  // Runtime messages
  useEffect(() => {
    const handler = (msg) => {
      if (msg?.type === "__toggle__") setEnabled(msg.enabled);
      if (msg?.type === "__open__") { setEnabled(true); setOpen(true); }
      if (msg?.type === "__open_settings__") { setEnabled(true); setOpen(true); setShowSettings(true); }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [setEnabled]);

  // Build a style object with CSS variables **scoped** to our widget.
  // In Custom, we directly supply all tokens. In presets, we leave them
  // empty so the preset CSS class provides values.
  const varStyle = (() => {
    if (preset === "custom") {
      const bg = theme.bg || THEME_PRESETS.default.bg;
      const border = theme.border || THEME_PRESETS.default.border;
      const accent = theme.accent || THEME_PRESETS.default.accent;
      const text = theme.text || THEME_PRESETS.default.text;
      return {
        "--fai-bg": bg,
        "--fai-surface": bg,             // make controls follow Panel Color
        "--fai-border": border,
        "--fai-accent": accent,
        "--fai-text": text,
        "--fai-bubble-size": `${Number(theme.bubble) || 44}px`,
      };
    }
    // preset path – only bubble size is overridden
    return {
      "--fai-bubble-size": `${Number(theme.bubble) || 44}px`,
    };
  })();

  // Drag (bubble/drawer)
  const dragState = useRef(null);
  const onDragStart = (e) => {
    if (e.target.closest(".fai-actions")) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragState.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      isBubble: target.classList.contains("fai-bubble"),
      startX: e.clientX,
      startY: e.clientY,
    };
    window.addEventListener("pointermove", onDragging);
    window.addEventListener("pointerup", onDragEnd);
  };
  const onDragging = (e) => {
    if (!dragState.current) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const bubbleSize = parseFloat(rootStyle.getPropertyValue("--fai-bubble-size")) || 44;
    const isBubble = dragState.current.isBubble;
    const width = isBubble ? bubbleSize : (pos.width || 560);
    const height = isBubble ? bubbleSize : (pos.height || 520);
    const left = clamp(e.clientX - dragState.current.dx, 8, window.innerWidth - width - 8);
    const top = clamp(e.clientY - dragState.current.dy, 8, window.innerHeight - height - 8);
    setPos({ ...pos, left, right: null, top, bottom: null });
  };
  const onDragEnd = (e) => {
    if (dragState.current) {
      const dx = Math.abs(e.clientX - dragState.current.startX);
      const dy = Math.abs(e.clientY - dragState.current.startY);
      const distance = Math.sqrt(dx*dx + dy*dy);
      if (dragState.current.isBubble && distance < 5) setOpen(true);
    }
    dragState.current = null;
    window.removeEventListener("pointermove", onDragging);
    window.removeEventListener("pointerup", onDragEnd);
  };

  // Resize (drawer)
  const resizeState = useRef(null);
  const onResizeStart = () => {
    resizeState.current = { startWidth: pos.width || 560, startHeight: pos.height || 520 };
    window.addEventListener("pointermove", onResizing);
    window.addEventListener("pointerup", onResizeEnd);
  };
  const onResizing = (e) => {
    if (!resizeState.current) return;
    const dx = e.clientX - (resizeState.current.sx ?? (resizeState.current.sx = e.clientX));
    const dy = e.clientY - (resizeState.current.sy ?? (resizeState.current.sy = e.clientY));
    const width = Math.max(500, (resizeState.current.startWidth + dx));
    const height = Math.max(320, (resizeState.current.startHeight + dy));
    setPos({ ...pos, width, height });
  };
  const onResizeEnd = () => {
    resizeState.current = null;
    window.removeEventListener("pointermove", onResizing);
    window.removeEventListener("pointerup", onResizeEnd);
  };

  const bubble = Number(theme.bubble) || 44;
  const presetClass = (preset && preset !== "custom" && preset !== "default") ? `theme-${preset}` : "";

  // Run AI operations
  const runOp = async (op, text, opts) => {
    if (!text?.trim()) {
      setStatus("⚠️ Please enter some text.");
      setTimeout(() => setStatus(""), 2000);
      return;
    }

    // Show processing status with more context
    const statusMessages = {
      summarize: "⏳ Summarizing... (AI is processing, this may take 10-30 seconds)",
      translate: "⏳ Translating... (Processing with AI)",
      proofread: "⏳ Proofreading... (Checking with AI)",
      rewrite: "⏳ Rewriting... (AI is thinking, please wait)",
      write: "⏳ Writing... (Generating content with AI)"
    };
    
    setStatus(statusMessages[op] || `⏳ Running ${op}...`);
    setResults([]);

    try {
      let result = "";
      
      if (op === "summarize") {
        result = await summarize(text, opts);
      } else if (op === "translate") {
        result = await translate(text, { to: opts.lang || "en" });
      } else if (op === "proofread") {
        const res = await proofread(text);
        result = res?.correctedText || String(res);
      } else if (op === "rewrite") {
        result = await rewrite(text, opts.mode || "paragraph");
      } else if (op === "write") {
        result = await write(text, { tone: opts.tone || "neutral" });
      }

      setResults([{ id: Date.now(), text: result }]);
      setStatus("✅ Done!");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setStatus(`❌ ${err.message || "An error occurred."}`);
      setTimeout(() => setStatus(""), 5000);
    }
  };

  return !enabled ? null : (
    <AnimatePresence>
      {!open ? (
        <motion.div
          className={`fai-bubble ${presetClass}`}
          onPointerDown={onDragStart}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          style={{ left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, ...varStyle }}
          title="Open CreaText"
        >
          <div className="logo">CT</div>
        </motion.div>
      ) : (
        <motion.div
          className={`fai-drawer ${presetClass}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, width: pos.width, height: pos.height, ...varStyle }}
        >
          <div className="fai-sidebar">
            <div className="fai-head" onPointerDown={onDragStart}>
              <div className="fai-title">CreaText</div>
              <div className="fai-actions">
                <button className="fai-iconbtn" aria-label="Settings" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
                <button className="fai-iconbtn" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>
            <div className="fai-nav">
              {Object.entries(features).filter(([, v]) => v).map(([k]) => (
                <button key={k} className={active === k ? "active" : ""} onClick={() => { setActive(k); setShowSettings(false); setPaneKey(p => p + 1); }}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="fai-body">
            {showSettings ? (
              <Settings
                theme={theme}
                setTheme={setTheme}
                preset={preset}
                setPreset={setPreset}
                bubble={bubble}
                features={features}
                setFeatures={setFeatures}
              />
            ) : (
              <Pane key={paneKey} active={active} onRun={(input, opts) => runOp(active, input, opts)} />
            )}
            <div className="fai-results" aria-live="polite">
              {results.map(r => (<div key={r.id} className="fai-result">{r.text}</div>))}
            </div>
            {status && <div className="fai-status">{status}</div>}
            <div className="fai-resize" onPointerDown={onResizeStart} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------ Settings ------------ */
function Settings({ theme, setTheme, preset, setPreset, bubble, features, setFeatures }) {
  const [colorModal, setColorModal] = useState({ open: false, key: "", label: "" });
  const prevThemeRef = useRef(theme);
  const isCustom = preset === "custom";

  const setThemeField = (key, color, raw) => {
    if (!isCustom) return; // only editable in Custom
    const next = { ...theme };
    next[key] = color || "";
    next[`${key}Raw`] = raw ?? next[`${key}Raw`] ?? "";
    setTheme(next);
  };

  const onPresetChange = (name) => {
    if (name === "custom") {
      const base = THEME_PRESETS.default; // seed custom from Default
      setTheme({
        ...theme,
        bg: base.bg, border: base.border, accent: base.accent, text: base.text,
        bgRaw: base.bg, borderRaw: base.border, accentRaw: base.accent, textRaw: base.text,
      });
    } else {
      setTheme({ ...theme, bg:"",border:"",accent:"",text:"",bgRaw:"",borderRaw:"",accentRaw:"",textRaw:"" });
    }
    setPreset(name);
  };

  const openModal = (key, label) => {
    if (!isCustom) return;
    prevThemeRef.current = { ...theme };
    setColorModal({ open: true, key, label });
  };
  const closeModalKeep = () => setColorModal({ open: false, key: "", label: "" });
  const cancelModal = () => { setTheme(prevThemeRef.current); closeModalKeep(); };

  // text tone for custom
  const setTextTone = (tone) => {
    if (!isCustom) return;
    const map = { black: "#111111", white: "#ffffff", ash: "#cbd5e1" };
    const val = map[tone] || "";
    setTheme({ ...theme, text: val, textRaw: val });
  };
  const currentTone = (() => {
    const t = (theme.text || theme.textRaw || "").toLowerCase().replace(/\s+/g, "");
    if (t === "#111111" || t === "rgb(17,17,17)") return "black";
    if (t === "#ffffff" || t === "rgb(255,255,255)") return "white";
    if (t === "#cbd5e1") return "ash";
    return "ash";
  })();

  // pretty slider progress fill
  const rangePercent = Math.round(((bubble - 32) / (56 - 32)) * 100);
  const onBubbleChange = (e) => {
    const v = Number(e.target.value);
    e.target.style.setProperty("--val", `${Math.round(((v - 32) / 24) * 100)}%`);
    setTheme({ ...theme, bubble: v });
  };

  return (
    <div className="fai-settings" style={{ borderBottom: "1px solid var(--fai-border)", position: "relative" }}>
      {/* Theme preset row */}
      <div className="options" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <label>Theme
          <select
            value={preset}
            onChange={e => onPresetChange(e.target.value)}
            style={{ marginLeft: 8 }}
            aria-label="Choose theme"
            className="fai-select"
          >
            <option value="default">Default</option>
            <option value="ocean">Ocean</option>
            <option value="forest">Forest</option>
            <option value="midnight">Midnight</option>
            <option value="sunrise">Sunrise</option>
            <option value="lavender">Lavender</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => { onPresetChange("default"); }}
          className="fai-reset-btn"
          aria-label="Use Default Theme"
          title="Use Default Theme"
        >
          Use Default
        </button>
      </div>

      <hr style={{ borderColor: "var(--fai-border)", opacity: .7, margin: "0 0 12px 0" }} />

      {/* Bubble size: always visible */}
      <div className="fai-grid slim" style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          Bubble Size
          <input
            className="fai-range"
            type="range"
            min="32"
            max="56"
            value={bubble}
            onChange={onBubbleChange}
            style={{ width: 220, ["--val"]: `${rangePercent}%` }}
          />
          <span style={{ opacity: .8 }}>{bubble}px</span>
        </label>
      </div>

      {/* Custom-only colors */}
      {isCustom ? (
        <>
          <div className="fai-grid">
            <ColorSwatch label="Panel Color"  color={theme.bg     || theme.bgRaw}     onOpen={() => openModal("bg", "Panel Color")} />
            <ColorSwatch label="Border Color" color={theme.border || theme.borderRaw} onOpen={() => openModal("border", "Border Color")} />
            <ColorSwatch label="Accent Color" color={theme.accent || theme.accentRaw} onOpen={() => openModal("accent", "Accent Color")} />
          </div>

          <div className="fai-grid slim">
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              Text Color
              <select
                value={currentTone}
                onChange={e => setTextTone(e.target.value)}
                className="fai-select"
                aria-label="Text color"
              >
                <option value="black">Black</option>
                <option value="white">White</option>
                <option value="ash">Ash</option>
              </select>
            </label>
          </div>

          <ColorModal
            open={colorModal.open}
            label={colorModal.label}
            value={theme[colorModal.key] || ""}
            rawValue={theme[`${colorModal.key}Raw`] || ""}
            onLive={(c, raw) => setThemeField(colorModal.key, c, raw)}
            onConfirm={closeModalKeep}
            onClear={() => { setThemeField(colorModal.key, "", ""); closeModalKeep(); }}
            onCancel={cancelModal}
          />
        </>
      ) : (
        <div className="hint">Switch to <b>Custom</b> to edit colors and text tone.</div>
      )}

      <div className="options" style={{ flexWrap: "wrap", marginTop: 6 }}>
        {Object.keys(features).map(key => (
          <label key={key} style={{ marginRight: 12 }}>
            <input
              type="checkbox"
              checked={!!features[key]}
              onChange={e => setFeatures({ ...features, [key]: e.target.checked })}
            /> {key[0].toUpperCase() + key.slice(1)}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ------------ Pane ------------ */
function Pane({ active, onRun }) {
  const taRef = useRef(null);
  const [opts, setOpts] = useState({ words: 120, length: "medium", lang: "en", tone: "neutral", mode: "paragraph" });

  const OptsUI = {
    summarize: (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label>Words <input type="number" min="30" max="800" value={opts.words} onChange={e=>setOpts({ ...opts, words:Number(e.target.value) })} /></label>
        <span style={{ opacity:.7 }}>or</span>
        <label>Length
          <select value={opts.length} onChange={e=>setOpts({ ...opts, length: e.target.value })}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
      </div>
    ),
    translate: (<label>To <input type="text" value={opts.lang} onChange={e=>setOpts({ ...opts, lang: e.target.value })}/></label>),
    proofread: (<span style={{opacity:.8}}>Proofread has no options</span>),
    rewrite: (
      <label>Mode
        <select value={opts.mode} onChange={e=>setOpts({ ...opts, mode: e.target.value })}>
          <option value="key-points">Key points</option>
          <option value="paragraph">New paragraph</option>
          <option value="table">Table</option>
          <option value="tone:formal">Tone: Formal</option>
          <option value="tone:neutral">Tone: Neutral</option>
          <option value="tone:casual">Tone: Casual</option>
        </select>
      </label>
    ),
    write: (
      <label>Tone
        <select value={opts.tone} onChange={e=>setOpts({ ...opts, tone: e.target.value })}>
          <option value="formal">Formal</option>
          <option value="neutral">Neutral</option>
          <option value="casual">Casual</option>
        </select>
      </label>
    )
  }[active];

  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    await onRun(taRef.current.value, opts);
    setBusy(false);
  };

  return (
    <div className="fai-pane">
      <textarea className="fai-input"
        ref={taRef}
        placeholder={active === "write" ? "Describe what to write..." : "Write or paste text here…"}
        disabled={busy} />
      <div className="fai-controls">
        <div className="options">{OptsUI}</div>
        <button className="runbtn" onClick={run} disabled={busy} aria-label={`Run ${active}`}>
          {busy ? "⏳ Processing..." : "Run"}
        </button>
      </div>
    </div>
  );
}

/* ------------ Mount once ------------ */
(() => {
  const id = "fai-root-mount";
  if (document.getElementById(id)) return;
  const mount = document.createElement("div");
  mount.id = id;
  document.documentElement.appendChild(mount);
  createRoot(mount).render(<App />);
})();
