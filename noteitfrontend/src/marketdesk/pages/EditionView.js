import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Spinner, Button } from "react-bootstrap";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Header from "../../components/Header";
import AdminGate, { currentUser } from "../AdminGate";
import { getEdition, deliverEdition, errorMessage } from "../api";
import EditionHeader from "../components/EditionHeader";
import MarketBriefPanel from "../components/MarketBriefPanel";
import CompanyCard from "../components/CompanyCard";
import CalendarPanel from "../components/CalendarPanel";

const darkTheme = createTheme({ palette: { mode: "dark" } });

/** One specific edition — what the email link and the archive point at. */
function Edition() {
    const { date, slot } = useParams();
    const [edition, setEdition] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [delivery, setDelivery] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getEdition(date, slot);
            setEdition(data.edition);
            setSnapshots(data.snapshots || []);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [date, slot]);

    useEffect(() => { load(); }, [load]);

    const resend = async () => {
        setBusy(true);
        try {
            setDelivery(await deliverEdition(edition._id, { force: true }));
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div style={{ textAlign: "center", padding: 50 }}><Spinner animation="border" size="sm" /></div>;
    }
    if (error) return <Alert variant="danger">{error}</Alert>;

    const bySnapshotId = new Map(snapshots.map((s) => [String(s._id), s]));
    const rows = (edition.companyRefs || [])
        .filter((r) => !r.stale)
        .map((ref) => ({ ...ref, bullets: bySnapshotId.get(String(ref.snapshotId))?.bullets || [] }));

    const sent = edition.delivery || {};

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 60px" }}>
            <Link to="/marketdesk" style={{ fontSize: 12.5, color: "#7c8698" }}>← Screener</Link>

            <div style={{ marginTop: 12 }}>
                <EditionHeader edition={edition} onRefresh={load} />
            </div>

            <div style={{
                display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
                fontSize: 11.5, color: "#7c8698", marginBottom: 20,
            }}>
                {["email", "telegram", "push"].map((channel) => (
                    <span key={channel}>
                        {channel}: {sent[channel]?.sentAt
                            ? new Date(sent[channel].sentAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit",
                            })
                            : sent[channel]?.error ? "failed" : "not sent"}
                    </span>
                ))}
                <Button size="sm" variant="outline-secondary" onClick={resend} disabled={busy}>
                    {busy ? "Sending…" : "Re-send"}
                </Button>
                <a
                    href={`/api/marketdesk/editions/${edition.date}/${edition.slot}/html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#8fa6c4" }}
                >
                    View as email ↗
                </a>
            </div>

            {delivery && (
                <Alert variant="secondary" style={{ fontSize: 12.5 }}>
                    {Object.entries(delivery).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </Alert>
            )}

            <MarketBriefPanel edition={edition} />

            {rows.length > 0 && (
                <div style={{
                    fontSize: 11, textTransform: "uppercase",
                    letterSpacing: ".6px", color: "#7c8698", marginBottom: 12,
                }}>
                    Companies with news · {rows.length}
                </div>
            )}
            {rows.map((row) => <CompanyCard key={row.symbol} row={row} />)}

            <CalendarPanel calendar={edition.calendar} />
        </div>
    );
}

export default function EditionView() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Header user={currentUser()} />
            <AdminGate><Edition /></AdminGate>
        </ThemeProvider>
    );
}
