const REQ = "__FAI_REQ__";
const RES = "__FAI_RES__";

async function ensureBridge() {
  try { await chrome.runtime.sendMessage({ type: "FAI_INSTALL_BRIDGE" }); } catch {}
  await new Promise(r => setTimeout(r, 30));
}

function callInPage(op, payload) {
  return new Promise((resolve, reject) => {
    const id = "fai_" + Math.random().toString(36).slice(2);
    const onMsg = (ev) => {
      const d = ev.data;
      if (!d || d.__tag !== RES || d.id !== id) return;
      window.removeEventListener("message", onMsg);
      if (d.error) reject(new Error(d.error));
      else resolve(d.result);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ __tag: REQ, id, op, payload });
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Timed out talking to built-in AI page bridge."));
    }, 30000);
  });
}

export async function summarize(text, opts = {}) {
  if (!text?.trim()) throw new Error("No text to summarize.");
  await ensureBridge();
  return callInPage("summarize", { text, ...opts }); // {words? length?}
}
export async function translate(text, { from = "auto", to = "en" } = {}) {
  if (!text?.trim()) throw new Error("No text to translate.");
  await ensureBridge();
  return callInPage("translate", { text, from, to });
}
export async function proofread(text) {
  if (!text?.trim()) throw new Error("No text to proofread.");
  await ensureBridge();
  return callInPage("proofread", { text });
}
export async function rewrite(text, modeOrTone = "neutral") {
  if (!text?.trim()) throw new Error("No text to rewrite.");
  await ensureBridge();
  return callInPage("rewrite", { text, mode: modeOrTone });
}
export async function write(taskPrompt, opts = { tone: "neutral" }) {
  if (!taskPrompt?.trim()) throw new Error("No prompt to write from.");
  await ensureBridge();
  return callInPage("write", { text: taskPrompt, tone: opts.tone || "neutral" });
}
