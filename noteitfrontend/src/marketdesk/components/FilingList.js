import React, { useState } from "react";
import MaterialityBadge from "./MaterialityBadge";

const STATUS_NOTE = {
    new: "queued for analysis",
    failed: "analysis failed, will retry",
    skipped: "could not be read",
};

/** Every stored filing for a company, with its persisted summary. */
export default function FilingList({ filings = [] }) {
    const [openId, setOpenId] = useState(null);

    if (!filings.length) {
        return <div style={{ color: "#6b7480", fontSize: 13 }}>No filings on record yet.</div>;
    }

    return (
        <div>
            {filings.map((f) => {
                const open = openId === f._id;
                const note = STATUS_NOTE[f.status];

                return (
                    <div key={f._id} style={{
                        padding: "11px 0", borderBottom: "1px solid #202834",
                    }}>
                        <div
                            onClick={() => setOpenId(open ? null : f._id)}
                            style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}
                        >
                            <MaterialityBadge score={f.materiality} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: "#dbe2ea", lineHeight: 1.45 }}>
                                    {f.desc || "(no description)"}
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7480", marginTop: 3 }}>
                                    {new Date(f.announcedAt).toLocaleString("en-IN", {
                                        dateStyle: "medium", timeStyle: "short",
                                    })}
                                    {f.textSource === "metadata" && " · summarised from headline only"}
                                    {note && ` · ${note}`}
                                </div>
                            </div>
                        </div>

                        {open && (
                            <div style={{ marginTop: 9, paddingLeft: 42 }}>
                                {f.summary
                                    ? <div style={{
                                        fontSize: 13, color: "#b6c2d2", lineHeight: 1.6, whiteSpace: "pre-wrap",
                                    }}>{f.summary}</div>
                                    : <div style={{ fontSize: 12.5, color: "#6b7480" }}>
                                        {f.lastError || "No summary stored."}
                                    </div>}

                                {f.materialityReason && (
                                    <div style={{ fontSize: 11.5, color: "#7c8698", marginTop: 7, fontStyle: "italic" }}>
                                        {f.materialityReason}
                                    </div>
                                )}
                                {f.attachmentUrl && (
                                    <a
                                        href={f.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: 12, color: "#8fa6c4", display: "inline-block", marginTop: 8 }}
                                    >
                                        Open filing ↗
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
