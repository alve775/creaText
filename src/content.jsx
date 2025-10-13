// import "./style.css";
// import React, { useEffect, useRef, useState } from "react";
// import { createRoot } from "react-dom/client";
// import { AnimatePresence, motion } from "framer-motion";
// import { summarize, translate, rewrite, proofread, write } from "./aiBuiltins";

// const defaultPos = { left: null, right: 24, top: null, bottom: 24, width: 560, height: 520 };
// const defaultTheme = { bg: "", border: "", accent: "", bubble: 44, bgRaw: "", borderRaw: "", accentRaw: "" };
// const defaultFeatures = { summarize: true, translate: true, proofread: true, rewrite: true, write: false };

// function useStorage(key, initial) {
//   const [val, setVal] = useState(initial);
//   useEffect(() => { chrome.storage.local.get({ [key]: initial }, s => setVal(s[key])); }, [key]);
//   useEffect(() => {
//     const l = (c) => { if (key in c) setVal(c[key].newValue); };
//     chrome.storage.local.onChanged.addListener(l);
//     return () => chrome.storage.local.onChanged.removeListener(l);
//   }, [key]);
//   const save = (next) => chrome.storage.local.set({ [key]: next });
//   return [val, save];
// }

// function App() {
//   const [enabled, setEnabled] = useStorage("enabled", true);
//   const [pos, setPos] = useStorage("fai_pos", defaultPos);
//   const [theme, setTheme] = useStorage("fai_theme", defaultTheme);
//   const [features, setFeatures] = useStorage("fai_features", defaultFeatures);
//   const [active, setActive] = useState("summarize");
//   const [open, setOpen] = useState(false);
//   const [status, setStatus] = useState("");
//   const [results, setResults] = useState([]);
//   const [showSettings, setShowSettings] = useState(false);
//   const [paneKey, setPaneKey] = useState(1);

//   useEffect(() => {
//     const handler = (msg) => {
//       if (msg?.type === "__toggle__") setEnabled(msg.enabled);
//       if (msg?.type === "__open__") { setEnabled(true); setOpen(true); }
//       if (msg?.type === "__open_settings__") { setEnabled(true); setOpen(true); setShowSettings(true); }
//     };
//     chrome.runtime.onMessage.addListener(handler);
//     return () => chrome.runtime.onMessage.removeListener(handler);
//   }, [setEnabled]);

//   useEffect(() => {
//     const el = document.documentElement;
//     const set = (name, val) => { if (val) el.style.setProperty(name, val); };
//     set("--fai-bg", theme.bg || "rgba(17,24,39,.98)");
//     set("--fai-border", theme.border || "#4b5563");
//     set("--fai-accent", theme.accent || "#a3a3a3");
//     el.style.setProperty("--fai-bubble-size", `${Number(theme.bubble) || 44}px`);
//   }, [theme]);

//   async function runOp(op, input, opts) {
//     if (!input?.trim()) { alert("Paste some text first."); return; }
//     setStatus("Working…");
//     try {
//       let out = "";
//       if (op === "summarize") {
//         const payload = {};
//         if (opts.words && Number(opts.words) > 0) payload.words = Number(opts.words);
//         else payload.length = (opts.length || "medium");
//         out = await summarize(input, payload);
//       } else if (op === "translate") {
//         out = await translate(input, { from: "auto", to: opts.lang || "en" });
//       } else if (op === "proofread") {
//         const r = await proofread(input);
//         out = r.correctedText ?? JSON.stringify(r, null, 2);
//       } else if (op === "rewrite") {
//         const mode = opts.mode || "paragraph";
//         out = await rewrite(input, mode);
//       } else if (op === "write") {
//         out = await write(input, { tone: opts.tone || "neutral" });
//       }
//       setResults(r => [{ id: Date.now() + Math.random(), text: String(out || "").trim() }, ...r]);
//     } catch (e) {
//       setResults(r => [{ id: Date.now() + Math.random(), text: `Error: ${e?.message || e}` }, ...r]);
//     } finally {
//       setStatus("");
//     }
//   }

//   // drag
//   const dragState = useRef(null);
//   const onDragStart = (e) => {
//     if (e.target.closest(".fai-actions")) return;
//     const rect = e.currentTarget.parentElement.getBoundingClientRect();
//     dragState.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
//     window.addEventListener("pointermove", onDragging);
//     window.addEventListener("pointerup", onDragEnd);
//   };
//   const onDragging = (e) => {
//     if (!dragState.current) return;
//     const width = pos.width || 560;
//     const height = pos.height || 520;
//     const left = Math.max(8, Math.min(window.innerWidth - width - 8, e.clientX - dragState.current.dx));
//     const top = Math.max(8, Math.min(window.innerHeight - height - 8, e.clientY - dragState.current.dy));
//     setPos({ ...pos, left, right: null, top, bottom: null });
//   };
//   const onDragEnd = () => {
//     dragState.current = null;
//     window.removeEventListener("pointermove", onDragging);
//     window.removeEventListener("pointerup", onDragEnd);
//   };

//   // resize
//   const resizeRef = useRef(null);
//   const startResize = (e) => {
//     e.preventDefault();
//     resizeRef.current = { x: e.clientX, y: e.clientY, w: pos.width || 560, h: pos.height || 520 };
//     window.addEventListener("pointermove", onResizing);
//     window.addEventListener("pointerup", endResize);
//   };
//   const onResizing = (e) => {
//     const { x, y, w, h } = resizeRef.current;
//     const width = Math.max(500, w + (e.clientX - x));
//     const height = Math.max(360, h + (e.clientY - y));
//     setPos({ ...pos, width, height });
//   };
//   const endResize = () => {
//     resizeRef.current = null;
//     window.removeEventListener("pointermove", onResizing);
//     window.removeEventListener("pointerup", endResize);
//   };

//   const styleDrawer = {
//     left: pos.left ?? "auto",
//     right: pos.right ?? "auto",
//     top: pos.top ?? "auto",
//     bottom: pos.top == null ? (pos.bottom ?? 24) : "auto",
//     width: pos.width ?? 560,
//     height: pos.height ?? 520
//   };

//   return (
//     <>
//       {/* Bubble */}
//       <AnimatePresence>
//         {enabled && !open && (
//           <motion.div
//             className="fai-bubble"
//             initial={{ opacity: 0, scale: 0.6, y: 16 }}
//             animate={{ opacity: 1, scale: 1, y: 0 }}
//             exit={{ opacity: 0, scale: 0.6, y: 16 }}
//             transition={{ type: "spring", stiffness: 260, damping: 20 }}
//             onClick={() => setOpen(true)}
//             title="Open CreaText"
//           >
//             <div className="logo">CT</div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* Drawer */}
//       <AnimatePresence>
//         {enabled && open && (
//           <motion.div
//             className="fai-drawer"
//             style={styleDrawer}
//             initial={{ opacity: 0, scale: 0.96, y: 14 }}
//             animate={{ opacity: 1, scale: 1, y: 0 }}
//             exit={{ opacity: 0, scale: 0.92, y: 10 }}
//             transition={{ type: "spring", stiffness: 220, damping: 22 }}
//           >
//             {/* Left sidebar */}
//             <div className="fai-sidebar">
//               <div className="fai-head" onPointerDown={onDragStart}>
//                 <span className="fai-title">CreaText</span>
//                 <div className="fai-actions">
//                   <button className="fai-iconbtn" title="Settings" onClick={() => setShowSettings(s => !s)}>⚙️</button>
//                   <button className="fai-iconbtn" title="Minimize" onClick={() => setOpen(false)}>🞂</button>
//                 </div>
//               </div>
//               <div className="fai-nav">
//                 {Object.entries(features).map(([k, v]) =>
//                   v ? (
//                     <button key={k} className={active === k ? "active" : ""} onClick={() => setActive(k)}>
//                       {k[0].toUpperCase() + k.slice(1)}
//                     </button>
//                   ) : null
//                 )}
//               </div>
//             </div>

//             {/* Body */}
//             <div className="fai-body">
//               {showSettings && (
//                 <Settings
//                   theme={theme}
//                   setTheme={setTheme}
//                   features={features}
//                   setFeatures={setFeatures}
//                 />
//               )}

//               <Pane
//                 key={paneKey}
//                 active={active}
//                 onRun={(text, options) => runOp(active, text, options)}
//                 onAdd={() => setPaneKey(k => k + 1)}
//               />

//               <div className="fai-results">
//                 {results.map(r => (
//                   <div key={r.id} className="fai-result">{r.text}</div>
//                 ))}
//               </div>

//               <div className="fai-add">
//                 <button onClick={() => setPaneKey(k => k + 1)}>Add Panel</button>
//               </div>
//             </div>

//             <div className="fai-resize" onPointerDown={startResize}></div>
//             <div className="fai-status">{status}</div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </>
//   );
// }

// /* UPDATED: no preview textarea; single-column settings */
// function Settings({ theme, setTheme, features, setFeatures }) {
//   const bubble = Number(theme.bubble) || 44;
//   const setVar = (key, rawKey) => (val) => setTheme({ ...theme, [key]: val, [rawKey]: val });

//   return (
//     <div className="fai-pane fai-settings" style={{ borderBottom: "1px solid var(--fai-border)" }}>
//       <div className="fai-controls">
//         <div className="options" style={{ flexWrap:"wrap" }}>
//           <label>Panel Color
//             <input type="color" value={theme.bg || "#374151"} onChange={e => setTheme({ ...theme, bg: e.target.value })} />
//           </label>
//           <input placeholder="#hex or rgb()" value={theme.bgRaw || ""} onChange={e => setVar("bg","bgRaw")(e.target.value)} />
//           <label>Border Color
//             <input type="color" value={theme.border || "#4b5563"} onChange={e => setTheme({ ...theme, border: e.target.value })} />
//           </label>
//           <input placeholder="#hex or rgb()" value={theme.borderRaw || ""} onChange={e => setVar("border","borderRaw")(e.target.value)} />
//           <label>Accent Color
//             <input type="color" value={theme.accent || "#a3a3a3"} onChange={e => setTheme({ ...theme, accent: e.target.value })} />
//           </label>
//           <input placeholder="#hex or rgb()" value={theme.accentRaw || ""} onChange={e => setVar("accent","accentRaw")(e.target.value)} />
//           <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             Bubble Size
//             <input type="range" min="32" max="56" value={bubble} onChange={e => setTheme({ ...theme, bubble: Number(e.target.value) })} />
//             <span style={{ opacity: .8 }}>{bubble}px</span>
//           </label>
//         </div>

//         <div className="options" style={{ flexWrap:"wrap" }}>
//           {Object.keys(features).map(key => (
//             <label key={key}>
//               <input
//                 type="checkbox"
//                 checked={!!features[key]}
//                 onChange={e => setFeatures({ ...features, [key]: e.target.checked })}
//               /> {key[0].toUpperCase()+key.slice(1)}
//             </label>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// function Pane({ active, onRun }) {
//   const taRef = useRef(null);
//   const [opts, setOpts] = useState({ words: 120, length: "medium", lang: "en", tone: "neutral", mode: "paragraph" });

//   const OptsUI = {
//     summarize: (
//       <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//         <label>Words <input type="number" min="30" max="800" value={opts.words} onChange={e=>setOpts({ ...opts, words:Number(e.target.value) })} /></label>
//         <span style={{ opacity:.7 }}>or</span>
//         <label>Length
//           <select value={opts.length} onChange={e=>setOpts({ ...opts, length: e.target.value })}>
//             <option value="short">Short</option>
//             <option value="medium">Medium</option>
//             <option value="long">Long</option>
//           </select>
//         </label>
//       </div>
//     ),
//     translate: (<label>To <input type="text" value={opts.lang} onChange={e=>setOpts({ ...opts, lang: e.target.value })}/></label>),
//     proofread: (<span style={{opacity:.8}}>Proofread has no options</span>),
//     rewrite: (
//       <label>Mode
//         <select value={opts.mode} onChange={e=>setOpts({ ...opts, mode: e.target.value })}>
//           <option value="key-points">Key points</option>
//           <option value="paragraph">New paragraph</option>
//           <option value="table">Table</option>
//           <option value="tone:formal">Tone: Formal</option>
//           <option value="tone:neutral">Tone: Neutral</option>
//           <option value="tone:casual">Tone: Casual</option>
//         </select>
//       </label>
//     ),
//     write: (
//       <label>Tone
//         <select value={opts.tone} onChange={e=>setOpts({ ...opts, tone: e.target.value })}>
//           <option value="formal">Formal</option>
//           <option value="neutral">Neutral</option>
//           <option value="casual">Casual</option>
//         </select>
//       </label>
//     )
//   }[active];

//   const [busy, setBusy] = useState(false);
//   const run = async () => {
//     setBusy(true);
//     await onRun(taRef.current.value, opts);
//     setBusy(false);
//   };

//   return (
//     <div className="fai-pane">
//       <textarea className="fai-input"
//         ref={taRef}
//         placeholder={active === "write" ? "Describe what to write..." : "Write or paste text here…"} />
//       <div className="fai-controls">
//         <div className="options">{OptsUI}</div>
//         <button className="runbtn" onClick={run} disabled={busy}>Run</button>
//       </div>
//     </div>
//   );
// }

// // Mount once
// (() => {
//   const id = "fai-root-mount";
//   if (document.getElementById(id)) return;
//   const mount = document.createElement("div");
//   mount.id = id;
//   document.documentElement.appendChild(mount);
//   createRoot(mount).render(<App />);
// })();






import "./style.css";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import { summarize, translate, rewrite, proofread, write } from "./aiBuiltins";

const defaultPos = { left: null, right: 24, top: null, bottom: 24, width: 560, height: 520 };
const defaultTheme = { bg: "", border: "", accent: "", bubble: 44, bgRaw: "", borderRaw: "", accentRaw: "" };
const defaultFeatures = { summarize: true, translate: true, proofread: true, rewrite: true, write: false };

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

function App() {
  const [enabled, setEnabled] = useStorage("enabled", true);
  const [pos, setPos] = useStorage("fai_pos", defaultPos);
  const [theme, setTheme] = useStorage("fai_theme", defaultTheme);
  const [features, setFeatures] = useStorage("fai_features", defaultFeatures);
  const [active, setActive] = useState("summarize");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [paneKey, setPaneKey] = useState(1);

  useEffect(() => {
    const handler = (msg) => {
      if (msg?.type === "__toggle__") setEnabled(msg.enabled);
      if (msg?.type === "__open__") { setEnabled(true); setOpen(true); }
      if (msg?.type === "__open_settings__") { setEnabled(true); setOpen(true); setShowSettings(true); }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [setEnabled]);

  useEffect(() => {
    const el = document.documentElement;
    const set = (name, val) => { if (val) el.style.setProperty(name, val); };
    set("--fai-bg", theme.bg || "rgba(17,24,39,.98)");
    set("--fai-border", theme.border || "#4b5563");
    set("--fai-accent", theme.accent || "#a3a3a3");
    el.style.setProperty("--fai-bubble-size", `${Number(theme.bubble) || 44}px`);
  }, [theme]);

  async function runOp(op, input, opts) {
    if (!input?.trim()) { alert("Paste some text first."); return; }
    setStatus("Working…");
    try {
      let out = "";
      if (op === "summarize") {
        const payload = {};
        if (opts.words && Number(opts.words) > 0) payload.words = Number(opts.words);
        else payload.length = (opts.length || "medium");
        out = await summarize(input, payload);
      } else if (op === "translate") {
        out = await translate(input, { from: "auto", to: opts.lang || "en" });
      } else if (op === "proofread") {
        const r = await proofread(input);
        out = r.correctedText ?? JSON.stringify(r, null, 2);
      } else if (op === "rewrite") {
        const mode = opts.mode || "paragraph";
        out = await rewrite(input, mode);
      } else if (op === "write") {
        out = await write(input, { tone: opts.tone || "neutral" });
      }
      setResults(r => [{ id: Date.now() + Math.random(), text: String(out || "").trim() }, ...r]);
    } catch (e) {
      setResults(r => [{ id: Date.now() + Math.random(), text: `Error: ${e?.message || e}` }, ...r]);
    } finally {
      setStatus("");
    }
  }

  // drag
  const dragState = useRef(null);
  const onDragStart = (e) => {
    if (e.target.closest(".fai-actions")) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragState.current = { 
      dx: e.clientX - rect.left, 
      dy: e.clientY - rect.top, 
      isBubble: target.classList.contains('fai-bubble'),
      startX: e.clientX,
      startY: e.clientY
    };
    window.addEventListener("pointermove", onDragging);
    window.addEventListener("pointerup", onDragEnd);
  };
  const onDragging = (e) => {
    if (!dragState.current) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const bubbleSize = parseFloat(rootStyle.getPropertyValue('--fai-bubble-size')) || 44;
    const isBubble = dragState.current.isBubble;
    const width = isBubble ? bubbleSize : (pos.width || 560);
    const height = isBubble ? bubbleSize : (pos.height || 520);
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, e.clientX - dragState.current.dx));
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, e.clientY - dragState.current.dy));
    setPos({ ...pos, left, right: null, top, bottom: null });
  };
  const onDragEnd = (e) => {
    if (dragState.current) {
      const dx = Math.abs(e.clientX - dragState.current.startX);
      const dy = Math.abs(e.clientY - dragState.current.startY);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (dragState.current.isBubble && distance < 5) {
        setOpen(true);
      }
    }
    dragState.current = null;
    window.removeEventListener("pointermove", onDragging);
    window.removeEventListener("pointerup", onDragEnd);
  };

  // resize
  const resizeState = useRef(null);
  const onResizeStart = (e) => {
    resizeState.current = { startWidth: pos.width || 560, startHeight: pos.height || 520, sx: e.clientX, sy: e.clientY };
    window.addEventListener("pointermove", onResizing);
    window.addEventListener("pointerup", onResizeEnd);
  };
  const onResizing = (e) => {
    if (!resizeState.current) return;
    const dx = e.clientX - resizeState.current.sx;
    const dy = e.clientY - resizeState.current.sy;
    const width = Math.max(500, resizeState.current.startWidth + dx);
    const height = Math.max(320, resizeState.current.startHeight + dy);
    setPos({ ...pos, width, height });
  };
  const onResizeEnd = () => {
    resizeState.current = null;
    window.removeEventListener("pointermove", onResizing);
    window.removeEventListener("pointerup", onResizeEnd);
  };

  const bubble = Number(theme.bubble) || 44;
  const setVar = (key, rawKey) => (val) => setTheme({ ...theme, [key]: '', [rawKey]: val });

  return !enabled ? null : (
    <AnimatePresence>
      {!open ? (
        <motion.div
          className="fai-bubble"
          onPointerDown={onDragStart}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          style={{
            left: pos.left,
            right: pos.right,
            top: pos.top,
            bottom: pos.bottom,
          }}
        >
          <div className="logo">AI</div>
        </motion.div>
      ) : (
        <motion.div
          className="fai-drawer"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{
            left: pos.left,
            right: pos.right,
            top: pos.top,
            bottom: pos.bottom,
            width: pos.width,
            height: pos.height,
          }}
        >
          <div className="fai-sidebar">
            <div className="fai-head" onPointerDown={onDragStart}>
              <div className="fai-title">CreaText</div>
              <div className="fai-actions">
                <button className="fai-iconbtn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
                <button className="fai-iconbtn" onClick={() => setOpen(false)}>✕</button>
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
              <Settings theme={theme} setTheme={setTheme} bubble={bubble} features={features} setFeatures={setFeatures} setVar={setVar} />
            ) : (
              <Pane key={paneKey} active={active} onRun={(input, opts) => runOp(active, input, opts)} />
            )}
            <div className="fai-results">
              {results.map(r => (
                <div key={r.id} className="fai-result">{r.text}</div>
              ))}
            </div>
            {status && <div className="fai-status">{status}</div>}
            <div className="fai-resize" onPointerDown={onResizeStart} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Settings({ theme, setTheme, bubble, features, setFeatures, setVar }) {
  return (
    <div className="fai-settings" style={{ borderBottom: "1px solid var(--fai-border)" }}>
      <div className="fai-controls">
        <div className="options" style={{ flexWrap: "wrap" }}>
          <label>Panel Color
            <input type="color" value={theme.bg || "#374151"} onChange={e => setTheme({ ...theme, bg: e.target.value })} />
          </label>
          <input placeholder="#hex or rgb()" value={theme.bgRaw || ""} onChange={e => setVar("bg", "bgRaw")(e.target.value)} />
          <label>Border Color
            <input type="color" value={theme.border || "#4b5563"} onChange={e => setTheme({ ...theme, border: e.target.value })} />
          </label>
          <input placeholder="#hex or rgb()" value={theme.borderRaw || ""} onChange={e => setVar("border", "borderRaw")(e.target.value)} />
          <label>Accent Color
            <input type="color" value={theme.accent || "#a3a3a3"} onChange={e => setTheme({ ...theme, accent: e.target.value })} />
          </label>
          <input placeholder="#hex or rgb()" value={theme.accentRaw || ""} onChange={e => setVar("accent", "accentRaw")(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Bubble Size
            <input type="range" min="32" max="56" value={bubble} onChange={e => setTheme({ ...theme, bubble: Number(e.target.value) })} />
            <span style={{ opacity: .8 }}>{bubble}px</span>
          </label>
        </div>

        <div className="options" style={{ flexWrap: "wrap" }}>
          {Object.keys(features).map(key => (
            <label key={key}>
              <input
                type="checkbox"
                checked={!!features[key]}
                onChange={e => setFeatures({ ...features, [key]: e.target.checked })}
              /> {key[0].toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pane({ active, onRun }) {
  const taRef = useRef(null);
  const [opts, setOpts] = useState({ words: 120, length: "medium", lang: "en", tone: "neutral", mode: "paragraph" });

  const OptsUI = {
    summarize: (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
        placeholder={active === "write" ? "Describe what to write..." : "Write or paste text here…"} />
      <div className="fai-controls">
        <div className="options">{OptsUI}</div>
        <button className="runbtn" onClick={run} disabled={busy}>Run</button>
      </div>
    </div>
  );
}

// Mount once
(() => {
  const id = "fai-root-mount";
  if (document.getElementById(id)) return;
  const mount = document.createElement("div");
  mount.id = id;
  document.documentElement.appendChild(mount);
  createRoot(mount).render(<App />);
})();