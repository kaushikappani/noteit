/**
 * get_company_filings — reads our own store, never the exchange.
 *
 * The stored summaries are the whole point of the ingest pipeline: the agent
 * gets analysed filings for the price of a Mongo query, with no PDF parsing and
 * no second LLM pass.
 */

const { MdFiling } = require("../../models");

module.exports = function filingsTool() {
    return {
        name: "get_company_filings",
        description:
            "Get recent exchange filings for a company, already summarised and scored for materiality. " +
            "Prefer this over searching the web for filings.",
        parameters: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "NSE symbol, e.g. RELIANCE." },
                days: { type: "integer", description: "Look back this many days. Default 7." },
                minMateriality: {
                    type: "integer",
                    description: "Only filings scoring at least this (0-100). Default 0.",
                },
            },
            required: ["symbol"],
        },
        handler: async ({ symbol, days = 7, minMateriality = 0 }) => {
            const since = new Date(Date.now() - days * 86400000);
            const filings = await MdFiling.find({
                symbol: String(symbol).trim().toUpperCase(),
                announcedAt: { $gte: since },
                status: "summarized",
                materiality: { $gte: minMateriality },
            }).sort({ materiality: -1, announcedAt: -1 }).limit(12).lean();

            if (!filings.length) return { symbol, count: 0, filings: [], note: "no filings in this window" };

            return {
                symbol,
                count: filings.length,
                filings: filings.map((f) => ({
                    announcedAt: f.announcedAt,
                    headline: f.desc,
                    summary: f.summary,
                    sentiment: f.sentiment,
                    materiality: f.materiality,
                    url: f.attachmentUrl,
                })),
            };
        },
    };
};
