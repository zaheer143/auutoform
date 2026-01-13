// AutoForm Filler - content script (MV3)

// Storage keys
const STORAGE_KEY = "autoform_profile"; // optional local fallback profile (dev/offline)

// ---------- Settings (from popup) ----------
async function getSettings() {
  const { apiBase, apiKey } = await chrome.storage.local.get(["apiBase", "apiKey"]);
  return {
    apiBase: (apiBase || "http://localhost:8080").trim(),
    apiKey: (apiKey || "").trim()
  };
}

// ---------- Profile fetch ----------
async function fetchProfileFromBackend() {
  const { apiBase, apiKey } = await getSettings();

  if (!apiKey) {
    throw new Error("API key not set. Open extension and Save settings.");
  }

  const res = await fetch(`${apiBase}/api/extension/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Backend ${res.status}: ${text}`);
  }

  const data = JSON.parse(text);
  return data.profile;
}

async function getProfile() {
  // 1) Try backend first (real product)
  try {
    const profile = await fetchProfileFromBackend();
    if (profile) {
      console.log("[AutoForm] Using BACKEND profile");
      return profile;
    }
  } catch (e) {
    console.log("[AutoForm] Backend profile fetch failed, using local storage", e);
  }

  // 2) Fallback: local storage (dev/offline)
  console.log("[AutoForm] Using LOCAL profile");
  const res = await chrome.storage.local.get([STORAGE_KEY]);
  return res[STORAGE_KEY] || null;
}

// ---------- Form utilities ----------
function isFillable(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (!["input", "textarea", "select"].includes(tag)) return false;
  if (el.disabled) return false;
  if (tag === "input" && (el.type || "").toLowerCase() === "hidden") return false;
  return true;
}

function fieldText(el) {
  const attrs = [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute("aria-label"),
    el.getAttribute("autocomplete")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 1) label[for=id]
  let labelText = "";
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l) labelText = (l.innerText || "").trim();
  }

  // 2) wrapped by label
  if (!labelText) {
    const wrapper = el.closest("label");
    if (wrapper) labelText = (wrapper.innerText || "").trim();
  }

  // 3) previous sibling label (common pattern)
  if (!labelText) {
    let prev = el.previousElementSibling;
    while (prev && prev.tagName && prev.tagName.toLowerCase() !== "label") {
      prev = prev.previousElementSibling;
    }
    if (prev && prev.tagName.toLowerCase() === "label") {
      labelText = (prev.innerText || "").trim();
    }
  }

  return (labelText + " " + attrs).toLowerCase();
}

function setInputValue(el, value) {
  const str = String(value ?? "");
  const tag = el.tagName.toLowerCase();

  if (tag === "select") return false;

  if (el.value === str) return false;

  el.focus();
  el.value = str;

  // trigger frameworks (React/Vue/etc.)
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();

  return true;
}

// Minimal filler (we’ll upgrade mapping later)
function fillFormBasic(profile) {
  const fields = Array.from(document.querySelectorAll("input, textarea, select")).filter(isFillable);
  let filled = 0;

  for (const el of fields) {
    const t = fieldText(el);

    let val = null;

    if (t.includes("full name") || (t.includes("name") && !t.includes("user") && !t.includes("company")))
      val = profile.fullName;
    else if (t.includes("email")) val = profile.email;
    else if (t.includes("phone") || t.includes("mobile") || t.includes("contact")) val = profile.phone;
    else if (t.includes("address")) val = profile.address;
    else if (t.includes("city")) val = profile.city;
    else if (t.includes("state")) val = profile.state;
    else if (t.includes("country")) val = profile.country;
    else if (t.includes("linkedin")) val = profile.linkedin;
    else if (t.includes("github")) val = profile.github;
    else if (t.includes("website") || t.includes("portfolio")) val = profile.website;
    else if (t.includes("experience") || t.includes("years")) val = profile.yearsExp;
    else if (t.includes("notice")) val = profile.noticePeriod;
    else if (t.includes("summary") || t.includes("about")) val = profile.summary;

    if (val == null) continue;
    if (String(val).trim().length === 0) continue;

    if (setInputValue(el, val)) filled++;
  }

  return filled;
}

// ---------- Popup -> Content bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "DETECT") {
        const fields = Array.from(document.querySelectorAll("input, textarea, select")).filter(isFillable);
        console.log("[AutoForm] DETECT ->", fields.length, "fields");
        sendResponse({ message: `Detected ${fields.length} fields` });
        return;
      }

      if (msg?.type === "FILL") {
        console.log("[AutoForm] FILL clicked");

        let profile = null;
try {
  profile = await fetchProfileFromBackend(); // force backend to expose real errors
  console.log("[AutoForm] Using BACKEND profile");
} catch (e) {
  console.log("[AutoForm] Backend fetch failed:", e);
  sendResponse({ message: "Backend fetch failed: " + (e?.message || "unknown") });
  return;
}

if (!profile) {
  sendResponse({ message: "Backend returned empty profile (null)." });
  return;
}

        const filled = fillFormBasic(profile);
        console.log("[AutoForm] Filled", filled, "fields");
        sendResponse({ message: `Filled ${filled} fields` });
        return;
      }

      sendResponse({ message: "Unknown action" });
    } catch (e) {
      console.log("[AutoForm] Error:", e);
      sendResponse({ message: "Error: " + (e?.message || "unknown") });
    }
  })();

  return true; // async response
});
