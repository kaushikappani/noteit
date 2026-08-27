/**
 * Render an edition to standalone HTML for email.
 *
 * Email clients are the constraint here, not browsers: inline styles only, table
 * layout where it matters, no external assets and no JavaScript. The in-app
 * pages render from the JSON instead, so this file only ever has to satisfy a
 * mail reader.
 */

const moment = require("moment-timezone");
const { TIME_ZONE } = require("../config/settings");

const C = {
    ink: "#101418",
    body: "#2b3239",
    muted: "#6b7480",
    line: "#e3e7ec",
    panel: "#f6f8fa",
    page: "#ffffff",
    positive: "#0f7a4d",
    negative: "#b3261e",
    neutral: "#6b7480",
};

/** Escape before interpolation — filing text is third-party content. */
function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const sentimentColor = (s) =>
    s === "positive" ? C.positive : s === "negative" ? C.negative : C.neutral;

/** Materiality reads as a band, not a bare number. */
function materialityChip(score) {
    const n = Number(score) || 0;
    const [bg, fg] = n >= 85 ? ["#fdecea", C.negative]
        : n >= 70 ? ["#fff4e5", "#8a5300"]
        : n >= 40 ? ["#eef4fb", "#1f5c9e"]
        : ["#f1f3f5", C.muted];
    return `<span style="display:inline-block;padding:2px 7px;border-radius:10px;background:${bg};color:${fg};font-size:11px;font-weight:600;">${n}</span>`;
}

/** Plain paragraphs from the model's prose. */
function paragraphs(text) {
    return String(text || "")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 12px;line-height:1.55;color:${C.body};">${esc(p).replace(/\n/g, "<br/>")}</p>`)
        .join("");
}

function list(items, color) {
    if (!items?.length) return "";
    return `<ul style="margin:0 0 12px 18px;padding:0;">${items
        .map((i) => `<li style="margin:0 0 5px;line-height:1.5;color:${color || C.body};">${esc(i)}</li>`)
        .join("")}</ul>`;
}

function indicesTable(indices) {
    if (!indices?.length) return "";
    const cells = indices.map((i) => {
        const negative = String(i.change || "").trim().startsWith("-");
        return `<td style="padding:8px 12px;border:1px solid ${C.line};background:${C.page};">
            <div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;">${esc(i.name)}</div>
            <div style="font-size:16px;font-weight:600;color:${C.ink};">${esc(i.value)}</div>
            <div style="font-size:12px;color:${negative ? C.negative : C.positive};">${esc(i.change)}</div>
        </td>`;
    });

    // Three per row keeps it readable on a phone without media queries.
    const rows = [];
    for (let i = 0; i < cells.length; i += 3) {
        rows.push(`<tr>${cells.slice(i, i + 3).join("")}</tr>`);
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">${rows.join("")}</table>`;
}

function companySection(ref, snapshot) {
    if (!snapshot) return "";
    const staleNote = ref.stale
        ? `<span style="font-size:11px;color:${C.muted};"> · no new filings</span>`
        : "";

    const citations = (snapshot.citations || []).slice(0, 4);
    const sources = citations.length
        ? `<div style="margin-top:8px;font-size:11px;color:${C.muted};">Sources: ${citations
            .map((c, i) => `<a href="${esc(c.url)}" style="color:${C.muted};">[${i + 1}] ${esc((c.title || "").slice(0, 40))}</a>`)
            .join(" · ")}</div>`
        : "";

    return `<div style="padding:16px 0;border-top:1px solid ${C.line};">
        <div style="margin:0 0 6px;">
            ${materialityChip(ref.materiality)}
            <strong style="font-size:15px;color:${C.ink};margin-left:6px;">${esc(ref.symbol)}</strong>
            <span style="font-size:12px;color:${sentimentColor(ref.sentiment)};margin-left:6px;text-transform:capitalize;">${esc(ref.sentiment || "")}</span>
            ${staleNote}
        </div>
        <div style="font-size:14px;font-weight:600;color:${C.ink};margin:0 0 8px;line-height:1.4;">${esc(snapshot.headline)}</div>
        ${list(snapshot.bullets)}
        ${snapshot.newsDigest ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:${C.body};">${esc(snapshot.newsDigest)}</p>` : ""}
        ${snapshot.risks?.length ? `<div style="font-size:12px;color:${C.muted};margin:0 0 4px;text-transform:uppercase;letter-spacing:.4px;">Watch</div>${list(snapshot.risks, C.muted)}` : ""}
        ${sources}
    </div>`;
}

function calendarPanel(calendar) {
    if (!calendar?.length) return "";
    const rows = calendar.slice(0, 15).map((c) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid ${C.line};font-weight:600;color:${C.ink};font-size:13px;">${esc(c.symbol)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${C.line};color:${C.body};font-size:13px;">${esc(c.subject)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${C.line};color:${C.muted};font-size:12px;white-space:nowrap;">${c.exDate ? moment(c.exDate).tz(TIME_ZONE).format("D MMM") : ""}</td>
    </tr>`).join("");

    return `<div style="margin:24px 0 0;padding:16px;background:${C.panel};border-radius:6px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:${C.muted};margin-bottom:10px;">Coming up</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>`;
}

/**
 * @param {object} edition the payload about to be persisted, plus `snapshots`
 * @returns {string} standalone HTML
 */
function renderEdition(edition) {
    const {
        date, slot, marketHeadline, marketBrief, marketPoints, marketThemes, indices,
        companyRefs = [], calendar = [], snapshots = [], usage,
        marketBriefUnsourced,
    } = edition;

    // Editions built before the brief became a list still only have prose, so
    // fall back to splitting it rather than showing nothing.
    const briefPoints = marketPoints?.length
        ? marketPoints
        : String(marketBrief || "").split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);

    const byId = new Map(snapshots.map((s) => [String(s._id), s]));
    const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));

    const label = slot === "AM" ? "Morning edition" : "Evening edition";
    const dateLabel = moment.tz(date, "YYYY-MM-DD", TIME_ZONE).format("dddd, D MMMM YYYY");

    const material = companyRefs.filter((r) => !r.stale);
    const quiet = companyRefs.filter((r) => r.stale);

    const sections = material
        .map((ref) => companySection(ref, byId.get(String(ref.snapshotId)) || bySymbol.get(ref.symbol)))
        .join("");

    const quietLine = quiet.length
        ? `<div style="margin-top:20px;padding-top:14px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted};">
             Quiet today (${quiet.length}): ${quiet.map((q) => esc(q.symbol)).join(", ")}
           </div>`
        : "";

    const themes = marketThemes?.length
        ? `<div style="margin:0 0 16px;">${marketThemes
            .map((t) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border-radius:11px;background:${C.panel};color:${C.body};font-size:11px;">${esc(t)}</span>`)
            .join("")}</div>`
        : "";

    return `<div style="margin:0;padding:0;background:${C.panel};">
  <div style="max-width:680px;margin:0 auto;padding:28px 22px 36px;background:${C.page};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.body};">

    <div style="border-bottom:2px solid ${C.ink};padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;color:${C.ink};">MarketDesk</div>
      <div style="font-size:12px;color:${C.muted};margin-top:3px;">${esc(label)} · ${esc(dateLabel)}</div>
    </div>

    ${marketBriefUnsourced ? `<div style="margin:0 0 16px;padding:11px 13px;border-left:3px solid #b3261e;background:#fdecea;color:#8a1c15;font-size:12.5px;line-height:1.5;">
        <strong>Market section unverified.</strong> No price or news lookup succeeded for this edition, so the
        commentary below is not backed by fetched data and any figures in it should not be relied on.
        The company sections below are built from exchange filings and are unaffected.
      </div>` : ""}
    ${marketHeadline ? `<h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:${C.ink};font-weight:700;">${esc(marketHeadline)}</h1>` : ""}
    ${themes}
    ${indicesTable(indices)}
    ${briefPoints.length ? `<ul style="margin:0 0 18px;padding:0 0 0 20px;">${briefPoints
        .map((p) => `<li style="margin:0 0 9px;line-height:1.55;color:${C.body};font-size:14px;">${esc(p)}</li>`)
        .join("")}</ul>` : ""}

    ${material.length ? `<div style="margin:28px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:${C.muted};">
        Your companies · ${material.length} with news
      </div>${sections}` : `<div style="margin:24px 0;padding:14px;background:${C.panel};border-radius:6px;font-size:13px;color:${C.muted};">
        No material filings across your watchlist in this window.
      </div>`}

    ${quietLine}
    ${calendarPanel(calendar)}

    <div style="margin-top:28px;padding-top:14px;border-top:1px solid ${C.line};font-size:11px;color:${C.muted};line-height:1.6;">
      Generated by MarketDesk from exchange filings and web research.
      ${usage?.costUsd ? `Analysis cost $${Number(usage.costUsd).toFixed(4)}.` : ""}
      <br/>Not investment advice.
    </div>

  </div>
</div>`;
}

/** Short plain-text digest for Telegram and push. */
function renderDigest(edition, { limit = 5 } = {}) {
    const label = edition.slot === "AM" ? "Morning" : "Evening";
    const dateLabel = moment.tz(edition.date, "YYYY-MM-DD", TIME_ZONE).format("D MMM");
    const top = (edition.companyRefs || []).filter((r) => !r.stale).slice(0, limit);

    const lines = [
        `*MarketDesk · ${label} ${dateLabel}*`,
        "",
        edition.marketHeadline || "",
        "",
    ];
    if (top.length) {
        lines.push(...top.map((r) => `*${r.symbol}* (${r.materiality}) ${r.headline || ""}`.trim()));
    } else {
        lines.push("No material filings across your watchlist.");
    }
    return lines.filter((l) => l !== undefined).join("\n").trim();
}

module.exports = { renderEdition, renderDigest, esc };
