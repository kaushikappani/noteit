import React from "react";
import CitationList from "./CitationList";

function IndexTile({ item }) {
    const negative = String(item.change || "").trim().startsWith("-");
    return (
        <div style={{
            flex: "1 1 130px", minWidth: 120,
            padding: "9px 12px", borderRadius: 6,
            background: "#161c24", border: "1px solid #232c38",
        }}>
            <div style={{
                fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".5px", color: "#7c8698",
            }}>
                {item.name}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#e8ecf1" }}>{item.value}</div>
            {item.change ? (
                <div style={{ fontSize: 12, color: negative ? "#f87171" : "#4ade80" }}>
                    {item.change}
                </div>
            ) : null}
        </div>
    );
}

/** The front page: headline, themes, levels, then the brief itself. */
export default function MarketBriefPanel({ edition }) {
    if (!edition) return null;

    // Editions built before the brief became a list still only have prose, so
    // fall back to splitting it rather than showing nothing.
    const points = edition.marketPoints?.length
        ? edition.marketPoints
        : String(edition.marketBrief || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    return (
        <section style={{ marginBottom: 30 }}>
            {edition.marketBriefUnsourced && (
                <div style={{
                    margin: "0 0 16px", padding: "11px 13px",
                    borderLeft: "3px solid #f87171",
                    background: "rgba(248,113,113,.10)",
                    color: "#fca5a5", fontSize: 12.5, lineHeight: 1.5, borderRadius: 4,
                }}>
                    <strong>Market section unverified.</strong> No price or news lookup succeeded for
                    this edition, so the commentary below is not backed by fetched data and any figures
                    in it should not be relied on. The company entries are built from exchange filings
                    and are unaffected.
                </div>
            )}
            {edition.marketHeadline && (
                <h1 style={{
                    fontSize: 21, lineHeight: 1.35, color: "#f1f5f9",
                    fontWeight: 700, margin: "0 0 12px",
                }}>
                    {edition.marketHeadline}
                </h1>
            )}

            {edition.marketThemes?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    {edition.marketThemes.map((theme) => (
                        <span key={theme} style={{
                            display: "inline-block", margin: "0 6px 6px 0", padding: "3px 10px",
                            borderRadius: 12, background: "rgba(255,255,255,.06)",
                            color: "#b6c2d2", fontSize: 11.5,
                        }}>
                            {theme}
                        </span>
                    ))}
                </div>
            )}

            {edition.indices?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                    {edition.indices.map((i) => <IndexTile key={i.name} item={i} />)}
                </div>
            )}

            {points.length > 0 && (
                <ul style={{ margin: "0 0 16px", padding: "0 0 0 20px" }}>
                    {points.map((p, i) => (
                        <li key={i} style={{
                            margin: "0 0 10px", lineHeight: 1.6,
                            color: "#c3ccd8", fontSize: 14.5,
                        }}>
                            {p}
                        </li>
                    ))}
                </ul>
            )}

            <CitationList citations={edition.marketCitations} max={5} />
        </section>
    );
}
