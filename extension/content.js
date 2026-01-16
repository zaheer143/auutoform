// AutoForm Filler - content script (MV3)
// v1 hardened: React-safe setter + MutationObserver retries + basic <select> support

console.log("✅ AUTOFORM content.js v1-hardened", location.href);

// ---------- Settings ----------
async function getSettings() {
  const { apiBase, apiKey } = await chrome.storage.local.get(["apiBase", "apiKey"]);
  return {
    apiBase: (apiBase || "https://auutoform-production.up.railway.app").trim().replace(/\/$/, ""),
    apiKey: (apiKey || "").trim()
  };
}

// ---------- Profile fetch ----------
async function fetchProfileFromBackend() {
  const { apiBase, apiKey } = await getSettings();
  if (!apiKey) throw new Error("API key not set. Open extension and Save settings.");

  const res = await fetch(`${apiBase}/api/profile`, {
    method: "GET",
    headers: { "x-api-key": apiKey }
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Backend ${res.status}: ${text}`);

  return JSON.parse(text); // backend returns profile object directly
}

async function getProfile() {
  return await fetchProfileFromBackend();
}

// ---------- Form utilities ----------
function isFillable(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (!["input", "textarea", "select"].includes(tag)) return false;
  if (el.disabled) return false;

  if (tag === "input") {
    const type = (el.type || "").toLowerCase();
    if (type === "hidden") return false;
    if (type === "file") return false; // resume uploads: skip v1
  }

  // hidden via CSS
  const style = window.getComputedStyle(el);
  if (style?.display === "none" || style?.visibility === "hidden") return false;

  return true;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fieldText(el) {
  const attrs = [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute("aria-label"),
    el.getAttribute("autocomplete"),
    el.getAttribute("data-testid"),
    el.getAttribute("data-test"),
    el.getAttribute("data-qa")
  ]
    .filter(Boolean)
    .join(" ");

  let labelText = "";

  // label[for=id]
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l) labelText = (l.innerText || "").trim();
  }

  // wrapped label
  if (!labelText) {
    const wrapper = el.closest("label");
    if (wrapper) labelText = (wrapper.innerText || "").trim();
  }

  // previous label-ish node
  if (!labelText) {
    let prev = el.previousElementSibling;
    let hops = 0;
    while (prev && hops < 3) {
      const tag = prev.tagName?.toLowerCase();
      if (tag === "label") {
        labelText = (prev.innerText || "").trim();
        break;
      }
      // sometimes label text is in a <div>/<span> right before input
      if ((prev.innerText || "").trim().length > 0) {
        labelText = (prev.innerText || "").trim();
        break;
      }
      prev = prev.previousElementSibling;
      hops++;
    }
  }

  // aria-labelledby
  if (!labelText) {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const node = document.getElementById(labelledBy);
      if (node) labelText = (node.innerText || "").trim();
    }
  }

  return normalizeText(`${labelText} ${attrs}`);
}

// ---------- React-safe value setter ----------
function getNativeValueSetter(tag) {
  if (tag === "textarea") {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    return desc?.set;
  }
  // input
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  return desc?.set;
}

function dispatchInputEvents(el) {
  // These are the events most frameworks listen to
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setTextLikeValue(el, value) {
  const str = String(value ?? "");
  const tag = el.tagName.toLowerCase();

  const type = (el.type || "").toLowerCase();
  if (type === "checkbox" || type === "radio") return false;

  // If already same, no-op
  if (String(el.value ?? "") === str) return false;

  el.focus();

  const setter = getNativeValueSetter(tag);
  if (setter) {
    // React-controlled inputs require the native setter
    setter.call(el, str);
  } else {
    el.value = str;
  }

  dispatchInputEvents(el);
  el.blur();

  return true;
}

// ---------- Basic <select> support ----------
function bestSelectOption(selectEl, value) {
  const want = normalizeText(value);
  if (!want) return null;

  const opts = Array.from(selectEl.options || []);
  if (!opts.length) return null;

  // 1) exact value match
  let hit = opts.find((o) => normalizeText(o.value) === want);
  if (hit) return hit;

  // 2) exact label match
  hit = opts.find((o) => normalizeText(o.textContent) === want);
  if (hit) return hit;

  // 3) contains (useful for "30 days", "Immediate", etc.)
  hit = opts.find((o) => normalizeText(o.textContent).includes(want));
  if (hit) return hit;

  // 4) if numeric, try to match number inside option text
  const num = String(value).match(/\d+/)?.[0];
  if (num) {
    hit = opts.find((o) => normalizeText(o.textContent).includes(num));
    if (hit) return hit;
  }

  return null;
}

function setSelectValue(selectEl, value) {
  const opt = bestSelectOption(selectEl, value);
  if (!opt) return false;

  if (selectEl.value === opt.value) return false;

  selectEl.focus();
  selectEl.value = opt.value;
  dispatchInputEvents(selectEl);
  selectEl.blur();
  return true;
}

function setFieldValue(el, value) {
  const tag = el.tagName.toLowerCase();
  if (tag === "select") return setSelectValue(el, value);
  return setTextLikeValue(el, value);
}

// ---------- Mapping (matches your DB/profile page) ----------
function pickProfileValue(profile, el) {
  const t = fieldText(el);

  // Names
  if (t.includes("first") && t.includes("name")) return profile.first_name || "";
  if (t.includes("last") && t.includes("name")) return profile.last_name || "";
  if (t.includes("full name") || (t.includes("name") && !t.includes("user") && !t.includes("company")))
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();

  // Contact
  if (t.includes("email")) return profile.email || "";
  if (t.includes("phone") || t.includes("mobile") || t.includes("contact")) return profile.phone || "";

  // Location/company/role
  if (t.includes("city") || t.includes("location")) return profile.city || "";
  if (t.includes("company") || t.includes("organization")) return profile.current_company || "";
  if (t.includes("role") || t.includes("title") || t.includes("designation") || t.includes("position"))
    return profile.role_title || "";

  // Experience/notice
  if (t.includes("experience") && (t.includes("year") || t.includes("yrs") || t.includes("years")))
    return profile.total_experience_years ?? "";
  if (t.includes("notice")) return profile.notice_period_days ?? "";

  // Compensation
  if (t.includes("current") && (t.includes("ctc") || t.includes("salary") || t.includes("compensation")))
    return profile.current_ctc ?? "";
  if ((t.includes("expected") || t.includes("desired")) && (t.includes("ctc") || t.includes("salary") || t.includes("compensation")))
    return profile.expected_ctc ?? "";

  // Links
  if (t.includes("linkedin")) return profile.linkedin_url || "";
  if (t.includes("github")) return profile.github_url || "";
  if (t.includes("portfolio") || t.includes("website")) return profile.portfolio_url || "";

  return "";
}

function collectFillableFields() {
  return Array.from(document.querySelectorAll("input, textarea, select")).filter(isFillable);
}

function fillOnce(profile) {
  const fields = collectFillableFields();
  let filledNow = 0;

  for (const el of fields) {
    const val = pickProfileValue(profile, el);
    if (!val || String(val).trim().length === 0) continue;

    try {
      if (setFieldValue(el, val)) filledNow++;
    } catch {
      // swallow per-field errors; keep going
    }
  }

  return { filledNow, totalNow: fields.length };
}

// ---------- Robust fill with retries (dynamic forms) ----------
async function fillWithRetries(profile, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs ?? 6500);
  const settleMs = Number(opts.settleMs ?? 900);
  const maxPasses = Number(opts.maxPasses ?? 12);

  let filledTotal = 0;
  let totalSeen = 0;
  let passes = 0;

  let lastProgressAt = Date.now();
  let stopped = false;

  const runPass = () => {
    if (stopped) return;

    passes++;
    const { filledNow, totalNow } = fillOnce(profile);

    // Track totals (best-effort)
    totalSeen = Math.max(totalSeen, totalNow);

    if (filledNow > 0) {
      filledTotal += filledNow;
      lastProgressAt = Date.now();
    }
  };

  // Debounce pass scheduling during bursts of mutations
  let debounceTimer = null;
  const schedulePass = () => {
    if (stopped) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runPass, 120);
  };

  // Observe DOM changes to catch late-rendered fields (React/Workday/etc.)
  const observer = new MutationObserver(() => schedulePass());
  const body = document.body || document.documentElement;
  if (body) observer.observe(body, { childList: true, subtree: true });

  // Start immediately
  runPass();

  // Loop until settle or timeout
  while (!stopped) {
    await new Promise((r) => setTimeout(r, 200));

    const now = Date.now();
    const noProgressFor = now - lastProgressAt;

    // Stop conditions
    if (noProgressFor >= settleMs) stopped = true;
    if (now - (lastProgressAt - (settleMs * 0)) >= timeoutMs) stopped = true;
    if (passes >= maxPasses) stopped = true;
  }

  try { observer.disconnect(); } catch {}
  clearTimeout(debounceTimer);

  // Recompute totals one last time (so detect count matches latest DOM)
  const finalTotal = collectFillableFields().length;
  totalSeen = Math.max(totalSeen, finalTotal);

  return { filled: filledTotal, total: totalSeen, passes };
}

// ---------- Popup -> Content bridge ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "PING") {
        sendResponse({ message: "PONG" });
        return;
      }

      if (msg?.type === "DETECT") {
        const fields = collectFillableFields();
        sendResponse({ message: `Detected ${fields.length} fields` });
        return;
      }

      if (msg?.type === "FILL") {
        const profile = await getProfile();

        if (!profile) {
          sendResponse({ message: "❌ Profile missing. Create profile and Save." });
          return;
        }

        // Hard gate: require minimum identity fields
        const must = ["first_name", "last_name", "email", "phone"];
        const missing = must.filter((k) => !profile[k] || String(profile[k]).trim() === "");
        if (missing.length) {
          sendResponse({ message: `❌ Profile incomplete: ${missing.join(", ")}. Open /profile and Save.` });
          return;
        }

        const { filled, total, passes } = await fillWithRetries(profile, {
          timeoutMs: 6500,
          settleMs: 900,
          maxPasses: 12
        });

        sendResponse({ message: `✅ Filled ~${filled}/${total} fields (passes: ${passes})` });
        return;
      }

      sendResponse({ message: "Unknown action" });
    } catch (e) {
      sendResponse({ message: "❌ " + (e?.message || "unknown error") });
    }
  })();

  return true;
});
