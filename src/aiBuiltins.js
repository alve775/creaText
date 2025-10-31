// const REQ = "__FAI_REQ__";
// const RES = "__FAI_RES__";

// async function ensureBridge() {
//   try { await chrome.runtime.sendMessage({ type: "FAI_INSTALL_BRIDGE" }); } catch {}
//   await new Promise(r => setTimeout(r, 30));
// }

// function callInPage(op, payload) {
//   return new Promise((resolve, reject) => {
//     const id = "fai_" + Math.random().toString(36).slice(2);
//     const onMsg = (ev) => {
//       const d = ev.data;
//       if (!d || d.__tag !== RES || d.id !== id) return;
//       window.removeEventListener("message", onMsg);
//       if (d.error) reject(new Error(d.error));
//       else resolve(d.result);
//     };
//     window.addEventListener("message", onMsg);
//     window.postMessage({ __tag: REQ, id, op, payload });
//     setTimeout(() => {
//       window.removeEventListener("message", onMsg);
//       reject(new Error("Timed out talking to built-in AI page bridge."));
//     }, 30000);
//   });
// }

// export async function summarize(text, opts = {}) {
//   if (!text?.trim()) throw new Error("No text to summarize.");
//   await ensureBridge();
//   return callInPage("summarize", { text, ...opts }); // {words? length?}
// }
// export async function translate(text, { from = "auto", to = "en" } = {}) {
//   if (!text?.trim()) throw new Error("No text to translate.");
//   await ensureBridge();
//   return callInPage("translate", { text, from, to });
// }
// export async function proofread(text) {
//   if (!text?.trim()) throw new Error("No text to proofread.");
//   await ensureBridge();
//   return callInPage("proofread", { text });
// }
// export async function rewrite(text, modeOrTone = "neutral") {
//   if (!text?.trim()) throw new Error("No text to rewrite.");
//   await ensureBridge();
//   return callInPage("rewrite", { text, mode: modeOrTone });
// }
// export async function write(taskPrompt, opts = { tone: "neutral" }) {
//   if (!taskPrompt?.trim()) throw new Error("No prompt to write from.");
//   await ensureBridge();
//   return callInPage("write", { text: taskPrompt, tone: opts.tone || "neutral" });
// }











// src/aiBuiltins.js

// const REQ = "__FAI_REQ__";
// const RES = "__FAI_RES__";

// // Stable per-tab/session nonce so only our content script can talk to the page bridge
// const NONCE = crypto.getRandomValues(new Uint32Array(4)).join("-");

// // Ask the SW to inject (or confirm) the bridge with our nonce
// async function ensureBridgeInstalled() {
//   try { await chrome.runtime.sendMessage({ type: "FAI_INSTALL_BRIDGE", nonce: NONCE }); } catch {}
// }

// // Low-latency call helper with nonce
// function callInPage(op, payload, timeoutMs = 30000) {
//   return new Promise((resolve, reject) => {
//     const id = "fai_" + Math.random().toString(36).slice(2);

//     const onMsg = (ev) => {
//       const d = ev.data;
//       if (!d || d.__tag !== RES || d.id !== id || d.__nonce !== NONCE) return;
//       cleanup();
//       if (d.error) reject(new Error(d.error));
//       else resolve(d.result);
//     };

//     const cleanup = () => {
//       window.removeEventListener("message", onMsg);
//       clearTimeout(t);
//     };

//     window.addEventListener("message", onMsg);
//     window.postMessage({ __tag: REQ, id, op, payload, __nonce: NONCE });

//     const t = setTimeout(() => {
//       cleanup();
//       reject(new Error("Timed out talking to built-in AI page bridge."));
//     }, timeoutMs);
//   });
// }

// // Wait until the bridge answers a quick ping (avoids first-call races)
// async function waitForBridgeReady(tries = 10) {
//   for (let i = 0; i < tries; i++) {
//     try {
//       const r = await Promise.race([
//         callInPage("ping", null, 1500),
//         new Promise((_, rej) => setTimeout(() => rej(new Error("ping timeout")), 1500)),
//       ]);
//       if (r === "ok") return;
//     } catch {}
//     await new Promise(r => setTimeout(r, 150 + i * 100));
//   }
//   throw new Error("Bridge not ready. Please try again.");
// }

// export async function summarize(text, opts = {}) {
//   if (!text?.trim()) throw new Error("No text to summarize.");
//   await ensureBridgeInstalled();
//   await waitForBridgeReady();
//   return callInPage("summarize", { text, ...opts });
// }
// export async function translate(text, { from = "auto", to = "en" } = {}) {
//   if (!text?.trim()) throw new Error("No text to translate.");
//   await ensureBridgeInstalled();
//   await waitForBridgeReady();
//   return callInPage("translate", { text, from, to });
// }
// export async function proofread(text) {
//   if (!text?.trim()) throw new Error("No text to proofread.");
//   await ensureBridgeInstalled();
//   await waitForBridgeReady();
//   return callInPage("proofread", { text });
// }
// export async function rewrite(text, modeOrTone = "neutral") {
//   if (!text?.trim()) throw new Error("No text to rewrite.");
//   await ensureBridgeInstalled();
//   await waitForBridgeReady();
//   return callInPage("rewrite", { text, mode: modeOrTone });
// }
// export async function write(taskPrompt, opts = { tone: "neutral" }) {
//   if (!taskPrompt?.trim()) throw new Error("No prompt to write from.");
//   await ensureBridgeInstalled();
//   await waitForBridgeReady();
//   return callInPage("write", { text: taskPrompt, tone: opts.tone || "neutral" });
// }












// src/aiBuiltins.js

const REQ = "__FAI_REQ__";
const RES = "__FAI_RES__";
const NONCE = crypto.getRandomValues(new Uint32Array(4)).join("-");

async function ensureBridgeInstalled() {
  try { await chrome.runtime.sendMessage({ type: "FAI_INSTALL_BRIDGE", nonce: NONCE }); } catch {}
}
function callInPage(op, payload, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = "fai_" + Math.random().toString(36).slice(2);
    function onMsg(ev){ const d=ev.data;
      if (!d || d.__tag!==RES || d.id!==id || d.__nonce!==NONCE) return;
      cleanup(); d.error ? reject(new Error(d.error)) : resolve(d.result);
    }
    function cleanup(){ window.removeEventListener("message",onMsg); clearTimeout(t); }
    window.addEventListener("message", onMsg);
    window.postMessage({ __tag: REQ, id, op, payload, __nonce: NONCE });
    const t=setTimeout(()=>{ cleanup(); reject(new Error("Timed out talking to built-in AI page bridge.")); }, timeoutMs);
  });
}
async function waitForBridgeReady(tries=10){
  for(let i=0;i<tries;i++){
    try{
      const r=await Promise.race([
        callInPage("ping", null, 1500),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("ping timeout")),1500))
      ]);
      if(r==="ok") return;
    }catch{}
    await new Promise(r=>setTimeout(r,150+i*100));
  }
  throw new Error("Bridge not ready. Please try again.");
}

export async function summarize(text, opts={}){ if(!text?.trim()) throw new Error("No text to summarize."); await ensureBridgeInstalled(); await waitForBridgeReady(); return callInPage("summarize",{text,...opts}); }
export async function translate(text,{from="auto",to="en"}={}){ if(!text?.trim()) throw new Error("No text to translate."); await ensureBridgeInstalled(); await waitForBridgeReady(); return callInPage("translate",{text,from,to}); }
export async function proofread(text){ if(!text?.trim()) throw new Error("No text to proofread."); await ensureBridgeInstalled(); await waitForBridgeReady(); return callInPage("proofread",{text}); }

// Rewriter: tone/paragraph -> background/offscreen (token); key-points/table -> page bridge
export async function rewrite(text, mode="paragraph"){
  if(!text?.trim()) throw new Error("No text to rewrite.");
  if (mode==="key-points" || mode==="table"){ await ensureBridgeInstalled(); await waitForBridgeReady(); return callInPage("rewrite",{text,mode}); }
  const res = await chrome.runtime.sendMessage({ type: "FAI_REWRITE_REQUEST", text, mode });
  if (!res?.ok) throw new Error(res?.error || "Rewrite failed."); return res.text;
}

export async function write(prompt,{tone="neutral"}={}){ if(!prompt?.trim()) throw new Error("No prompt to write from."); await ensureBridgeInstalled(); await waitForBridgeReady(); return callInPage("write",{text:prompt,tone}); }
