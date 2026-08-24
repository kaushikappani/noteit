import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Spinner, Nav } from "react-bootstrap";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Header from "../../components/Header";
import AdminGate, { currentUser } from "../AdminGate";
import { getCompany, errorMessage } from "../api";
import MaterialityBadge, { SentimentDot } from "../components/MaterialityBadge";
import CitationList from "../components/CitationList";
import FilingList from "../components/FilingList";
import CalendarPanel from "../components/CalendarPanel";

const darkTheme = createTheme({ palette: { mode: "dark" } });

const sectionTitle = {
    fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px",
    color: "#7c8698", margin: "26px 0 10px",
};

function Snapshot() {
    const { symbol } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState("analysis");

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await getCompany(symbol));
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return <div style={{ textAlign: "center", padding: 50 }}><Spinner animation="border" size="sm" /></div>;
    }
    if (error) return <Alert variant="danger">{error}</Alert>;

    const latest = data?.latest;

    return (
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 60px" }}>
            <Link to="/marketdesk" style={{ fontSize: 12.5, color: "#7c8698" }}>
                ← Back to screener
            </Link>

            <div style={{
                borderBottom: "2px solid #2a3441", paddingBottom: 13, margin: "12px 0 20px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 25, fontWeight: 700, color: "#f1f5f9" }}>
                        {data.symbol}
                    </span>
                    {latest && <MaterialityBadge score={latest.materialityTop} showLabel />}
                    {latest && <SentimentDot sentiment={latest.sentiment} />}
                </div>
                <div style={{ fontSize: 12, color: "#7c8698", marginTop: 4 }}>
                    {data.meta?.name || ""}
                    {data.meta?.sector ? ` · ${data.meta.sector}` : ""}
                    {latest?.asOf && ` · analysed ${new Date(latest.asOf).toLocaleString("en-IN", {
                        dateStyle: "medium", timeStyle: "short",
                    })}`}
                    {latest?.stale && " · carried forward, no new filings"}
                </div>
            </div>

            <Nav variant="tabs" activeKey={tab} onSelect={setTab} style={{ marginBottom: 18 }}>
                <Nav.Item><Nav.Link eventKey="analysis">Analysis</Nav.Link></Nav.Item>
                <Nav.Item>
                    <Nav.Link eventKey="filings">Filings ({data.filings?.length || 0})</Nav.Link>
                </Nav.Item>
                {data.history?.length > 0 && (
                    <Nav.Item><Nav.Link eventKey="history">History</Nav.Link></Nav.Item>
                )}
            </Nav>

            {tab === "analysis" && (!latest ? (
                <Alert variant="secondary">
                    No analysis yet for {data.symbol}. It appears once an edition covers a filing
                    from this company.
                </Alert>
            ) : (
                <>
                    <h2 style={{ fontSize: 18, lineHeight: 1.4, color: "#f1f5f9", fontWeight: 700 }}>
                        {latest.headline}
                    </h2>

                    {latest.bullets?.length > 0 && (
                        <ul style={{
                            margin: "14px 0 0 18px", padding: 0,
                            fontSize: 14, color: "#c3ccd8", lineHeight: 1.65,
                        }}>
                            {latest.bullets.map((b, i) => <li key={i} style={{ marginBottom: 6 }}>{b}</li>)}
                        </ul>
                    )}

                    {latest.newsDigest && (
                        <>
                            <div style={sectionTitle}>From the web</div>
                            <p style={{ fontSize: 14, color: "#c3ccd8", lineHeight: 1.62, margin: 0 }}>
                                {latest.newsDigest}
                            </p>
                        </>
                    )}

                    {latest.risks?.length > 0 && (
                        <>
                            <div style={sectionTitle}>Watch</div>
                            <ul style={{
                                margin: "0 0 0 18px", padding: 0,
                                fontSize: 13.5, color: "#a8b3c1", lineHeight: 1.6,
                            }}>
                                {latest.risks.map((r, i) => <li key={i} style={{ marginBottom: 5 }}>{r}</li>)}
                            </ul>
                        </>
                    )}

                    {latest.filingsDigest && (
                        <>
                            <div style={sectionTitle}>Filings in this window</div>
                            <div style={{ fontSize: 12.5, color: "#7c8698", lineHeight: 1.6 }}>
                                {latest.filingsDigest}
                            </div>
                        </>
                    )}

                    <CitationList citations={latest.citations} max={6} />
                    <CalendarPanel calendar={data.calendar} linkSymbols={false} />
                </>
            ))}

            {tab === "filings" && <FilingList filings={data.filings} />}

            {tab === "history" && (
                <div>
                    {data.history.map((h) => (
                        <div key={h._id} style={{
                            padding: "12px 0", borderBottom: "1px solid #202834",
                        }}>
                            <div style={{ fontSize: 11.5, color: "#6b7480", marginBottom: 4 }}>
                                {new Date(h.asOf).toLocaleString("en-IN", {
                                    dateStyle: "medium", timeStyle: "short",
                                })}
                                {h.stale && " · carried forward"}
                            </div>
                            <div style={{ fontSize: 13.5, color: "#dbe2ea", lineHeight: 1.45 }}>
                                {h.headline}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CompanySnapshot() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Header user={currentUser()} />
            <AdminGate><Snapshot /></AdminGate>
        </ThemeProvider>
    );
}
