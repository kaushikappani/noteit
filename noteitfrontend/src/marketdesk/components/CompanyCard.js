import React from "react";
import { Link } from "react-router-dom";
import MaterialityBadge, { SentimentDot } from "./MaterialityBadge";

/** One company's row in the screener. */
export default function CompanyCard({ row }) {
    return (
        <Link
            to={`/marketdesk/company/${row.symbol}`}
            style={{ textDecoration: "none", display: "block" }}
        >
            <div style={{
                padding: "13px 15px", marginBottom: 8, borderRadius: 7,
                background: row.stale ? "#12171e" : "#161c24",
                border: "1px solid #232c38",
                opacity: row.stale ? 0.62 : 1,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                    <MaterialityBadge score={row.materiality} />
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "#e8ecf1" }}>
                        {row.symbol}
                    </span>
                    <SentimentDot sentiment={row.sentiment} />
                    {row.sector && (
                        <span style={{ fontSize: 11, color: "#6b7480" }}>{row.sector}</span>
                    )}
                    {row.stale && (
                        <span style={{ fontSize: 10.5, color: "#6b7480", marginLeft: "auto" }}>
                            no new filings
                        </span>
                    )}
                </div>

                <div style={{ fontSize: 13.5, color: "#c3ccd8", lineHeight: 1.45 }}>
                    {row.headline || "—"}
                </div>

                {row.bullets?.length > 0 && !row.stale && (
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
