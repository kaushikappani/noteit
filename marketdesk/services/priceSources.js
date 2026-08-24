/**
 * Market data without an API key.
 *
 * The obvious sources both failed in practice: NSE answers 403 on every equity
 * quote endpoint (`/api/quote-equity`, `getEquityDetails`) and Yahoo rate-limits
 * to "Too Many Requests" within a handful of calls. What does work, and is used
 * here in preference order:
 *
 *   Indian indices  -> NSE /api/allIndices     (same cookie handshake as filings)
 *   Global + crude  -> 5paisa global indices    (the app's existing scraper)
 *   Equity prices   -> screener.in              (matches broker LTP to the rupee)
 *
 * Everything is cached for the length of an edition build, because a market
 * brief and eight company passes otherwise re-fetch the same levels repeatedly.
 */

const axios = require("axios");
const cheerio = require("cheerio");
const { nse } = require("./nseClient");

const TTL_MS = 5 * 60 * 1000;
const UA = "Mozilla/5.0 (compatible; MarketDesk/1.0)";

/** Tiny memo keyed by name, so each source is fetched once per build. */
const cache = new Map();

async function memo(key, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const value = await fn();
    // Only cache a real answer; a failure should be retried by the next caller.
    if (value) cache.set(key, { at: Date.now(), value });
    return value;
}

const num = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
};

/** The Indian indices worth putting in a briefing, in reading order. */
const HEADLINE_INDICES = [
    "NIFTY 50", "NIFTY BANK", "NIFTY MIDCAP 100", "NIFTY SMLCAP 100",
    "NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY FMCG",
    "NIFTY METAL", "NIFTY REALTY", "NIFTY ENERGY", "INDIA VIX",
];

/**
 * All NSE indices, normalised.
 * @returns {Promise<Array<{name,value,change,percentChange,source}>|null>}
 */
async function fetchIndianIndices() {
    return memo("nse:allIndices", async () => {
        try {
            const data = await nse.getDataByEndpoint("/api/allIndices");
            const rows = (data?.data || [])
                .filter((i) => i.index && i.last != null)
                .map((i) => ({
                    name: String(i.index).trim(),
                    value: num(i.last),
                    change: num(i.variation),
                    percentChange: num(i.percentChange),
                    source: "NSE",
                }));
            return rows.length ? rows : null;
        } catch (err) {
            console.error(`[marketdesk/prices] NSE allIndices failed: ${err.message}`);
            return null;
        }
    });
}

/** Global indices and commodities, via the app's existing 5paisa scraper. */
async function fetchGlobalIndices() {
    return memo("global:5paisa", async () => {
        try {
            const { scrapGlobalIndices } = require("../../middleware/Scrapper");
            const rows = await scrapGlobalIndices();
            const mapped = (rows || [])
                .filter((r) => r.indicesName && r.price)
                .map((r) => ({
                    name: String(r.indicesName).trim(),
                    value: num(r.price),
                    // The scraper concatenates absolute and percentage change.
                    change: num(String(r.priceChange).split(/\s+/)[0]),
                    percentChange: num((String(r.priceChange).match(/-?[\d.]+%/) || [])[0]),
                    source: "5paisa",
                }));
            return mapped.length ? mapped : null;
        } catch (err) {
            console.error(`[marketdesk/prices] global indices failed: ${err.message}`);
            return null;
        }
    });
}

/**
 * Last traded price for one NSE symbol, scraped from screener.in.
 *
 * Screener renders the price into the page header, so one GET is enough. Verified
 * against a live broker holdings screen: INDHOTEL 727 vs 726.05, ITC 269 vs
 * 268.30 — close enough for commentary, and it is the only free source that
 * answers at all for individual equities.
 */
async function fetchEquityPrice(symbol) {
    const key = String(symbol || "").trim().toUpperCase();
    if (!key) return null;

    return memo(`equity:${key}`, async () => {
        try {
            const { data } = await axios.get(
                `https://www.screener.in/company/${encodeURIComponent(key)}/consolidated/`,
                { timeout: 20000, headers: { "User-Agent": UA } }
            );
            const $ = cheerio.load(data);
            const top = $("#top");
            const spans = top.find("div.flex.flex-align-center span");

            const price = num(spans.first().text());
            if (price === null) return null;

            return {
                symbol: key,
                name: top.find("h1").first().text().trim() || key,
                price,
                percentChange: num(spans.eq(1).text()),
                currency: "INR",
                source: "screener.in",
            };
        } catch (err) {
            console.error(`[marketdesk/prices] screener.in failed for ${key}: ${err.response?.status || err.message}`);
            return null;
        }
    });
}

/** Yahoo, kept only as a last resort — it rate-limits aggressively. */
async function fetchYahoo(ticker) {
    return memo(`yahoo:${ticker}`, async () => {
        try {
            const yahooFinance = require("yahoo-finance2").default;
            const q = await yahooFinance.quote(ticker);
            if (!q?.regularMarketPrice) return null;
            return {
                symbol: ticker,
                name: q.shortName || q.longName || ticker,
                price: q.regularMarketPrice,
                change: q.regularMarketChange,
                percentChange: q.regularMarketChangePercent,
                currency: q.currency,
                source: "yahoo",
            };
        } catch (err) {
            console.error(`[marketdesk/prices] yahoo failed for ${ticker}: ${err.message}`);
            return null;
        }
    });
}

/** Loose name match, so "nifty50" finds "NIFTY 50". */
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Find one index by name across both sources.
 * @returns {Promise<object|null>}
 */
async function findIndex(name) {
    const target = norm(name);
    if (!target) return null;

    const [indian, global] = await Promise.all([fetchIndianIndices(), fetchGlobalIndices()]);
    const all = [...(indian || []), ...(global || [])];

    return all.find((i) => norm(i.name) === target)
        || all.find((i) => norm(i.name).includes(target) || target.includes(norm(i.name)))
        || null;
}

/** The headline set for a briefing: key Indian indices plus global cues. */
async function fetchHeadlineIndices() {
    const [indian, global] = await Promise.all([fetchIndianIndices(), fetchGlobalIndices()]);

    const wanted = new Map((indian || []).map((i) => [i.name.toUpperCase(), i]));
    const domestic = HEADLINE_INDICES.map((n) => wanted.get(n)).filter(Boolean);

    return { domestic, global: global || [] };
}

module.exports = {
    fetchIndianIndices, fetchGlobalIndices, fetchEquityPrice, fetchYahoo,
    findIndex, fetchHeadlineIndices, HEADLINE_INDICES,
};
