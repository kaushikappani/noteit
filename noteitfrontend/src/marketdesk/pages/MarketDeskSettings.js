import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Spinner, Button, Form, Row, Col, Badge } from "react-bootstrap";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Header from "../../components/Header";
import AdminGate, { currentUser } from "../AdminGate";
import {
    getConfig, putConfig, getWatchlist, putWatchlist, seedWatchlist,
    getStatus, runIngest, errorMessage,
} from "../api";

const darkTheme = createTheme({ palette: { mode: "dark" } });

const card = {
    padding: 16, borderRadius: 7, background: "#12171e",
    border: "1px solid #202834", marginBottom: 18,
};
const cardTitle = {
    fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px",
    color: "#7c8698", marginBottom: 12,
};

function StatusCard({ status, onIngest, busy }) {
    if (!status) return null;
    return (
        <div style={card}>
            <div style={cardTitle}>System</div>
            <Row style={{ fontSize: 13, color: "#c3ccd8" }}>
                <Col xs={6} md={3}>Provider<br /><strong>{status.provider}</strong></Col>
                <Col xs={6} md={3}>Search<br /><strong>{status.searchProvider}</strong></Col>
                <Col xs={6} md={3}>Watchlist<br /><strong>{status.watchlistCount}</strong></Col>
                <Col xs={6} md={3}>Filings<br /><strong>{status.filings}</strong></Col>
            </Row>
            <div style={{ marginTop: 12, fontSize: 12.5, color: "#95a1b1" }}>
                {status.pendingAnalysis > 0 && <>Pending analysis: {status.pendingAnalysis} · </>}
                Editions built: {status.editions}
                {status.latestEdition && <> · latest {status.latestEdition.date} {status.latestEdition.slot}</>}
            </div>

            {!status.mailerConfigured && (
                <Alert variant="warning" style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5 }}>
                    <strong>MAILER_API_KEY is not set.</strong> Email delivery will fail — the shared
                    mailer posts to an external service that needs this key. Every other channel works.
                </Alert>
            )}

            <Button
                size="sm"
                variant="outline-secondary"
                onClick={onIngest}
                disabled={busy}
                style={{ marginTop: 12 }}
            >
                {busy ? "Running…" : "Run ingest now"}
            </Button>
        </div>
    );
}

function Settings() {
    const [config, setConfig] = useState(null);
    const [watchlist, setWatchlist] = useState([]);
    const [status, setStatus] = useState(null);
    const [symbolText, setSymbolText] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [cfg, wl, st] = await Promise.all([getConfig(), getWatchlist(), getStatus()]);
            setConfig(cfg);
            setWatchlist(wl.symbols || []);
            setSymbolText((wl.symbols || []).map((s) => s.symbol).join(", "));
            setStatus(st);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const act = async (label, fn) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await fn();
            setNotice(label);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const saveConfig = (patch) => act("Settings saved.", async () => {
        setConfig(await putConfig(patch));
    });

    const saveWatchlist = () => act("Watchlist saved.", async () => {
        // Accept commas, spaces or newlines — pasting from anywhere should work.
        const symbols = symbolText
            .split(/[\s,]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        const result = await putWatchlist(symbols);
        setWatchlist(result.symbols);
        setSymbolText(result.symbols.map((s) => s.symbol).join(", "));
    });

    const seed = () => act("Watchlist topped up from your portfolio.", async () => {
        const result = await seedWatchlist();
        setWatchlist(result.symbols);
        setSymbolText(result.symbols.map((s) => s.symbol).join(", "));
    });

    if (loading) {
        return <div style={{ textAlign: "center", padding: 50 }}><Spinner animation="border" size="sm" /></div>;
    }

    const setEnabled = (channel, value) =>
        saveConfig({ enabled: { ...config.enabled, [channel]: value } });

    return (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 16px 60px" }}>
            <Link to="/marketdesk" style={{ fontSize: 12.5, color: "#7c8698" }}>← Screener</Link>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "12px 0 20px" }}>
                MarketDesk settings
            </h1>

            {error && <Alert variant="danger">{error}</Alert>}
            {notice && <Alert variant="success" style={{ fontSize: 13 }}>{notice}</Alert>}

            <StatusCard
                status={status}
                busy={busy}
                onIngest={() => act("Ingest finished.", async () => {
                    await runIngest({ days: 1, analyzeLimit: 5 });
                    setStatus(await getStatus());
                })}
            />

            <div style={card}>
                <div style={cardTitle}>Watchlist · {watchlist.length} symbols</div>
                <Form.Control
                    as="textarea"
                    rows={5}
                    value={symbolText}
                    onChange={(e) => setSymbolText(e.target.value)}
                    placeholder="INFY, TCS, RELIANCE"
                    style={{ fontSize: 13, fontFamily: "monospace" }}
                />
                <div style={{ fontSize: 11.5, color: "#6b7480", margin: "8px 0 12px" }}>
                    Separate with commas, spaces or newlines. Only these companies are ingested and analysed.
                </div>
                <Button size="sm" variant="outline-light" onClick={saveWatchlist} disabled={busy}>
                    Save watchlist
                </Button>
                <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={seed}
                    disabled={busy}
                    style={{ marginLeft: 8 }}
                >
                    Top up from portfolio
                </Button>
            </div>

            <div style={card}>
                <div style={cardTitle}>Schedule</div>
                <Row>
                    <Col xs={6} md={3}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Morning hour</Form.Label>
                        <Form.Control
                            type="number" min={0} max={23} size="sm"
                            defaultValue={config.schedule.amHour}
                            onBlur={(e) => saveConfig({
                                schedule: { ...config.schedule, amHour: Number(e.target.value) },
                            })}
                        />
                    </Col>
                    <Col xs={6} md={3}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Evening hour</Form.Label>
                        <Form.Control
                            type="number" min={0} max={23} size="sm"
                            defaultValue={config.schedule.pmHour}
                            onBlur={(e) => saveConfig({
                                schedule: { ...config.schedule, pmHour: Number(e.target.value) },
                            })}
                        />
                    </Col>
                    <Col xs={6} md={3}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Ingest every (min)</Form.Label>
                        <Form.Control
                            type="number" min={5} max={60} size="sm"
                            defaultValue={config.schedule.ingestEveryMinutes}
                            onBlur={(e) => saveConfig({
                                schedule: { ...config.schedule, ingestEveryMinutes: Number(e.target.value) },
                            })}
                        />
                    </Col>
                    <Col xs={6} md={3}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Alert at materiality</Form.Label>
                        <Form.Control
                            type="number" min={0} max={100} size="sm"
                            defaultValue={config.materialityAlertThreshold}
                            onBlur={(e) => saveConfig({ materialityAlertThreshold: Number(e.target.value) })}
                        />
                    </Col>
                </Row>
                <div style={{ fontSize: 11.5, color: "#6b7480", marginTop: 10 }}>
                    Times are in {status?.schedule ? "IST" : "the server timezone"}. Changing an hour
                    reschedules immediately. A filing scoring at or above the threshold triggers an
                    instant alert instead of waiting for the next edition.
                </div>
            </div>

            <div style={card}>
                <div style={cardTitle}>Delivery</div>
                {["email", "telegram", "push", "inApp", "tweet"].map((channel) => (
                    <Form.Check
                        key={channel}
                        type="switch"
                        id={`md-ch-${channel}`}
                        label={channel === "inApp" ? "In-app dashboard" : channel}
                        checked={!!config.enabled[channel]}
                        disabled={busy}
                        onChange={(e) => setEnabled(channel, e.target.checked)}
                        style={{ fontSize: 13, color: "#c3ccd8", marginBottom: 4 }}
                    />
                ))}
                <div style={{ marginTop: 12, fontSize: 12.5, color: "#95a1b1" }}>
                    Recipients: {(config.recipients || []).map((r) => (
                        <Badge variant="secondary" key={r.email} style={{ marginRight: 5, fontWeight: 400 }}>
                            {r.email}
                        </Badge>
                    ))}
                </div>
            </div>

            <div style={card}>
                <div style={cardTitle}>Market topics</div>
                <Form.Control
                    as="textarea"
                    rows={6}
                    defaultValue={(config.marketTopics || []).join("\n")}
                    onBlur={(e) => saveConfig({
                        marketTopics: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean),
                    })}
                    style={{ fontSize: 13 }}
                />
                <div style={{ fontSize: 11.5, color: "#6b7480", marginTop: 8 }}>
                    One topic per line. These drive what the market brief researches each run.
                </div>
            </div>

            <div style={card}>
                <div style={cardTitle}>Models</div>
                <Row>
                    <Col xs={12} md={4}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Fast (filing analysis)</Form.Label>
                        <Form.Control
                            size="sm"
                            placeholder="gemini-3.5-flash-lite"
                            defaultValue={config.models?.fast || ""}
                            onBlur={(e) => saveConfig({
                                models: { ...config.models, fast: e.target.value.trim() || null },
                            })}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Balanced (company pass)</Form.Label>
                        <Form.Control
                            size="sm"
                            placeholder="gemini-3.5-flash-lite"
                            defaultValue={config.models?.balanced || ""}
                            onBlur={(e) => saveConfig({
                                models: { ...config.models, balanced: e.target.value.trim() || null },
                            })}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Deep (market brief)</Form.Label>
                        <Form.Control
                            size="sm"
                            placeholder="gemini-3.5-flash"
                            defaultValue={config.models?.deep || ""}
                            onBlur={(e) => saveConfig({
                                models: { ...config.models, deep: e.target.value.trim() || null },
                            })}
                        />
                    </Col>
                </Row>
                <div style={{ fontSize: 11.5, color: "#6b7480", marginTop: 10 }}>
                    Active provider is <strong style={{ color: "#a8b3c1" }}>{status?.provider}</strong>, search backend{" "}
                    <strong style={{ color: "#a8b3c1" }}>{status?.searchProvider}</strong>. Leave a box empty to use the
                    default for that provider. Free-tier Gemini allows only 20 requests per day <em>per model</em>, so
                    pointing Deep at a different model than Fast gives each its own allowance.
                    API keys and the provider itself are environment variables, not editable here.
                </div>
            </div>

            <div style={card}>
                <div style={cardTitle}>Cost controls</div>
                <Row>
                    <Col xs={6} md={4}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Filings per company</Form.Label>
                        <Form.Control
                            type="number" min={1} max={30} size="sm"
                            defaultValue={config.limits.filingsPerCompany}
                            onBlur={(e) => saveConfig({
                                limits: { ...config.limits, filingsPerCompany: Number(e.target.value) },
                            })}
                        />
                    </Col>
                    <Col xs={6} md={4}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Max tool iterations</Form.Label>
                        <Form.Control
                            type="number" min={1} max={20} size="sm"
                            defaultValue={config.limits.maxIterations}
                            onBlur={(e) => saveConfig({
                                limits: { ...config.limits, maxIterations: Number(e.target.value) },
                            })}
                        />
                    </Col>
                    <Col xs={6} md={4}>
                        <Form.Label style={{ fontSize: 12, color: "#95a1b1" }}>Company concurrency</Form.Label>
                        <Form.Control
                            type="number" min={1} max={8} size="sm"
                            defaultValue={config.limits.companyConcurrency}
                            onBlur={(e) => saveConfig({
                                limits: { ...config.limits, companyConcurrency: Number(e.target.value) },
                            })}
                        />
                    </Col>
                </Row>
                <div style={{ fontSize: 11.5, color: "#6b7480", marginTop: 10 }}>
                    Lower these to cut the cost of each edition. The hard per-run spend ceiling is set by
                    LLM_MAX_USD_PER_RUN in the environment.
                </div>
            </div>
        </div>
    );
}

export default function MarketDeskSettings() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Header user={currentUser()} />
            <AdminGate><Settings /></AdminGate>
        </ThemeProvider>
    );
}
