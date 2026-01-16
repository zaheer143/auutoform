// AutoForm Filler - popup.js (MV3)

const statusEl = document.getElementById("status");
const apiBaseEl = document.getElementById("apiBase");
const apiKeyEl = document.getElementById("apiKey");

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function loadSettings() {
  const { apiBase, apiKey } = await chrome.storage.local.get(["apiBase", "apiKey"]);
  apiBaseEl.value = (apiBase || "https://auutoform-production.up.railway.app").trim().replace(/\/$/, "");
  apiKeyEl.value = apiKey || "";
}

async function saveSettings() {
  const apiBase = (apiBaseEl.value || "").trim().replace(/\/$/, "");
  const apiKey = (apiKeyEl.value || "").trim();

  if (!apiBase) return setStatus("❌ Backend URL required");
  if (!apiKey) return setStatus("❌ API key required");

  await chrome.storage.local.set({ apiBase, apiKey });

  const check = await chrome.storage.local.get(["apiBase", "apiKey"]);
  if (!check.apiKey || check.apiKey !== apiKey) {
    setStatus("❌ Save failed. Reload extension and try again.");
    return;
  }

  setStatus("✅ Settings saved.");
}

// --- helpers ---
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resp);
    });
  });
}

async function withContentScript(fn) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab");

  await sendMessage(tab.id, { type: "PING" });
  return fn(tab.id);
}

// --- actions ---
async function detectFields() {
  try {
    setStatus("Detecting fields...");
    await withContentScript((tabId) => sendMessage(tabId, { type: "DETECT" }));
    setStatus("✅ Fields detected.");
  } catch (e) {
    setStatus("❌ " + e.message);
  }
}

async function fillFields() {
  try {
    const { apiKey } = await chrome.storage.local.get(["apiKey"]);
    if (!apiKey) return setStatus("❌ Save API key first.");

    setStatus("Filling fields...");
    const resp = await withContentScript((tabId) => sendMessage(tabId, { type: "FILL" }));
    setStatus(resp?.message || "Done.");
  } catch (e) {
    setStatus("❌ " + e.message);
  }
}

async function openProfilePage() {
  // profileUrl should be your FRONTEND base, not backend.
  // Set once later like:
  // chrome.storage.local.set({ profileUrl: "https://your-vercel-domain/profile" })
  const { profileUrl, apiKey } = await chrome.storage.local.get(["profileUrl", "apiKey"]);

  const base = (profileUrl || "http://localhost:3000/profile").trim();
  const key = (apiKey || "").trim();

  const url = key ? `${base}?key=${encodeURIComponent(key)}` : base;
  chrome.tabs.create({ url });
}

// --- wire up ---
document.getElementById("save").addEventListener("click", saveSettings);
document.getElementById("detect").addEventListener("click", detectFields);
document.getElementById("fill").addEventListener("click", fillFields);
document.getElementById("openProfile").addEventListener("click", openProfilePage);

loadSettings().then(() => setStatus("Popup loaded. Save settings once."));
