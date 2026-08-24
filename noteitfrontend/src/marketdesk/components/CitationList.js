import React, { useState } from "react";

/**
 * Sources behind a section.
 *
 * Gemini's grounding returns redirect URLs on a Google host with the publisher
 * as the title, so the title is what gets shown — the raw href is unreadable.
 */
export default function CitationList({ citations = [], max = 4 }) {
    const [expanded, setExpanded] = useState(false);
    if (!citations.length) return null;

    const shown = expanded ? citations : citations.slice(0, max);
    const hidden = citations.length - shown.length;

    return (
        <div style={{ marginTop: 10, fontSize: 11, color: "#7c8698", lineHeight: 1.8 }}>
            <span style={{ textTransform: "uppercase", letterSpacing: ".5px", marginRight: 6 }}>
                Sources
            </span>
            {shown.map((c, i) => (
                <a
                    key={`${c.url}-${i}`}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: "#8fa6c4", marginRight: 8,
                        textDecoration: "none", borderBottom: "1px dotted #4a5568",
                    }}
                >
                    [{i + 1}] {(c.title || c.url || "").slice(0, 38)}
                </a>
            ))}
            {hidden > 0 && (
                <button
                    onClick={() => setExpanded(true)}
                    style={{
                        background: "none", border: "none", color: "#7c8698",
                        cursor: "pointer", padding: 0, fontSize: 11, textDecoration: "underline",
                    }}
                >
                    +{hidden} more
                </button>
            )}
        </div>
    );
}
