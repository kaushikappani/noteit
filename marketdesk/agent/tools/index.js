/**
 * Assemble the registry.
 *
 * Tools are factories so each one can close over the provider (web_search needs
 * it) without any of them reaching for a global.
 */

const { ToolRegistry } = require("../registry");

const webSearchTool = require("./webSearch");
const filingsTool = require("./filings");
const watchlistTool = require("./watchlist");
const pricesTool = require("./prices");
const newsTool = require("./news");
const calendarTool = require("./calendar");

/** Named sets, so each pass exposes only what it should reach for. */
const TOOL_SETS = {
    companySnapshot: ["get_company_filings", "web_search", "get_price", "get_calendar"],
    marketBrief: ["web_search", "get_price", "get_news", "get_watchlist"],
    all: null,
};

function buildRegistry({ provider }) {
    const tools = [
        filingsTool(),
        watchlistTool(),
        pricesTool(),
        newsTool(),
        calendarTool(),
    ];

    // Only offer web_search when a search backend actually resolved. Declaring a
    // tool that always errors wastes a model turn per company on a call that
    // cannot succeed, and invites the model to keep retrying it. TOOL_SETS may
    // still name it -- declarations() filters to what is registered.
    if (provider.search) tools.unshift(webSearchTool({ provider }));
    else console.warn("[marketdesk] no search backend — web_search will not be offered to the agent");

    return new ToolRegistry().registerAll(tools);
}

module.exports = { buildRegistry, TOOL_SETS };
