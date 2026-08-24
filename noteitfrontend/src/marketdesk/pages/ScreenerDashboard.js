import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Spinner, Form } from "react-bootstrap";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Header from "../../components/Header";
import AdminGate, { currentUser } from "../AdminGate";
import { getLatestEdition, buildEdition, errorMessage } from "../api";
import EditionHeader from "../components/EditionHeader";
import MarketBriefPanel from "../components/MarketBriefPanel";
import CompanyCard from "../components/CompanyCard";
import CalendarPanel from "../components/CalendarPanel";

const darkTheme = createTheme({ palette: { mode: "dark" } });

const SORTS = {
    materiality: (a, b) => (b.materiality - a.materiality) || Number(a.stale) - Number(b.stale),
    symbol: (a, b) => a.symbol.localeCompare(b.symbol),
    sentiment: (a, b) => String(a.sentiment).localeCompare(String(b.sentiment)),
};

function Screener() {
    const [edition, setEdition] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState("materiality");
    const [hideQuiet, setHideQuiet] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getLatestEdition();
            setEdition(data.edition);
            setSnapshots(data.snapshots || []);
        } catch (err) {
            // A fresh install has no edition yet; that is not an error worth shouting about.
            if (err?.response?.status === 404) setEdition(null);
            else setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const rebuild = async () => {
        setBusy(true);
        setError(null);
        try {
            await buildEdition({ force: true, deliver: false });
            await load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const bySnapshotId = new Map(snapshots.map((s) => [String(s._id), s]));
    const rows = (edition?.companyRefs || []).map((ref) => {
        const snapshot = bySnapshotId.get(String(ref.snapshotId));
        return { ...ref, bullets: snapshot?.bullets || [] };
    });

    const visible = rows
        .filter((r) => !(hideQuiet && r.stale))
        .sort(SORTS[sort]);

    const quietCount = rows.filter((r) => r.stale).length;

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 60px" }}>
            <EditionHeader
                edition={edition}
                busy={busy}
                onRebuild={rebuild}
                onRefresh={load}
            />

            {error && <Alert variant="danger">{error}</Alert>}

            {loading ? (
                <div style={{ textAlign: "center", padding: 50 }}>
                    <Spinner animation="border" size="sm" />
                </div>
            ) : !edition ? (
                <Alert variant="secondary">
                    No edition has been built yet. Use <strong>Rebuild now</strong> above, or wait for
                    the 8&nbsp;AM run. Check <Link to="/marketdesk/settings">settings</Link> first if
                    the watchlist is empty.
                </Alert>
            ) : (
                <>
                    <MarketBriefPanel edition={edition} />

                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 12, flexWrap: "wrap", marginBottom: 12,
                    }}>
                        <div style={{
                            fontSize: 11, textTransform: "uppercase",
                            letterSpacing: ".6px", color: "#7c8698",
                        }}>
                            Your companies · {visible.length} shown
                        </div>

                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                            {quietCount > 0 && (
                                <Form.Check
                                    type="switch"
                                    id="md-hide-quiet"
                                    label={`Hide quiet (${quietCount})`}
                                    checked={hideQuiet}
                                    onChange={(e) => setHideQuiet(e.target.checked)}
                                    style={{ fontSize: 12.5, color: "#95a1b1" }}
                                />
                            )}
                            {/* Form.Control as="select", not Form.Select: this app is on
                                react-bootstrap 1.x, where Form.Select does not exist and
                                resolves to undefined. */}
                            <Form.Control
                                as="select"
                                size="sm"
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                                style={{ width: 160, fontSize: 12.5 }}
                            >
                                <option value="materiality">Most material</option>
                                <option value="symbol">Symbol A-Z</option>
                                <option value="sentiment">Sentiment</option>
                            </Form.Control>
                        </div>
                    </div>

                    {visible.length
                        ? visible.map((row) => <CompanyCard key={row.symbol} row={row} />)
                        : <Alert variant="secondary">
                              Nothing material in this window.
                              {quietCount > 0 && " Turn off “Hide quiet” to see the full watchlist."}
                          </Alert>}

                    <CalendarPanel calendar={edition.calendar} />

                    <div style={{ marginTop: 24, fontSize: 12 }}>
                        <Link to="/marketdesk/settings" style={{ color: "#7c8698" }}>
                            MarketDesk settings →
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ScreenerDashboard() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Header user={currentUser()} />
            <AdminGate><Screener /></AdminGate>
        </ThemeProvider>
    );
}
