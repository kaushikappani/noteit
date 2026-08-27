import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Spinner, Form } from "react-bootstrap";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Header from "../../components/Header";
import AdminGate, { currentUser } from "../AdminGate";
import { getLatestEdition, getCompanies, buildEdition, errorMessage } from "../api";
import EditionHeader from "../components/EditionHeader";
import MarketBriefPanel from "../components/MarketBriefPanel";
import CompanyCard from "../components/CompanyCard";
import CalendarPanel from "../components/CalendarPanel";

const darkTheme = createTheme({ palette: { mode: "dark" } });

const SORTS = {
    // Covered-in-this-edition first, then by materiality, so the rows that have
    // something to say are never buried under the quiet ones.
    materiality: (a, b) =>
        Number(b.covered) - Number(a.covered) ||
        (b.materiality - a.materiality) ||
        a.symbol.localeCompare(b.symbol),
    symbol: (a, b) => a.symbol.localeCompare(b.symbol),
    sentiment: (a, b) =>
        String(a.sentiment || "zz").localeCompare(String(b.sentiment || "zz")) ||
        a.symbol.localeCompare(b.symbol),
};

const FILTERS = {
    news: { label: "With news", test: (r) => r.covered },
    all: { label: "All companies", test: () => true },
    filed: { label: "Has filings on record", test: (r) => r.filingCount > 0 },
};

function Screener() {
    const [edition, setEdition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [sort, setSort] = useState("materiality");
    const [filter, setFilter] = useState("news");

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // The company grid comes from /companies rather than the edition, so
            // every watchlist name gets a row even when nothing was filed.
            const [editionData, companyData] = await Promise.all([
                getLatestEdition().catch((e) => {
                    if (e?.response?.status === 404) return { edition: null };
                    throw e;
                }),
                getCompanies(),
            ]);
            setEdition(editionData.edition);
            setRows(companyData.rows || []);
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
            // deliver: true — a rebuild produces a new edition, and an edition
            // nobody was mailed has effectively not been published. This sent
            // deliver:false, so "Rebuild now" rebuilt the newspaper and then told
            // the server to skip every channel, email included.
            await buildEdition({ force: true, deliver: true });
            await load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const visible = rows.filter(FILTERS[filter].test).sort(SORTS[sort]);
    const withNews = rows.filter((r) => r.covered).length;

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
            ) : (
                <>
                    {!edition && (
                        <Alert variant="secondary">
                            No edition has been built yet, so there is no market brief. Use{" "}
                            <strong>Rebuild now</strong> above, or wait for the 8&nbsp;AM run. Your
                            companies are still listed below.
                        </Alert>
                    )}
                    {edition && <MarketBriefPanel edition={edition} />}

                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 12, flexWrap: "wrap", marginBottom: 12,
                    }}>
                        <div style={{
                            fontSize: 11, textTransform: "uppercase",
                            letterSpacing: ".6px", color: "#7c8698",
                        }}>
                            Your companies · {visible.length} of {rows.length} shown · {withNews} with news
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <Form.Control
                                as="select"
                                size="sm"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{ width: 190, fontSize: 12.5 }}
                            >
                                {Object.entries(FILTERS).map(([key, f]) => (
                                    <option key={key} value={key}>
                                        {f.label} ({rows.filter(f.test).length})
                                    </option>
                                ))}
                            </Form.Control>
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
                              No companies match this filter. Switch to <strong>All companies</strong>
                              {" "}to see the whole watchlist.
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
