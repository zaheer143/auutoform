"use client";

import { useEffect, useState } from "react";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function baseUrl(url) {
  return (url || "").trim().replace(/\/$/, "");
}

export default function ApiKeyPage() {
  const [backendUrl, setBackendUrl] = useState("http://localhost:8080");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState({ type: "idle", msg: "" });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRotated, setLastRotated] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("autoform_last_rotated");
      if (saved) setLastRotated(saved);
    } catch {}
    try {
      const savedBackend = localStorage.getItem("autoform_backend_url");
      if (savedBackend) setBackendUrl(savedBackend);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("autoform_backend_url", backendUrl);
    } catch {}
  }, [backendUrl]);

  function setRotatedNow() {
    const now = new Date();
    const display = now.toLocaleString();
    setLastRotated(display);
    try {
      localStorage.setItem("autoform_last_rotated", display);
    } catch {}
  }

  // ✅ Create NEW key (first-time user)
  async function createKey() {
    setCopied(false);
    setStatus({ type: "idle", msg: "" });

    if (!backendUrl || !backendUrl.startsWith("http")) {
      setStatus({ type: "error", msg: "Enter a valid backend URL (must start with http)." });
      return;
    }

    const base = baseUrl(backendUrl);

    try {
      setLoading(true);

      const res = await fetch(`${base}/api/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const key = data?.apiKey || "";

      if (!key) throw new Error("API key not found in response.");

      setApiKey(key);
      setRotatedNow();
      setStatus({
        type: "success",
        msg: "API key created. Copy it and paste into the Chrome extension. Also use it on /profile to save your details."
      });
    } catch (e) {
      setStatus({
        type: "error",
        msg: e?.message || "Failed to create API key. Check backend URL and server logs."
      });
      setApiKey("");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Rotate key (existing user) — requires current apiKey
  async function rotateKey() {
    setCopied(false);
    setStatus({ type: "idle", msg: "" });

    if (!backendUrl || !backendUrl.startsWith("http")) {
      setStatus({ type: "error", msg: "Enter a valid backend URL (must start with http)." });
      return;
    }

    const base = baseUrl(backendUrl);

    if (!apiKey || apiKey.trim().length < 10) {
      setStatus({
        type: "error",
        msg: "No current API key found. Click 'Create API Key' first (or paste your existing key), then Rotate."
      });
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${base}/api/key/rotate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim()
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const newKey = data?.apiKey || "";

      if (!newKey) throw new Error("New API key not found in response.");

      setApiKey(newKey);
      setRotatedNow();
      setStatus({
        type: "success",
        msg: "API key rotated. Old key is disabled. Copy the new key into the Chrome extension."
      });
    } catch (e) {
      setStatus({
        type: "error",
        msg: e?.message || "Failed to rotate API key. Check backend URL and server logs."
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setStatus({ type: "error", msg: "Copy failed. Please manually select and copy the key." });
    }
  }

  async function payAndActivate() {
    if (!apiKey) {
      alert("Generate API key first");
      return;
    }

    if (!backendUrl || !backendUrl.startsWith("http")) {
      alert("Enter a valid backend URL first");
      return;
    }

    const ok = await loadRazorpay();
    if (!ok) {
      alert("Razorpay SDK failed to load");
      return;
    }

    const base = baseUrl(backendUrl);

    // 1) Create order
    let data;
    try {
      const res = await fetch(`${base}/api/billing/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      data = await res.json();
    } catch (e) {
      alert("Failed to reach backend. Is backend running?");
      return;
    }

    if (!data?.ok) {
      alert(data?.error || "Failed to create order");
      return;
    }

    // 2) Open Razorpay
    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "AutoForm Filler",
      description: "30-day API key activation",
      order_id: data.orderId,
      handler: async function (response) {
        // 3) Verify payment
        try {
          const vr = await fetch(`${base}/api/billing/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const vd = await vr.json();
          if (vd?.ok) {
            alert("Payment successful. API key activated.");
          } else {
            alert(vd?.error || "Payment verification failed");
          }
        } catch {
          alert("Payment done but verification call failed. Check backend logs.");
        }
      },
      theme: { color: "#1a73e8" }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <a href="/" style={styles.backLink}>
            ← Home
          </a>
          <span style={styles.logo}>AutoForm</span>
        </div>

        <h1 style={styles.title}>Connect your extension</h1>
        <p style={styles.subtitle}>
          Create an API key (first time), paste into extension. Rotate later if needed.
        </p>

        <div style={styles.fieldBlock}>
          <label style={styles.label}>Backend URL</label>
          <input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:8080"
            style={styles.input}
          />
          <div style={styles.hint}>
            Local example: <code>http://localhost:8080</code> • Production: your Railway backend URL
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={createKey} disabled={loading} style={styles.primaryButton}>
            {loading ? "Working..." : "Create API Key"}
          </button>
          <button onClick={rotateKey} disabled={loading} style={styles.secondaryAction}>
            {loading ? "Working..." : "Rotate API Key"}
          </button>
        </div>

        {lastRotated ? <div style={styles.lastRotated}>Last action: {lastRotated}</div> : null}

        {status.msg ? (
          <div
            style={{
              ...styles.alert,
              ...(status.type === "error"
                ? styles.alertError
                : status.type === "success"
                ? styles.alertSuccess
                : {})
            }}
          >
            {status.msg}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <label style={styles.label}>Your API Key</label>

          <div style={styles.keyBox}>
            <div style={styles.keyText}>{apiKey || "—"}</div>
            <button
              onClick={copyKey}
              disabled={!apiKey}
              style={{ ...styles.secondaryButton, ...(apiKey ? {} : styles.disabledBtn) }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <button
            onClick={payAndActivate}
            disabled={!apiKey}
            style={{ ...styles.payButton, ...(!apiKey ? styles.disabledBtn : {}) }}
          >
            Pay ₹199 & Activate (30 days)
          </button>

          <div style={styles.steps}>
            <div style={styles.stepTitle}>Next</div>
            <ol style={styles.ol}>
              <li>Copy API key</li>
              <li>Paste into Chrome extension → Save</li>
              <li>Open /profile → Load → fill required → Save</li>
              <li>Go to a form → Detect → Fill</li>
            </ol>
          </div>
        </div>

        <p style={styles.footerNote}>Secure • One key per user • Rotate anytime</p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f7f9",
    padding: 16,
    fontFamily: "Inter, system-ui, Arial"
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 12,
    padding: "28px 26px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  backLink: { color: "#555", textDecoration: "none", fontSize: 13 },
  logo: { fontSize: 16, fontWeight: 700, color: "#1a73e8", letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: 750, margin: "10px 0 6px", color: "#111" },
  subtitle: { fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 18 },
  fieldBlock: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, fontWeight: 650, color: "#333", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #d7dde3",
    borderRadius: 10,
    outline: "none",
    fontSize: 14
  },
  hint: { marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.5 },
  primaryButton: {
    flex: 1,
    padding: "12px 14px",
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 650,
    cursor: "pointer"
  },
  secondaryAction: {
    flex: 1,
    padding: "12px 14px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 750,
    cursor: "pointer"
  },
  payButton: {
    width: "100%",
    marginTop: 12,
    padding: "12px 14px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 750,
    cursor: "pointer"
  },
  lastRotated: { marginTop: 10, fontSize: 12, color: "#6b7280" },
  alert: { marginTop: 12, padding: "10px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.45 },
  alertError: { background: "#fff5f5", border: "1px solid #ffd0d0", color: "#a30000" },
  alertSuccess: { background: "#f1fbf4", border: "1px solid #bfe9c9", color: "#116329" },
  keyBox: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 10,
    border: "1px solid #d7dde3",
    borderRadius: 10,
    background: "#fafbfc"
  },
  keyText: {
    flex: 1,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 12,
    color: "#111",
    wordBreak: "break-all",
    minHeight: 18
  },
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #d7dde3",
    background: "#fff",
    fontSize: 13,
    fontWeight: 650,
    cursor: "pointer"
  },
  disabledBtn: { opacity: 0.55, cursor: "not-allowed" },
  steps: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e6ebf0",
    background: "#ffffff"
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#111",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  ol: { margin: 0, paddingLeft: 18, color: "#444", fontSize: 13, lineHeight: 1.6 },
  footerNote: { marginTop: 14, fontSize: 12, color: "#777", textAlign: "center" }
};
