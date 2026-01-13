export default function Home() {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <span style={styles.logo}>AutoForm</span>
          </div>
  
          <h1 style={styles.title}>
            Auto-fill forms in seconds
          </h1>
  
          <p style={styles.subtitle}>
            Save your profile once. Instantly fill job applications and contact forms using the Chrome extension.
          </p>
  
          <a href="/api-key" style={styles.primaryButton}>
            Generate API Key
          </a>
  
          <p style={styles.note}>
            Secure • No OAuth • One-time setup
          </p>
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
      fontFamily: "Inter, system-ui, Arial",
    },
    card: {
      width: "100%",
      maxWidth: 420,
      background: "#fff",
      borderRadius: 12,
      padding: "32px 28px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
      textAlign: "center",
    },
    logoRow: {
      marginBottom: 12,
    },
    logo: {
      fontSize: 18,
      fontWeight: 700,
      color: "#1a73e8", // DocuSign blue vibe
      letterSpacing: 0.3,
    },
    title: {
      fontSize: 26,
      fontWeight: 700,
      margin: "16px 0 8px",
      color: "#111",
    },
    subtitle: {
      fontSize: 15,
      color: "#555",
      lineHeight: 1.6,
      marginBottom: 24,
    },
    primaryButton: {
      display: "block",
      width: "100%",
      padding: "12px 16px",
      background: "#1a73e8",
      color: "#fff",
      borderRadius: 8,
      fontSize: 15,
      fontWeight: 600,
      textDecoration: "none",
    },
    note: {
      marginTop: 16,
      fontSize: 12,
      color: "#777",
    },
  };
  