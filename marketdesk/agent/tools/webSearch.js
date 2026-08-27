/**
 * The web_search tool.
 *
 * From the model's side this is an ordinary function call. Underneath, the
 * handler delegates to provider.search(), which issues its own separate request
 * — necessary because Gemini refuses a call carrying both google_search and
 * custom functionDeclarations, and useful because it lets the search backend be
 * chosen independently of the chat model.
 */

const moment = require("moment-timezone");
const { TIME_ZONE } = require("../../config/settings");

module.exports = function webSearchTool({ provider }) {
    return {
        name: "web_search",
        description:
            "Search the web for current information: news, prices, analyst commentary, company events. " +
            "Use a specific query. Returns a summary with source citations.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "What to search for." },
                recencyDays: {
                    type: "integer",
                    description: "Restrict to the last N days. Use 1-3 for today's news.",
                },
            },
            required: ["query"],
        },
        handler: async ({ query, recencyDays }, ctx) => {
            const { signal } = ctx;
            if (!provider.search) {
                return { error: "web search is not configured on this deployment" };
            }

            // Anchor the query to today. Grounded search otherwise returns
            // whatever "today" meant in the retrieved page, which is how a
            // Saturday ends up described as a trading session.
            const today = moment().tz(TIME_ZONE).format("D MMMM YYYY");
            const dated = `${query} (as of ${today})`;

            const result = await provider.search({ query: dated, recencyDays, signal });

            // Keep only citations plausibly about the query. A market-brief run
            // came back citing football fixture predictions, which then appeared
            // in the newspaper as sources; an irrelevant citation is worse than
            // none because it looks like evidence.
            const tokens = String(query).toLowerCase().split(/[^a-z0-9]+/i)
                .filter((t) => t.length > 3);
            const relevant = (c) => {
                if (!tokens.length) return true;
                const hay = String(c.title || "").toLowerCase();
                return tokens.some((t) => hay.includes(t));
            };
            if (ctx?.facts) ctx.facts.sourced = (ctx.facts.sourced || 0) + 1;
            return {
                summary: result.text,
                citations: (result.citations || []).filter(relevant).slice(0, 8),
            };
        },
    };
};
