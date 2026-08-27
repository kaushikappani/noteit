/**
 * get_price — one company or one index.
 *
 * Sources live in services/priceSources.js. NSE and Yahoo both proved unusable
 * for equities (403 and rate limiting respectively), so screener.in is the
 * primary and Yahoo is only a last resort.
 */

const { fetchEquityPrice, findIndex, fetchYahoo } = require("../../services/priceSources");

// Yahoo tickers for the few things neither Indian source covers.
const YAHOO_FALLBACK = {
    // BSE indices are not in NSE's allIndices feed and screener.in has no page
    // for them, so without these entries Sensex simply never appears in a brief.
    SENSEX: "^BSESN", BSESENSEX: "^BSESN", BANKEX: "BSE-BANK.BO",
    SPX: "^GSPC", SP500: "^GSPC", NASDAQ: "^IXIC", DOW: "^DJI",
    NIKKEI: "^N225", HANGSENG: "^HSI", FTSE: "^FTSE", DAX: "^GDAXI",
    CRUDE: "BZ=F", BRENT: "BZ=F", WTI: "CL=F", GOLD: "GC=F", SILVER: "SI=F",
    DXY: "DX-Y.NYB", USDINR: "INR=X", INR: "INR=X",
};

module.exports = function pricesTool() {
    return {
        name: "get_price",
        description:
            "Get the latest price for one NSE company symbol, or one index or commodity. " +
            "For a broad set of index levels prefer get_indices, which returns them all at once. " +
            "Quote only what this returns; if it reports no data, say so rather than estimating.",
        parameters: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "NSE symbol (e.g. ITC) or index name (e.g. NIFTY 50, CRUDE)." },
            },
            required: ["symbol"],
        },
        handler: async ({ symbol }, ctx) => {
            const key = String(symbol || "").trim().toUpperCase();
            if (!key) return { error: "symbol is required" };

            const remember = (quote, name) => {
                if (quote && ctx?.facts?.prices) ctx.facts.prices.set(name || key, quote);
                return quote;
            };

            // An index or commodity by name, from NSE or the global scraper.
            const index = await findIndex(key);
            if (index) return remember(index, index.name);

            // A tracked equity.
            const equity = await fetchEquityPrice(key.replace(/\s+/g, ""));
            if (equity) return remember(equity);

            // Anything left is a global ticker only Yahoo carries.
            const ticker = YAHOO_FALLBACK[key.replace(/\s+/g, "")];
            if (ticker) {
                const quote = await fetchYahoo(ticker);
                if (quote) return remember(quote);
            }

            return { symbol: key, note: "no price available right now; do not quote a level for this" };
        },
    };
};
