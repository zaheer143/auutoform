const statusEl = document.getElementById("status");
const apiBaseEl = document.getElementById("apiBase");
const apiKeyEl = document.getElementById("apiKey");

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function loadSettings() {
  const { apiBase, apiKey } = await chrome.storage.local.get(["apiBase", "apiKey"]);
  apiBaseEl.value = apiBase || "http://localhost:8080";
  apiKeyEl.value = apiKey || "";
}

async function saveSettings() {
  const apiBase = (apiBaseEl.value || "").trim();
  const apiKey = (apiKeyEl.value || "").trim();

  if (!apiBase) return setStatus("❌ Backend URL required");
  if (!apiKey) return setStatus("❌ API key required");

  // write
  await chrome.storage.local.set({ apiBase, apiKey });

  // read back to confirm saved
  const check = await chrome.storage.local.get(["apiBase", "apiKey"]);
  const ok = !!check.apiKey && check.apiKey === apiKey;

  if (!ok) {
    setStatus("❌ Save failed (storage not updated). Reload extension and try again.");
    return;
  }

  setStatus("✅ Saved settings.");
}

async function sendToActiveTab(type) {
  // Always ensure we have saved settings before actions
  const { apiKey } = await chrome.storage.local.get(["apiKey"]);
  if (!apiKey) {
    setStatus("❌ API key not saved. Click Save Settings first.");
    return;
  }

  setStatus("Sending: " + type);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return setStatus("❌ No active tab found.");

  chrome.tabs.sendMessage(tab.id, { type }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("❌ Content script not ready on this page.");
      return;
    }
    setStatus(resp?.message || "Done.");
  });
}

document.getElementById("save").addEventListener("click", saveSettings);
document.getElementById("detect").addEventListener("click", () => sendToActiveTab("DETECT"));
document.getElementById("fill").addEventListener("click", () => sendToActiveTab("FILL"));

loadSettings().then(() => setStatus("Popup loaded. Click Save Settings once."));
