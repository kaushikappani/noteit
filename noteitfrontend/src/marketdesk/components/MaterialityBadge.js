import React from "react";

/**
 * Materiality as a band rather than a bare number — 78 means nothing on its own,
 * but "high" against an amber chip reads instantly.
 */
const BANDS = [
    { min: 85, label: "critical", bg: "rgba(179,38,30,.18)", fg: "#ff8a80" },
    { min: 70, label: "high", bg: "rgba(230,145,0,.18)", fg: "#ffca6b" },
    { min: 40, label: "notable", bg: "rgba(31,92,158,.20)", fg: "#7fb2f0" },
    { min: 0, label: "routine", bg: "rgba(255,255,255,.07)", fg: "#9aa4b2" },
];

export default function MaterialityBadge({ score, showLabel = false }) {
    const value = Number(score) || 0;
    const band = BANDS.find((b) => value >= b.min);

    return (
        <span
            title={`Materiality ${value}/100 — ${band.label}`}
            style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "2px 8px", borderRadius: 11,
                background: band.bg, color: band.fg,
                fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
            }}
        >
            {value}
            {showLabel && <span style={{ fontWeight: 500, opacity: 0.85 }}>{band.label}</span>}
        </span>
    );
}

export function SentimentDot({ sentiment }) {
    const color = sentiment === "positive" ? "#4ade80"
        : sentiment === "negative" ? "#f87171" : "#9aa4b2";
    return (
        <span title={sentiment || "neutral"} style={{
            display: "inline-block", width: 7, height: 7,
            borderRadius: "50%", background: color,
        }} />
    );
}
