import React from "react";
import { Link } from "react-router-dom";
import MaterialityBadge, { SentimentDot } from "./MaterialityBadge";

const dateLabel = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * One company's row in the screener.
 *
 * Three states, because every watchlist company gets a row now:
 *  - covered: analysed in this edition
 *  - stale:   nothing filed this window, previous entry carried forward
 *  - neither: nothing on record at all, but still clickable
 */
export default function CompanyCard({ row }) {
    const dim = !row.covered;

    const note = row.covered ? null
        : row.stale ? "no new filings"
        : row.filingCount > 0 ? `last filed ${dateLabel(row.lastFilingAt)}`
        : "no filings on record";

    return (
        <Link
            to={`/marketdesk/company/${row.symbol}`}
            style={{ textDecoration: "none", display: "block" }}
        >
            <div style={{
                padding: "13px 15px", marginBottom: 8, borderRadius: 7,
                background: dim ? "#12171e" : "#161c24",
                border: "1px solid #232c38",
                opacity: dim ? 0.72 : 1,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                    {row.materiality > 0 && <MaterialityBadge score={row.materiality} />}
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "#e8ecf1" }}>
                        {row.symbol}
                    </span>
                    {row.sentiment && <SentimentDot sentiment={row.sentiment} />}
                    {row.sector && (
                        <span style={{ fontSize: 11, color: "#6b7480" }}>{row.sector}</span>
                    )}
                    {note && (
                        <span style={{ fontSize: 10.5, color: "#6b7480", marginLeft: "auto" }}>
                            {note}
                        </span>
                    )}
                </div>

                <div style={{ fontSize: 13.5, color: dim ? "#95a1b1" : "#c3ccd8", lineHeight: 1.45 }}>
                    {row.headline || row.name || "Nothing recorded yet"}
                </div>

                {row.bullets?.length > 0 && row.covered && (
                    <ul style={{
                        margin: "8px 0 0 16px", padding: 0,
                        fontSize: 12.5, color: "#95a1b1", lineHeight: 1.55,
                    }}>
                        {row.bullets.slice(0, 2).map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                )}
            </div>
        </Link>
    );
}
