import axios from "axios";
import React, { useState, useEffect } from "react";

const McpLogin = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [autoChecking, setAutoChecking] = useState(true); // silently check on mount
    const [autoUser, setAutoUser] = useState(null);

    // On load: silently try to use the existing browser session
    useEffect(() => {
        if (!code) { setAutoChecking(false); return; }

        const tryAutoLogin = async () => {
            try {
                const config = { withCredentials: true, headers: { "Content-Type": "application/json" } };
                const { data } = await axios.post("/api/users/mcp/auto-exchange", { code }, config);
                // Success — existing cookie was valid
                setAutoUser({ name: data.name, email: data.email });
                setSuccess(true);
            } catch {
                // Not logged in or cookie expired — show the login form
            } finally {
                setAutoChecking(false);
            }
        };

        tryAutoLogin();
    }, [code]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (!code) throw new Error("Missing auth code in URL. Please ask the AI to try again.");

            const config = { withCredentials: true, headers: { "Content-Type": "application/json" } };
            await axios.post("/api/users/login", { email, password }, config);

            // The login above set the httpOnly cookie. Deposit from that,
            // rather than asking the backend to hand the raw token to this page
            // — a token this page never sees is one an injected script on it
            // cannot steal, and the auth code alone is useless without a login.
            await axios.post("/api/users/mcp/auto-exchange", { code }, config);

            setSuccess(true);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Something went wrong.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Show spinner while silently checking existing session
    if (autoChecking) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🔄</div>
                    <h2 style={styles.title}>Checking session…</h2>
                    <p style={styles.subtitle}>Just a moment while we check if you're already logged in.</p>
                </div>
            </div>
        );
    }

    if (!code) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.icon}>⚠️</div>
                    <h2 style={styles.title}>Invalid Link</h2>
                    <p style={styles.subtitle}>No auth code found in URL. Please ask the AI to generate a new login link.</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.successIcon}>✅</div>
                    <h2 style={styles.title}>You're all set!</h2>
                    <p style={styles.subtitle}>
                        {autoUser
                            ? <>Authorized as <strong>{autoUser.name}</strong> ({autoUser.email}).<br /><br /></>
                            : null
                        }
                        The AI assistant is now connected to your NoteIt account.
                    </p>
                    <p style={{ ...styles.subtitle, marginTop: "8px", fontSize: "0.85rem", opacity: 0.6 }}>
                        You can close this tab.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                {/* Logo / Brand */}
                <div style={styles.brand}>
                    <span style={styles.brandIcon}>🤖</span>
                    <h1 style={styles.brandName}>NoteIt</h1>
                </div>

                <h2 style={styles.title}>Login for AI Assistant</h2>
                <p style={styles.subtitle}>
                    Your AI assistant wants to access NoteIt on your behalf.
                    <br />
                    Log in below to authorize it.
                </p>

                <div style={styles.codeBadge}>
                    <span style={styles.codeLabel}>Session Code</span>
                    <span style={styles.codeValue}>{code.slice(0, 8)}…</span>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={styles.input}
                        />
                    </div>

                    {error && (
                        <div style={styles.errorBox}>
                            ⛔ {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={loading ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}>
                        {loading ? (
                            <span style={styles.spinner} />
                        ) : (
                            "Authorize AI Assistant →"
                        )}
                    </button>
                </form>

                <p style={styles.footer}>
                    This login is only valid for 5 minutes and cannot be reused.
                </p>
            </div>
        </div>
    );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = {
    page: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Poppins', 'Segoe UI', sans-serif",
        padding: "24px",
    },
    card: {
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        padding: "48px 40px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        color: "#fff",
        textAlign: "center",
    },
    brand: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        marginBottom: "24px",
    },
    brandIcon: {
        fontSize: "2rem",
    },
    brandName: {
        fontSize: "2rem",
        fontWeight: "700",
        margin: 0,
        background: "linear-gradient(90deg, #a78bfa, #60a5fa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
    },
    title: {
        fontSize: "1.4rem",
        fontWeight: "600",
        margin: "0 0 8px 0",
        color: "#fff",
    },
    subtitle: {
        fontSize: "0.9rem",
        color: "rgba(255,255,255,0.6)",
        margin: "0 0 20px 0",
        lineHeight: "1.6",
    },
    codeBadge: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(167,139,250,0.15)",
        border: "1px solid rgba(167,139,250,0.3)",
        borderRadius: "8px",
        padding: "6px 14px",
        marginBottom: "28px",
        fontSize: "0.82rem",
    },
    codeLabel: {
        color: "rgba(255,255,255,0.5)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontSize: "0.7rem",
    },
    codeValue: {
        color: "#a78bfa",
        fontWeight: "600",
        fontFamily: "monospace",
    },
    form: {
        textAlign: "left",
    },
    inputGroup: {
        marginBottom: "16px",
    },
    label: {
        display: "block",
        fontSize: "0.82rem",
        color: "rgba(255,255,255,0.6)",
        marginBottom: "6px",
        fontWeight: "500",
    },
    input: {
        width: "100%",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "10px",
        color: "#fff",
        fontSize: "0.95rem",
        outline: "none",
        boxSizing: "border-box",
        transition: "border 0.2s",
    },
    errorBox: {
        background: "rgba(239,68,68,0.15)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "16px",
        fontSize: "0.85rem",
        color: "#fca5a5",
    },
    btn: {
        width: "100%",
        padding: "13px",
        marginTop: "8px",
        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
        color: "#fff",
        border: "none",
        borderRadius: "12px",
        fontSize: "1rem",
        fontWeight: "600",
        cursor: "pointer",
        letterSpacing: "0.3px",
        transition: "opacity 0.2s, transform 0.1s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "48px",
    },
    btnDisabled: {
        opacity: 0.6,
        cursor: "not-allowed",
    },
    spinner: {
        width: "20px",
        height: "20px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTop: "2px solid #fff",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        display: "inline-block",
    },
    successIcon: {
        fontSize: "3rem",
        marginBottom: "16px",
    },
    icon: {
        fontSize: "3rem",
        marginBottom: "16px",
    },
    footer: {
        marginTop: "24px",
        fontSize: "0.78rem",
        color: "rgba(255,255,255,0.3)",
        textAlign: "center",
    },
};

// Add spinner CSS keyframes
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);

export default McpLogin;
