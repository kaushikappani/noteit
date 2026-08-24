import React from "react";
import { Button, Spinner, Badge } from "react-bootstrap";

/** Masthead: which edition you are reading, and the controls to make a new one. */
export default function EditionHeader({
    edition, busy, onRebuild, onRefresh, title = "MarketDesk",
}) {
    const label = edition?.slot === "AM" ? "Morning edition" : "Evening edition";
    const built = edition?.builtAt
        ? new Date(edition.builtAt).toLocaleString("en-IN", {
            dateStyle: "medium", timeStyle: "short",
        })
        : null;

    return (
        <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "flex-end",
            justifyContent: "space-between", gap: 12,
            borderBottom: "2px solid #2a3441", paddingBottom: 14, marginBottom: 22,
        }}>
            <div>
                <div style={{
                    fontSize: 26, fontWeight: 700, letterSpacing: "-.5px", color: "#f1f5f9",
                }}>
                    {title}
                </div>
                <div style={{ fontSize: 12.5, color: "#7c8698", marginTop: 3 }}>
                    {edition
                        ? <>{label} · {edition.date}{built && ` · built ${built}`}</>
                        : "No edition built yet"}
                    {edition?.usage?.costUsd ? (
                        <span style={{ marginLeft: 8, opacity: 0.75 }}>
                            · ${Number(edition.usage.costUsd).toFixed(4)}
                        </span>
                    ) : null}
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {edition?.status && edition.status !== "ready" && (
                    <Badge variant={edition.status === "failed" ? "danger" : "secondary"}>
                        {edition.status}
                    </Badge>
                )}
                {onRefresh && (
                    <Button size="sm" variant="outline-secondary" onClick={onRefresh} disabled={busy}>
                        Refresh
                    </Button>
                )}
                {onRebuild && (
                    <Button size="sm" variant="outline-light" onClick={onRebuild} disabled={busy}>
                        {busy ? <><Spinner as="span" animation="border" size="sm" /> Building…</> : "Rebuild now"}
                    </Button>
                )}
            </div>
        </div>
    );
}
