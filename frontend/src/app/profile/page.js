"use client";

import { useEffect, useMemo, useState } from "react";

const API_DEFAULT = "https://auutoform-production.up.railway.app";

const REQUIRED = [
  { k: "first_name", label: "First name" },
  { k: "last_name", label: "Last name" },
  { k: "email", label: "Email" },
  { k: "phone", label: "Phone (with country code)" },
  { k: "city", label: "Current city" },
  { k: "current_company", label: "Current company" },
  { k: "role_title", label: "Current role / title" },
  { k: "total_experience_years", label: "Total experience (years)" },
  { k: "notice_period_days", label: "Notice period (days)" },
  { k: "current_ctc", label: "Current CTC" },
  { k: "expected_ctc", label: "Expected CTC" },
  { k: "linkedin_url", label: "LinkedIn URL" }
];

const ADVANCED = [
  { k: "github_url", label: "GitHub URL" },
  { k: "portfolio_url", label: "Portfolio URL" },
  { k: "education", label: "Education (one line)" },
  { k: "work_authorization", label: "Work authorization" },
  { k: "preferred_locations", label: "Preferred locations" },
  { k: "relocation", label: "Relocation (true/false)" }
];

function filled(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

export default function ProfilePage() {
  const [apiBase, setApiBase] = useState(API_DEFAULT);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("Paste API key → Load → Edit → Save.");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ✅ Prefill API key from URL query param: /profile?key=...
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const k = u.searchParams.get("key");
      if (k && k.trim()) setApiKey(k.trim());
    } catch {}
  }, []);

  const missing = useMemo(() => {
    if (!profile) return REQUIRED.map((x) => x.k);
    return REQUIRED.map((x) => x.k).filter((k) => !filled(profile?.[k]));
  }, [profile]);

  const complete = profile && missing.length === 0;
  const base = apiBase.replace(/\/$/, "");

  async function loadProfile() {
    const key = apiKey.trim();
    if (!key) return setStatus("❌ API key required.");
    setLoading(true);
    setStatus("Loading profile...");
    try {
      const res = await fetch(`${base}/api/profile`, {
        headers: { "x-api-key": key }
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status} ${t}`);
      }
      const data = await res.json();
      setProfile(data || {});
      setStatus("✅ Loaded. Fill required fields and click Save.");
    } catch (e) {
      setProfile(null);
      setStatus("❌ Load failed: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    const key = apiKey.trim();
    if (!key) return setStatus("❌ API key required.");
    if (!profile) return setStatus("❌ Load profile first.");
    setLoading(true);
    setStatus("Saving profile...");
    try {
      const res = await fetch(`${base}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key
        },
        body: JSON.stringify(profile)
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status} ${t}`);
      }
      const data = await res.json();
      setProfile(data || profile);
      setStatus(missing.length === 0 ? "✅ Saved. Profile COMPLETE." : "✅ Saved. Profile still incomplete.");
    } catch (e) {
      setStatus("❌ Save failed: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  function setField(k, v) {
    setProfile((p) => ({ ...(p || {}), [k]: v }));
  }

  return (
    <div style={styles.bg}>
      <div style={styles.wrap}>
        <h1 style={styles.h1}>AutoForm Profile</h1>
        <p style={styles.p}>
          Fill will be blocked until Required fields are complete.
        </p>

        <div style={styles.card}>
          <div style={styles.grid2}>
            <Field label="Backend URL" value={apiBase} onChange={setApiBase} placeholder={API_DEFAULT} />
            <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="paste your x-api-key" />
          </div>

          <div style={styles.row}>
            <Btn onClick={loadProfile} disabled={loading}>Load</Btn>
            <Btn onClick={saveProfile} disabled={loading || !profile}>Save</Btn>

            <div style={{ marginLeft: "auto" }}>
              {profile ? (
                complete ? <Badge ok>PROFILE COMPLETE</Badge> : <Badge>INCOMPLETE ({missing.length} missing)</Badge>
              ) : null}
            </div>
          </div>

          <div style={styles.dashed}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Status</div>
            <div style={{ opacity: 0.9 }}>{status}</div>
          </div>
        </div>

        {profile && (
          <>
            <Section title="Required">
              <div style={styles.grid2}>
                {REQUIRED.map((f) => (
                  <Field
                    key={f.k}
                    label={f.label}
                    value={profile?.[f.k] ?? ""}
                    onChange={(v) => setField(f.k, v)}
                  />
                ))}
              </div>

              {!complete && (
                <div style={{ marginTop: 10, opacity: 0.9 }}>
                  Missing: <span style={{ opacity: 0.8 }}>{missing.join(", ")}</span>
                </div>
              )}
            </Section>

            <Section title="Advanced (optional)">
              <div style={styles.row}>
                <Btn onClick={() => setShowAdvanced((s) => !s)}>
                  {showAdvanced ? "Hide Advanced" : "Show Advanced"}
                </Btn>
                <span style={{ opacity: 0.8 }}>Only fill these if needed.</span>
              </div>

              {showAdvanced && (
                <div style={styles.grid2}>
                  {ADVANCED.map((f) => (
                    <Field
                      key={f.k}
                      label={f.label}
                      value={profile?.[f.k] ?? ""}
                      onChange={(v) => setField(f.k, f.k === "relocation" ? (v === "true") : v)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block" }}>
      <div style={styles.label}>{label}</div>
      <input
        value={value}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </label>
  );
}

function Btn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles.btn, opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

function Badge({ children, ok }) {
  return (
    <span style={{ ...styles.badge, background: ok ? "rgba(0,255,180,0.18)" : "rgba(255,200,0,0.16)" }}>
      {children}
    </span>
  );
}

const styles = {
  bg: {
    minHeight: "100vh",
    padding: 32,
    color: "#eaf2ff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "linear-gradient(135deg, #0b1220 0%, #0f2a4a 45%, #132a3a 100%)"
  },
  wrap: { maxWidth: 980, margin: "0 auto" },
  h1: { fontSize: 34, margin: "0 0 10px" },
  p: { opacity: 0.85, marginTop: 0 },
  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 18,
    padding: 18,
    backdropFilter: "blur(10px)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)"
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  row: { display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" },
  dashed: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.15)"
  },
  section: {
    marginTop: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 18,
    padding: 18
  },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 12 },
  label: { fontWeight: 800, marginBottom: 6, opacity: 0.92 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    outline: "none",
    background: "rgba(0,0,0,0.18)",
    color: "#eaf2ff"
  },
  btn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(135deg, #2f6bff, #00d4ff)",
    color: "#07101b",
    fontWeight: 900,
    cursor: "pointer"
  },
  badge: {
    padding: "8px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.18)"
  }
};
