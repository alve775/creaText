import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

async function injectIntoActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/i.test(tab.url || "")) return;

  const mf = chrome.runtime.getManifest();
  const cs = (mf.content_scripts && mf.content_scripts[0]) || {};
  const jsFiles = cs.js || [];

  try {
    for (const f of jsFiles) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [f], world: "ISOLATED" });
    }
  } catch {}
}

function Popup() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    chrome.storage.local.get({ enabled: true }, s => setEnabled(s.enabled));
  }, []);

  const update = async (v) => {
    await chrome.storage.local.set({ enabled: v });
    setEnabled(v);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "__toggle__", enabled: v });
  };

  const send = async (type) => {
    await injectIntoActiveTab();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type });
  };

  return (
    <>
      <div className="row">
        <div>
          <div style={{ fontWeight: 700 }}>Fluid AI</div>
          <div style={{ opacity: .8, fontSize: 12 }}>Toggle the floating bubble on pages</div>
        </div>
        <label><input type="checkbox" checked={enabled} onChange={(e)=>update(e.target.checked)} /></label>
      </div>
      <div className="row" style={{ gap: 8, padding:'12px 14px' }}>
        <button onClick={()=>send("__open__")}>Show now</button>
        <button onClick={()=>send("__open_settings__")}>Quick settings</button>
      </div>
      <div className="hint">Note: Won’t show on chrome:// pages or the Web Store.</div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Popup />);
