/**
 * Turns one filing into a durable summary + sentiment + materiality score.
 *
 * This is the "compute once" half of the design. The twice-daily edition build
 * reads MdFiling.summary and never opens a PDF, so the expensive work happens
 * here, once per filing, at ingest time.
 */

const { fetchDocumentText } = require("../../functions/documentToText");
const { getProvider } = require("../llm");
const { parseJsonLoose } = require("../llm/json");
const { MdFiling } = require("../models");

const MAX_DOC_CHARS = 10000;
const MIN_USEFUL_CHARS = 200;
const MAX_ATTEMPTS = 3;

const ANALYSIS_SCHEMA = {
    type: "object",
    properties: {
        summary: {
            type: "string",
            description:
                "2-3 short points in plain investor language. First line reads as a notification headline. No markdown, no bold, no disclaimers.",
        },
        sentiment: {
            type: "string",
            enum: ["positive", "negative", "neutral"],
            description: "Sentiment for the shareholder, based strictly on the filing contents.",
        },
        materiality: {
            type: "integer",
            description:
                "0-100. How much this should move an investor's view. 0-20 routine compliance (newspaper copies, voting results, recording links, routine director or auditor changes). 30-50 investor meets, minor updates, small orders. 60-80 quarterly results, large orders, capex, bonus, split, buyback, dividend, credit rating change, guidance. 85-100 mergers, acquisitions, demergers, fraud, resignations of MD/CEO/CFO, regulatory penalties, insolvency.",
        },
        materialityReason: {
            type: "string",
            description: "One short sentence justifying the score.",
        },
    },
    required: ["summary", "sentiment", "materiality", "materialityReason"],
};

const SYSTEM = [
    "You are a professional Indian equity analyst reading an exchange filing.",
    "Be concrete and specific: name the numbers, counterparties and dates that appear in the filing.",
    "Never speculate beyond the document. Never add disclaimers or recommendations.",
].join(" ");

/**
 * Best available text for a filing.
 *
 * A scanned or image-only PDF yields nothing useful, and previously that meant
 * the filing was written off entirely. NSE's own `desc` and `attchmntText`
 * fields are usually descriptive enough to score and summarise, so they become
 * the fallback rather than a dead end.
 */
async function resolveText(filing) {
    const metadata = [filing.desc, filing.attachmentText].filter(Boolean).join("\n").trim();

    if (filing.attachmentUrl && /\.pdf(\?|$)/i.test(filing.attachmentUrl)) {
        try {
            const text = (await fetchDocumentText(filing.attachmentUrl)) || "";
            if (text.trim().length >= MIN_USEFUL_CHARS) {
                return { text: text.slice(0, MAX_DOC_CHARS), source: "pdf" };
            }
        } catch (err) {
            console.warn(`[marketdesk] pdf extract failed for ${filing.symbol}: ${err.message}`);
        }
    }
    if (metadata.length) return { text: metadata.slice(0, MAX_DOC_CHARS), source: "metadata" };
    return { text: "", source: "none" };
}

/** Normalise the model's JSON into exactly the fields the schema promises. */
function parseAnalysis(raw) {
    const parsed = parseJsonLoose(raw);
    const score = Number(parsed.materiality);
    return {
        summary: String(parsed.summary || "").trim(),
        sentiment: ["positive", "negative", "neutral"].includes(parsed.sentiment)
            ? parsed.sentiment
            : "neutral",
        materiality: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
        materialityReason: String(parsed.materialityReason || "").trim(),
    };
}

/**
 * Analyse a single filing document and persist the result.
 * @returns {Promise<{status: string, materiality?: number}>}
 */
async function analyzeFiling(filing, { provider, settings } = {}) {
    const llm = provider || getProvider({ models: settings?.models });
    const attempts = (filing.attempts || 0) + 1;

    try {
        const { text, source } = await resolveText(filing);
        if (!text) throw new Error("no extractable text in PDF or metadata");

        const result = await llm.chat({
            system: SYSTEM,
            messages: [{
                role: "user",
                content: [
                    `Company: ${filing.symbol}`,
                    `Filing headline: ${filing.desc || "(none)"}`,
                    source === "metadata"
                        ? "The attachment could not be read; score from the headline text below."
                        : "Filing text follows.",
                    "---",
                    text,
                ].join("\n"),
            }],
            responseFormat: { json: ANALYSIS_SCHEMA },
            tier: "fast",
            temperature: 0.4,
            maxTokens: 1200,
        });

        const analysis = parseAnalysis(result.text);

        await MdFiling.updateOne({ _id: filing._id }, {
            $set: {
                ...analysis,
                status: "summarized",
                attempts,
                lastError: null,
                model: llm.resolveModel("fast"),
                textSource: source,
            },
        });
        return { status: "summarized", ...analysis };
    } catch (err) {
        // Give up after MAX_ATTEMPTS so a permanently unreadable filing cannot
        // be retried forever on every ingest cycle.
        const status = attempts >= MAX_ATTEMPTS ? "skipped" : "failed";
        await MdFiling.updateOne({ _id: filing._id }, {
            $set: { status, attempts, lastError: String(err.message || err).slice(0, 500) },
        });
        console.error(`[marketdesk] analysis ${status} for ${filing.symbol}: ${err.message}`);
        return { status, error: err.message };
    }
}

/**
 * Work through filings that still need analysis, oldest first.
 * Bounded so a backlog cannot monopolise one scheduler tick.
 */
async function summarizePending({ limit = 5, settings } = {}) {
    const pending = await MdFiling.find({
        $or: [
            { status: "new" },
            { status: "failed", attempts: { $lt: MAX_ATTEMPTS } },
        ],
    }).sort({ announcedAt: 1 }).limit(limit);

    if (!pending.length) return { processed: 0, results: [] };

    const llm = getProvider({ models: settings?.models });
    const results = [];
    for (const filing of pending) {
        results.push({
            symbol: filing.symbol,
            id: filing._id,
            ...(await analyzeFiling(filing, { provider: llm, settings })),
        });
    }
    return { processed: results.length, results };
}

module.exports = { analyzeFiling, summarizePending, ANALYSIS_SCHEMA, MAX_ATTEMPTS };
