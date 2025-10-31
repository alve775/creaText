// src/offscreen.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg?.type === "FAI_PING_OFFSCREEN" || msg?.type === "FAI_OFFSCREEN_PING") {
        sendResponse({ ok: true });
        return;
      }
      if (msg?.type === "FAI_REWRITE_OFFSCREEN") {
        try {
          const { text, mode = "paragraph" } = msg;
          if (!text || !text.trim()) throw new Error("No text provided.");
  
          let tone = "neutral";
          if (mode.startsWith("tone:")) tone = mode.slice(5);
  
          if (!("Rewriter" in self) || !Rewriter?.capabilities) {
            throw new Error("Rewriter API unavailable in offscreen context.");
          }
          const caps = await Rewriter.capabilities();
          if (!caps || (caps.available !== "readily" && caps.available !== "after-download")) {
            throw new Error(`Rewriter not available: ${caps?.available || "unknown"}`);
          }
  
          const rw = await Rewriter.create({ tone });
          const out = await rw.rewrite(text);
          sendResponse({ ok: true, text: out?.rewrittenText ?? String(out ?? "") });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      }
    })();
    return true;
  });
  