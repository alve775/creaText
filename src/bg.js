// chrome.runtime.onInstalled.addListener(() => {
//     chrome.storage.local.set({ enabled: true });
//   });
  
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     (async () => {
//       if (msg?.type === "FAI_INSTALL_BRIDGE") {
//         try {
//           const tabId = sender?.tab?.id ?? msg.tabId;
//           if (!tabId) throw new Error("No tabId to install bridge.");
  
//           await chrome.scripting.executeScript({
//             target: { tabId },
//             world: "MAIN",
//             func: () => {
//               const REQ = "__FAI_REQ__";
//               const RES = "__FAI_RES__";
//               if (window.__fai_bridge_installed__) return;
//               window.__fai_bridge_installed__ = true;
  
//               async function summarizeBuiltIn({ text, length, words }) {
//                 if (typeof words === "number" && words > 10) {
//                   if (!("LanguageModel" in self)) throw new Error("Prompt API unavailable for word-limited summary.");
//                   const session = await LanguageModel.create({});
//                   return session.prompt(`Summarize the following content in about ${words} words.\n\n${text}\n\nSummary (~${words} words):`);
//                 }
//                 if (!("Summarizer" in self)) throw new Error("Summarizer API not supported.");
//                 const summarizer = await Summarizer.create({ type: "key-points", length: length || "medium", format: "plain-text" });
//                 const res = await summarizer.summarize(text);
//                 return res?.summaryText || String(res || "");
//               }
  
//               // UPDATED: only set sourceLanguage if not 'auto'
//               async function translateBuiltIn({ text, from = "auto", to = "en" }) {
//                 if (!("Translator" in self)) throw new Error("Translator API not supported.");
//                 const opts = { targetLanguage: to };
//                 if (from && from !== "auto") opts.sourceLanguage = from;
//                 const translator = await Translator.create(opts);
//                 return translator.translate(text);
//               }
  
//               // unchanged
//               async function proofreadBuiltIn({ text }) {
//                 if (!("Proofreader" in self)) throw new Error("Proofreader API not supported.");
//                 const pf = await Proofreader.create();
//                 const r = await pf.proofread({ text });
//                 return r;
//               }
  
//               // UPDATED: Rewriter fallback to LanguageModel
//               async function rewriteBuiltIn({ text, mode = "neutral" }) {
//                 if (mode === "key-points") {
//                   if (!("Summarizer" in self)) throw new Error("Summarizer API not supported.");
//                   const summarizer = await Summarizer.create({ type: "key-points", length: "medium", format: "plain-text" });
//                   const r = await summarizer.summarize(text);
//                   return r?.summaryText || String(r || "");
//                 }
//                 if (mode === "table") {
//                   if (!("LanguageModel" in self)) throw new Error("Prompt API unavailable for table output.");
//                   const session = await LanguageModel.create({});
//                   return session.prompt(
//                     `Convert the following text into a concise Markdown table of key points (2–5 columns, clear headers). Return Markdown only.\n\n${text}\n\n`
//                   );
//                 }
//                 // tone:<formal|neutral|casual> or "paragraph"
//                 let tone = mode.startsWith("tone:") ? mode.slice(5) : null;
//                 if (!tone && mode === "paragraph") tone = "neutral";
  
//                 if ("Rewriter" in self) {
//                   const rw = await Rewriter.create({ tone: tone || "neutral" });
//                   const out = await rw.rewrite(text);
//                   return out?.rewrittenText || String(out || "");
//                 }
  
//                 if (!("LanguageModel" in self)) throw new Error("Rewriter API not supported and Prompt API unavailable.");
//                 const session = await LanguageModel.create({});
//                 const prompt = tone
//                   ? `Rewrite the following text in a ${tone} tone, preserving meaning and improving clarity:\n\n${text}\n\nRewritten:`
//                   : `Rewrite the following text as a clean, well-structured paragraph:\n\n${text}\n\nRewritten:`;
//                 return session.prompt(prompt);
//               }
  
//               async function writeBuiltIn({ text, tone = "neutral" }) {
//                 if (!("LanguageModel" in self)) throw new Error("Prompt API not supported.");
//                 const session = await LanguageModel.create({});
//                 return session.prompt(`Write with a ${tone} tone:\n${text}\n\nOutput:`);
//               }
  
//               window.addEventListener("message", async (ev) => {
//                 const d = ev.data;
//                 if (!d || d.__tag !== REQ) return;
//                 const { id, op, payload } = d;
  
//                 try {
//                   if (!("userActivation" in navigator) || !navigator.userActivation.isActive) {
//                     throw new Error("Click the Run button again to allow the on-device model to start.");
//                   }
  
//                   let result = "";
//                   if (op === "summarize") result = await summarizeBuiltIn(payload);
//                   else if (op === "translate") result = await translateBuiltIn(payload);
//                   else if (op === "proofread") result = await proofreadBuiltIn(payload);
//                   else if (op === "rewrite") result = await rewriteBuiltIn(payload);
//                   else if (op === "write") result = await writeBuiltIn(payload);
//                   else throw new Error("Unknown op: " + op);
  
//                   window.postMessage({ __tag: RES, id, result });
//                 } catch (e) {
//                   window.postMessage({ __tag: RES, id, error: e?.message || String(e) });
//                 }
//               });
//             }
//           });
  
//           sendResponse({ ok: true });
//         } catch (e) {
//           sendResponse({ ok: false, error: e?.message || String(e) });
//         }
//       }
//     })();
  
//     return true;
//   });
  











async function ensureOffscreenReady() {
  const existed = await chrome.offscreen.hasDocument?.();
  if (existed) return true;

  if (!chrome.offscreen.createDocument) {
    throw new Error("Offscreen API is not available in this Chrome build.");
  }

  await chrome.offscreen.createDocument({
    url: "src/offscreen.html",
    reasons: ["BLOBS"],
    justification: "Run Rewriter API in an offscreen document.",
  });

  // wait until offscreen replies to a ping
  for (let i = 0; i < 15; i++) {
    try {
      const res = await chrome.runtime.sendMessage({ type: "FAI_PING_OFFSCREEN" });
      if (res?.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 150 + i * 100));
  }
  throw new Error("Offscreen page failed to load.");
}

/* -----------------------------------------------------------
   Message router
   ----------------------------------------------------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "FAI_REWRITE_REQUEST") {
      try {
        await ensureOffscreenReady();
        const res = await chrome.runtime.sendMessage({
          type: "FAI_REWRITE_OFFSCREEN",
          text: msg.text,
          mode: msg.mode || "paragraph",
        });
        sendResponse(res);
      } catch (e) {
        sendResponse({
          ok: false,
          error:
            e?.message ||
            "Offscreen page failed to load (check manifest offscreen permission and offscreen.html path).",
        });
      }
      return;
    }

    if (msg?.type === "FAI_INSTALL_BRIDGE") {
      try {
        const tabId = sender?.tab?.id ?? msg.tabId;
        if (!tabId) throw new Error("No tabId to install bridge.");

        await chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          args: [msg.nonce || ""],
          func: (expectedNonce) => {
            const REQ = "__FAI_REQ__";
            const RES = "__FAI_RES__";

            if (window.__fai_bridge_installed__) return;
            window.__fai_bridge_installed__ = true;

            const okAvail = (v) => v === "readily" || v === "after-download";
            async function has(name) {
              try {
                if (!(name in self) || !self[name]?.capabilities) return false;
                const c = await self[name].capabilities();
                console.log(`[CreaText] ${name} availability:`, c?.available);
                return okAvail(c?.available);
              } catch (e) {
                console.warn(`[CreaText] ${name} check failed:`, e);
                return false;
              }
            }
            async function lmAvailable()        { return has("LanguageModel"); }
            async function summarizerAvailable(){ return has("Summarizer"); }
            async function translatorAvailable(){ return has("Translator"); }
            async function proofreaderAvailable(){ return has("Proofreader"); }

            function heuristicSummarize(text, words, length) {
              const clean = String(text || "").replace(/\s+/g, " ").trim();
              if (!clean) return "";
              const sents = clean
                .split(/(?<=[.!?])\s+(?=[A-Z(“"'\[])/)
                .filter(Boolean);

              // word budget shortcut
              if (typeof words === "number" && words > 10) {
                const arr = clean.split(/\s+/);
                if (arr.length <= words) return clean;
                const out = arr.slice(0, words).join(" ");
                return out + (arr.length > words ? "…" : "");
              }

              const budget = length === "short" ? 2 : length === "long" ? 6 : 4;
              if (sents.length <= budget) return clean;

              const kw =
                /\b(is|are|include|includes|provides|supports|uses|lets|allows|helps|improves|works|runs|key|point|feature|result|because|how|why)\b/i;
              const scored = sents
                .map((s, idx) => {
                  const len = s.split(/\s+/).length;
                  const lenScore = Math.max(0, 18 - Math.abs(18 - len));
                  const keyScore = kw.test(s) ? 10 : 0;
                  const posScore = idx === 0 ? 6 : idx === sents.length - 1 ? 4 : 0;
                  return { s, score: lenScore + keyScore + posScore };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, budget)
                .map(x => x.s);
              return scored.join(" ");
            }

            function heuristicRewrite(text) {
              return String(text || "")
                .replace(/\s+/g, " ")
                .replace(/\s([,.;!?])/g, "$1")
                .trim();
            }

            async function summarizeBuiltIn({ text, length, words }) {
              console.log("[CreaText] Starting summarize with:", { length, words, textLength: text?.length });
              
              // Check API availability
              const lmAvail = await lmAvailable();
              const summAvail = await summarizerAvailable();
              console.log("[CreaText] API availability:", { LanguageModel: lmAvail, Summarizer: summAvail });
              
              if (typeof words === "number" && words > 10 && lmAvail) {
                try {
                  console.log("[CreaText] Trying LanguageModel...");
                  const s = await LanguageModel.create({});
                  const result = await s.prompt(
                    `Summarize the following content in about ${words} words.\n\n${text}\n\nSummary (~${words} words):`
                  );
                  console.log("[CreaText] LanguageModel success");
                  return result;
                } catch (e) {
                  console.warn("[CreaText] LanguageModel failed:", e);
                }
              }
              
              if (summAvail) {
                try {
                  console.log("[CreaText] Trying Summarizer API...");
                  const base = typeof words === "number" && words > 10 ? "long" : length || "medium";
                  const summarizer = await Summarizer.create({
                    type: "key-points",
                    length: base,
                    format: "plain-text",
                  });
                  const res = await summarizer.summarize(text);
                  const result = res?.summaryText || String(res || "");
                  console.log("[CreaText] Summarizer success");
                  return result;
                } catch (e) {
                  console.warn("[CreaText] Summarizer API failed:", e);
                  throw new Error(`Summarizer API error: ${e.message}`);
                }
              }
              
              // Build detailed error message
              const errors = [];
              if (!("Summarizer" in self)) errors.push("Summarizer API not found in window");
              if (!("LanguageModel" in self)) errors.push("LanguageModel API not found in window");
              
              const errorMsg = errors.length > 0 
                ? `AI APIs unavailable: ${errors.join(", ")}. `
                : "AI APIs exist but report as unavailable. ";
              
              throw new Error(
                errorMsg +
                "Steps to fix:\n" +
                "1. Go to chrome://flags\n" +
                "2. Enable: Summarization API, Prompt API for Gemini Nano\n" +
                "3. Restart Chrome\n" +
                "4. Check chrome://components for 'Optimization Guide On Device Model' and click 'Check for update'\n" +
                "5. Wait for model download (may take a few minutes)\n" +
                "6. Try again after model shows as updated"
              );
            }

            async function translateBuiltIn({ text, from = "auto", to = "en" }) {
  if (await translatorAvailable()) {
    const opts = { targetLanguage: to };
    if (from && from !== "auto") opts.sourceLanguage = from;
    const tr = await Translator.create(opts);
    return tr.translate(text);
  }
  // Fallback: use LanguageModel if available so translate never dead-ends
  if (await lmAvailable()) {
    const s = await LanguageModel.create({});
    return s.prompt(`Translate to ${to}:\n\n${text}\n\nTranslation:`);
  }
  throw new Error("Translator API not available on this device.");
}

            async function proofreadBuiltIn({ text }) {
              if (await proofreaderAvailable()) {
                const pf = await Proofreader.create();
                const r = await pf.proofread({ text });
                return r;
              }
              return { correctedText: heuristicRewrite(text) };
            }

            async function writeBuiltIn({ text, tone = "neutral" }) {
              if (!(await lmAvailable())) throw new Error("Prompt API not available for write.");
              const s = await LanguageModel.create({});
              return s.prompt(`${tone ? `[${tone} tone]\n` : ""}${text || ""}`);
            }

            window.addEventListener("message", async (ev) => {
              if (!ev?.data || ev.data.__tag !== REQ) return;
              const { id, __nonce, op, payload } = ev.data;

              if (__nonce !== expectedNonce) {
                window.postMessage({
                  __tag: RES,
                  id,
                  __nonce: expectedNonce,
                  error: "Bridge not ready (nonce mismatch).",
                });
                return;
              }

              try {
                let result = "";
                if (op === "ping") {
                  result = "ok";
                } else if (op === "summarize") result = await summarizeBuiltIn(payload);
                else if (op === "translate") result = await translateBuiltIn(payload);
                else if (op === "proofread") result = await proofreadBuiltIn(payload);
                else if (op === "rewrite") {
  const mode = (payload && payload.mode) || "paragraph";
  if (mode === "key-points") {
    if (await summarizerAvailable()) {
      const summarizer = await Summarizer.create({ type: "key-points", length: "medium", format: "plain-text" });
      const res = await summarizer.summarize(payload.text || "");
      result = res?.summaryText || String(res || "");
    } else if (await lmAvailable()) {
      const s = await LanguageModel.create({});
      result = await s.prompt(`List the key points of the following text as concise bullet points.\n\n${payload.text || ""}\n\nKey points:`);
    } else {
      result = heuristicSummarize(payload.text || "", 120, "medium");
    }
  } else if (mode === "table") {
    if (await lmAvailable()) {
      const s = await LanguageModel.create({});
      result = await s.prompt(`Convert the following text into a concise Markdown table (max 5 columns, clear headers). Return Markdown only.\n\n${payload.text || ""}\n\n`);
    } else {
      throw new Error("Prompt API unavailable for table output.");
    }
  } else {
    // paragraph or tone:* are handled by the extension offscreen route (origin-trial)
    throw new Error("Rewrite (paragraph/tone) runs via extension (origin-trial).");
  }
} else if (op === "write") result = await writeBuiltIn(payload);
                else throw new Error("Unknown op: " + op);

                window.postMessage({
                  __tag: RES,
                  id,
                  __nonce: expectedNonce,
                  result,
                });
              } catch (e) {
                window.postMessage({
                  __tag: RES,
                  id,
                  __nonce: expectedNonce,
                  error: e?.message || String(e),
                });
              }
            });
          },
        });

        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return;
    }

    if (msg?.type === "FAI_PING_BRIDGE") {
      try {
        const tabId = sender?.tab?.id ?? msg.tabId;
        if (!tabId) throw new Error("No tabId to ping bridge.");
        const res = await chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          args: [msg.nonce || ""],
          func: (expectedNonce) => {
            const RES = "__FAI_RES__";
            if (window.__fai_bridge_ready__) {
              window.postMessage({ __tag: RES, id: "fai-bridge-install", result: "ok" });
              return true;
            }
            return false;
          },
        });
        sendResponse({ ok: !!(res && res[0] && res[0].result) });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return;
    }
  })();
});