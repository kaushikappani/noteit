import React from "react";
import { Link } from "react-router-dom";

/** Forward-looking ex-dates and board meetings. */
export default function CalendarPanel({ calendar = [], linkSymbols = true }) {
    if (!calendar.length) return null;

    return (
        <section style={{
            marginTop: 26, padding: 16, borderRadius: 7,
            background: "#12171e", border: "1px solid #202834",
        }}>
            <div style={{
                fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px",
                color: "#7c8698", marginBottom: 11,
            }}>
                Coming up
            </div>

            {calendar.slice(0, 15).map((c, i) => (
                <div key={i} style={{
                    display: "flex", gap: 10, alignItems: "baseline",
                    padding: "6px 0", borderBottom: i < calendar.length - 1 ? "1px solid #1b222c" : "none",
                }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#dbe2ea", minWidth: 92 }}>
                        {linkSymbols
                            ? <Link to={`/marketdesk/company/${c.symbol}`} style={{ color: "#dbe2ea", textDecoration: "none" }}>
                                {c.symbol}
                              </Link>
                            : c.symbol}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "#a8b3c1", lineHeight: 1.45 }}>
                        {c.subject}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#7c8698", whiteSpace: "nowrap" }}>
                        {c.exDate
                            ? new Date(c.exDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                            : ""}
                    </span>
                </div>
            ))}
        </section>
    );
}
