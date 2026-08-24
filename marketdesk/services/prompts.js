/**
 * Prompts and output schemas for the two edition passes.
 *
 * Kept apart from the jobs so the wording can be tuned without touching
 * orchestration, and so both passes are visible side by side.
 */

const moment = require("moment-timezone");
const { TIME_ZONE } = require("../config/settings");

const SNAPSHOT_SCHEMA = {
    type: "object",
    properties: {
        headline: { type: "string", description: "One line, under 90 characters, the single most important thing." },
        bullets: {
            type: "array",
            items: { type: "string" },
            description: "3 to 5 specific points. Numbers, dates, counterparties. No filler.",
        },
        risks: {
            type: "array",
            items: { type: "string" },
            description: "0 to 3 concrete risks or things to watch. Omit if genuinely none.",
        },
        newsDigest: { type: "string", description: "2 to 4 sentences on what the web says right now." },
        sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
    },
    required: ["headline", "bullets", "sentiment"],
};

const MARKET_SCHEMA = {
    type: "object",
    properties: {
        headline: { type: "string", description: "One line summarising the session. Under 100 characters." },
        brief: {
            type: "string",
            description:
                "The market brief, 250-400 words, plain paragraphs separated by blank lines. " +
                "Lead with what happened and why. No bullet characters, no markdown headings.",
        },
        indices: {
            type: "array",
            description: "The index and commodity levels actually fetched via tools.",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    value: { type: "string" },
                    change: { type: "string", description: "e.g. '+0.8%' or '-124 pts'" },
                },
                required: ["name", "value"],
            },
        },
        themes: {
            type: "array",
            items: { type: "string" },
            description: "2 to 5 short theme labels driving the session.",
        },
    },
    required: ["headline", "brief"],
};

/**
 * Today, spelled out for the model.
 *
 * Without this a model has no idea what day it is, so it invents weekday labels
 * and cheerfully reports a "Friday session" that actually fell on a Saturday.
 * Stating the date, the weekday, and the fact that Indian markets are shut at
 * weekends is what stops a brief from attributing a session to a closed day.
 */
function nowContext() {
    const now = moment().tz(TIME_ZONE);

    // Most recent Mon-Fri at or before today. Exchange holidays are not in this
    // calendar, which is exactly why the model is told to verify rather than assume.
    const lastWeekday = now.clone();
    while (lastWeekday.isoWeekday() > 5) lastWeekday.subtract(1, "day");

    return [
        `Today is ${now.format("dddd, D MMMM YYYY")} and the time is ${now.format("HH:mm")} IST.`,
        "NSE and BSE trade Monday to Friday only, and are also shut on exchange holidays.",
        `The latest weekday on or before today is ${lastWeekday.format("dddd D MMMM YYYY")}, so the most recent completed session is that day or earlier.`,
        "Never describe a Saturday or a Sunday as a trading session.",
        "Always give the actual date of any session you describe, and confirm it with a tool rather than assuming. If you cannot establish the date, say which session you mean in words instead of guessing one.",
    ].join(" ");
}

const SNAPSHOT_RULES = [
    "You are an Indian equity analyst writing one company's entry in a twice-daily market briefing.",
    "Start with get_company_filings - those filings are already summarised and scored, so use them rather than searching for filings.",
    "Then use web_search for anything the filings do not cover: broker views, sector news, price action, management commentary.",
    "Use get_price for any price you mention. If it returns an error or says a quote is unavailable, fall back to web_search rather than dropping the number, and say which session the price refers to.",
    "Never state a figure from memory. Every number must come from a filing or a tool result.",
    "Be concrete and sceptical. Say what changed and why it matters to a shareholder.",
    "Do not give buy or sell recommendations. Do not add disclaimers.",
].join(" ");

const MARKET_RULES = [
    "You are writing the market-wide front page of a twice-daily Indian equity briefing.",
    "Call get_indices once, first. It returns the Indian and global index levels in a single call. Quote only those numbers.",
    "For anything get_indices does not cover, use get_price. If a tool reports no data, write around it and say the level was unavailable.",
    "Never supply a level, a flow figure or a yield from your own knowledge. Anything not returned by a tool in this conversation must not appear as a number.",
    "Use web_search for the narrative and for FII and DII flows.",
    "Cover: where Indian indices closed or opened, the reasons, global cues, FII and DII flows, sector leadership, and currency or commodity moves that matter.",
    "Write for someone who already knows the market. No definitions, no hedging, no disclaimers.",
].join(" ");

/** System prompt for the per-company pass, anchored to today. */
const snapshotSystem = () => `${SNAPSHOT_RULES} ${nowContext()}`;

/** System prompt for the market pass, anchored to today. */
const marketSystem = () => `${MARKET_RULES} ${nowContext()}`;

/** The company pass task, built from stored filing summaries. */
function snapshotTask({ symbol, companyName, slot, filings, charsPerFiling }) {
    const lines = filings.length
        ? filings.map((f, i) => {
            const summary = (f.summary || "").slice(0, charsPerFiling);
            const when = new Date(f.announcedAt).toISOString().slice(0, 16).replace("T", " ");
            return `${i + 1}. [${when}] (materiality ${f.materiality}/100, ${f.sentiment}) ${f.desc}\n   ${summary}`;
        }).join("\n")
        : "(no new filings in this window)";

    return [
        `Company: ${symbol}${companyName ? ` (${companyName})` : ""}`,
        `Edition: ${slot === "AM" ? "pre-market morning" : "post-market evening"}`,
        "",
        "Filings already on record for this window, newest and most material first:",
        lines,
        "",
        "Write this company's briefing entry. Verify anything unclear with the tools available to you.",
    ].join("\n");
}

/** The market pass task. */
function marketTask({ slot, dateLabel, topics, headlines }) {
    return [
        `Date: ${dateLabel}`,
        `Edition: ${slot === "AM" ? "8 AM pre-market — set up the day ahead" : "8 PM post-market — explain the session that just closed"}`,
        "",
        "Cover these topics:",
        ...topics.map((t) => `- ${t}`),
        "",
        headlines.length
            ? `The most material filings across the tracked portfolio today:\n${headlines.map((h) => `- ${h}`).join("\n")}`
            : "No material filings across the tracked portfolio today.",
        "",
        "Write the front-page brief.",
    ].join("\n");
}

module.exports = {
    SNAPSHOT_SCHEMA, MARKET_SCHEMA,
    snapshotSystem, marketSystem, nowContext,
    snapshotTask, marketTask,
};
