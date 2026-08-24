/**
 * get_price — quotes for a company or an index.
 *
 * NSE first for equities, Yahoo as the fallback and as the only route for global
 * indices and commodities. Both are soft: a quote that cannot be fetched returns
 * a note, so the model writes around it instead of the run dying.
 */

const { fetchQuote } = require("../../services/nseClient");

// Yahoo tickers for the cues an Indian market brief actually references.
const INDEX_TICKERS = {
    NIFTY: "^NSEI", NIFTY50: "^NSEI", SENSEX: "^BSESN", BANKNIFTY: "^NSEBANK",
    SPX: "^GSPC", SP500: "^GSPC", NASDAQ: "^IXIC", DOW: "^DJI",
    NIKKEI: "^N225", HANGSENG: "^HSI", FTSE: "^FTSE",
    CRUDE: "BZ=F", BRENT: "BZ=F", GOLD: "GC=F", DXY: "DX-Y.NYB", USDINR: "INR=X",
};

async function yahooQuote(ticker) {
    try {
        const yahooFinance = require("yahoo-finance2").default;
        const q = await yahooFinance.quote(ticker);
        if (!q) return null;
        return {
            ticker,
            name: q.shortName || q.longName || ticker,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            percentChange: q.regularMarketChangePercent,
            previousClose: q.regularMarketPreviousClose,
            currency: q.currency,
        };
    } catch (err) {
        console.error(`[marketdesk/prices] yahoo failed for ${ticker}: ${err.message}`);
        return null;
    }
}

module.exports = function pricesTool() {
    return {
        name: "get_price",
        description:
            "Get the latest price for an NSE company symbol, or for an index or commodity " +
            "(NIFTY, SENSEX, BANKNIFTY, SPX, NASDAQ, DOW, NIKKEI, HANGSENG, CRUDE, GOLD, DXY, USDINR). " +
            "Never state a price you have not fetched.",
        parameters: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "NSE symbol or index name." },
            },
            required: ["symbol"],
        },
        handler: async ({ symbol }, ctx) => {
            const key = String(symbol || "").trim().toUpperCase().replace(/\s+/g, "");
            if (!key) return { error: "symbol is required" };

            // Record what was genuinely fetched. Telling the model not to invent
            // numbers does not stop it -- a brief was published quoting four index
            // levels when every one of these lookups had failed -- so the caller
            // needs a record of real data to check the output against.
            const remember = (quote) => {
                if (quote && ctx?.facts?.prices) ctx.facts.prices.set(key, quote);
                return quote;
            };

            if (INDEX_TICKERS[key]) {
                const quote = remember(await yahooQuote(INDEX_TICKERS[key]));
                return quote || { symbol: key, note: "quote unavailable right now" };
            }

            const nseQuote = remember(await fetchQuote(key));
            if (nseQuote) return nseQuote;

            const fallback = remember(await yahooQuote(`${key}.NS`));
            return fallback || { symbol: key, note: "quote unavailable right now" };
        },
    };
};
