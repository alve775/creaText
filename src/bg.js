chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ enabled: true });
  });
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      if (msg?.type === "FAI_INSTALL_BRIDGE") {
        try {
          const tabId = sender?.tab?.id ?? msg.tabId;
          if (!tabId) throw new Error("No tabId to install bridge.");
  
          await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: () => {
              const REQ = "__FAI_REQ__";
              const RES = "__FAI_RES__";
              if (window.__fai_bridge_installed__) return;
              window.__fai_bridge_installed__ = true;
  
              async function summarizeBuiltIn({ text, length, words }) {
                if (typeof words === "number" && words > 10) {
                  if (!("LanguageModel" in self)) throw new Error("Prompt API unavailable for word-limited summary.");
                  const session = await LanguageModel.create({});
                  return session.prompt(`Summarize the following content in about ${words} words.\n\n${text}\n\nSummary (~${words} words):`);
                }
                if (!("Summarizer" in self)) throw new Error("Summarizer API not supported.");
                const summarizer = await Summarizer.create({ type: "key-points", length: length || "medium", format: "plain-text" });
                const res = await summarizer.summarize(text);
                return res?.summaryText || String(res || "");
              }
  
              // UPDATED: only set sourceLanguage if not 'auto'
              async function translateBuiltIn({ text, from = "auto", to = "en" }) {
                if (!("Translator" in self)) throw new Error("Translator API not supported.");
                const opts = { targetLanguage: to };
                if (from && from !== "auto") opts.sourceLanguage = from;
                const translator = await Translator.create(opts);
                return translator.translate(text);
              }
  
              // unchanged
              async function proofreadBuiltIn({ text }) {
                if (!("Proofreader" in self)) throw new Error("Proofreader API not supported.");
                const pf = await Proofreader.create();
                const r = await pf.proofread({ text });
                return r;
              }
  
              // UPDATED: Rewriter fallback to LanguageModel
              async function rewriteBuiltIn({ text, mode = "neutral" }) {
                if (mode === "key-points") {
                  if (!("Summarizer" in self)) throw new Error("Summarizer API not supported.");
                  const summarizer = await Summarizer.create({ type: "key-points", length: "medium", format: "plain-text" });
                  const r = await summarizer.summarize(text);
                  return r?.summaryText || String(r || "");
                }
                if (mode === "table") {
                  if (!("LanguageModel" in self)) throw new Error("Prompt API unavailable for table output.");
                  const session = await LanguageModel.create({});
                  return session.prompt(
                    `Convert the following text into a concise Markdown table of key points (2–5 columns, clear headers). Return Markdown only.\n\n${text}\n\n`
                  );
                }
                // tone:<formal|neutral|casual> or "paragraph"
                let tone = mode.startsWith("tone:") ? mode.slice(5) : null;
                if (!tone && mode === "paragraph") tone = "neutral";
  
                if ("Rewriter" in self) {
                  const rw = await Rewriter.create({ tone: tone || "neutral" });
                  const out = await rw.rewrite(text);
                  return out?.rewrittenText || String(out || "");
                }
  
                if (!("LanguageModel" in self)) throw new Error("Rewriter API not supported and Prompt API unavailable.");
                const session = await LanguageModel.create({});
                const prompt = tone
                  ? `Rewrite the following text in a ${tone} tone, preserving meaning and improving clarity:\n\n${text}\n\nRewritten:`
                  : `Rewrite the following text as a clean, well-structured paragraph:\n\n${text}\n\nRewritten:`;
                return session.prompt(prompt);
              }
  
              async function writeBuiltIn({ text, tone = "neutral" }) {
                if (!("LanguageModel" in self)) throw new Error("Prompt API not supported.");
                const session = await LanguageModel.create({});
                return session.prompt(`Write with a ${tone} tone:\n${text}\n\nOutput:`);
              }
  
              window.addEventListener("message", async (ev) => {
                const d = ev.data;
                if (!d || d.__tag !== REQ) return;
                const { id, op, payload } = d;
  
                try {
                  if (!("userActivation" in navigator) || !navigator.userActivation.isActive) {
                    throw new Error("Click the Run button again to allow the on-device model to start.");
                  }
  
                  let result = "";
                  if (op === "summarize") result = await summarizeBuiltIn(payload);
                  else if (op === "translate") result = await translateBuiltIn(payload);
                  else if (op === "proofread") result = await proofreadBuiltIn(payload);
                  else if (op === "rewrite") result = await rewriteBuiltIn(payload);
                  else if (op === "write") result = await writeBuiltIn(payload);
                  else throw new Error("Unknown op: " + op);
  
                  window.postMessage({ __tag: RES, id, result });
                } catch (e) {
                  window.postMessage({ __tag: RES, id, error: e?.message || String(e) });
                }
              });
            }
          });
  
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      }
    })();
  
    return true;
  });
  