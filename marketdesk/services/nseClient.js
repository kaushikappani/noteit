/**
 * Thin NSE wrapper.
 *
 * Uses the stock-nse-india package for the actual HTTP because it manages the
 * cookie/user-agent handshake NSE requires. Deliberately does not import
 * middleware/StockScheduler.js — this module owns its own ingestion path so it
 * can be lifted out later.
 */

const crypto = require("crypto");
const moment = require("moment-timezone");
const { NseIndia } = require("stock-nse-india");
const { TIME_ZONE } = require("../config/settings");

const nse = new NseIndia();

const NSE_DATE = "DD-MM-YYYY";

// NSE is not consistent about this field across endpoints, so try each shape.
const AN_DT_FORMATS = [
    "DD-MMM-YYYY HH:mm:ss",
    "DD-MMM-YYYY HH:mm",
    "DD-MM-YYYY HH:mm:ss",
    "YYYY-MM-DD HH:mm:ss",
    moment.ISO_8601,
];

/**
 * Parse an NSE timestamp in exchange-local time.
 * @returns {Date|null} null when unparseable, so the caller can decide.
 */
function parseNseDate(value) {
    if (!value) return null;
    const parsed = moment.tz(String(value).trim(), AN_DT_FORMATS, TIME_ZONE);
    return parsed.isValid() ? parsed.toDate() : null;
}

const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");

/**
 * Stable identity for a filing.
 *
 * The attachment URL is the strongest signal — NSE embeds a timestamp in the
 * filename, so re-uploads get a new identity, which is what we want. Filings
 * with no attachment fall back to the description, and a filing whose timestamp
 * would not parse uses the day alone so that re-polling within the same day
 * still collapses to one record instead of one per poll.
 */
function fingerprintFiling(item, announcedAt) {
    const symbol = (item.symbol || "").trim().toUpperCase();
    const when = announcedAt
        ? announcedAt.toISOString()
        : moment().tz(TIME_ZONE).format("YYYY-MM-DD");
    const body = (item.attchmntFile || "").trim() || (item.desc || "").trim();
    return sha1(`${symbol}|${when}|${body}`);
}

function fingerprintAction(item) {
    const symbol = (item.symbol || "").trim().toUpperCase();
    return sha1([symbol, item.subject || "", item.exDate || "", item.recDate || ""].join("|"));
}

/**
 * Corporate announcements over a date window.
 * @param {{days?: number}} opts how far back to look; NSE caps this in practice.
 */
async function fetchAnnouncements({ days = 1 } = {}) {
    const to = moment().tz(TIME_ZONE);
    const from = to.clone().subtract(days, "days");
    const range = `from_date=${from.format(NSE_DATE)}&to_date=${to.format(NSE_DATE)}`;
    const data = await nse.getDataByEndpoint(
        `/api/corporate-announcements?index=equities&${range}&reqXbrl=false`
    );
    return Array.isArray(data) ? data : [];
}

/** Forward-looking corporate actions: ex-dates, dividends, board meetings. */
async function fetchCorporateActions({ weeksAhead = 4 } = {}) {
    const from = moment().tz(TIME_ZONE);
    const to = from.clone().add(weeksAhead, "weeks");
    const range = `from_date=${from.format(NSE_DATE)}&to_date=${to.format(NSE_DATE)}`;
    const data = await nse.getDataByEndpoint(
        `/api/corporates-corporateActions?index=equities&${range}`
    );
    return Array.isArray(data) ? data : [];
}

/** Latest quote for a symbol; null rather than throwing, so tools stay soft. */
async function fetchQuote(symbol) {
    try {
        const info = await nse.getEquityDetails(symbol);
        const p = info?.priceInfo;
        if (!p) return null;
        return {
            symbol,
            lastPrice: p.lastPrice,
            change: p.change,
            pChange: p.pChange,
            dayHigh: p.intraDayHighLow?.max,
            dayLow: p.intraDayHighLow?.min,
            yearHigh: p.weekHighLow?.max,
            yearLow: p.weekHighLow?.min,
            previousClose: p.previousClose,
        };
    } catch (err) {
        console.error(`[marketdesk/nse] quote failed for ${symbol}: ${err.message}`);
        return null;
    }
}

module.exports = {
    nse, parseNseDate, fingerprintFiling, fingerprintAction,
    fetchAnnouncements, fetchCorporateActions, fetchQuote,
};
