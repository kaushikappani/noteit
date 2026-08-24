/**
 * The cheap, frequent half of the pipeline: poll NSE, store what is new.
 *
 * NSE only serves a rolling window, so the same filing comes back on every poll.
 * The unique index on MdFiling.fingerprint is what makes that harmless — an
 * upsert with $setOnInsert either creates the record or does nothing at all.
 */

const {
    fetchAnnouncements, parseNseDate, fingerprintFiling,
} = require("../services/nseClient");
const { summarizePending } = require("../services/filingAnalysis");
const { getSettings } = require("../config/runtime");
const { MdFiling, MdWatchlist } = require("../models");

/** Active watchlist symbols as an uppercase Set. */
async function watchlistSymbols() {
    const doc = await MdWatchlist.findOne({ key: "default" }).lean();
    const symbols = (doc?.symbols || [])
        .filter((s) => s.active !== false)
        .map((s) => String(s.symbol).trim().toUpperCase());
    return new Set(symbols);
}

/**
 * Fetch the NSE window and upsert anything on the watchlist.
 * @returns {Promise<{fetched:number, matched:number, inserted:number, existing:number}>}
 */
async function ingestFilings({ days = 1 } = {}) {
    const [items, symbols] = await Promise.all([
        fetchAnnouncements({ days }),
        watchlistSymbols(),
    ]);

    if (!symbols.size) {
        console.warn("[marketdesk] watchlist is empty — run scripts/seed-watchlist.js");
        return { fetched: items.length, matched: 0, inserted: 0, existing: 0 };
    }

    const matched = items.filter((i) =>
        symbols.has(String(i.symbol || "").trim().toUpperCase()));

    if (!matched.length) return { fetched: items.length, matched: 0, inserted: 0, existing: 0 };

    const ops = matched.map((item) => {
        const announcedAt = parseNseDate(item.an_dt) || parseNseDate(item.sort_date) || new Date();
        const fingerprint = fingerprintFiling(item, announcedAt);
        return {
            updateOne: {
                filter: { fingerprint },
                update: {
                    $setOnInsert: {
                        fingerprint,
                        symbol: String(item.symbol).trim().toUpperCase(),
                        desc: item.desc || "",
                        attachmentUrl: item.attchmntFile || "",
                        attachmentText: item.attchmntText || "",
                        announcedAt,
                        source: "NSE",
                        status: "new",
                        attempts: 0,
                        raw: {
                            companyName: item.sm_name,
                            industry: item.smIndustry,
                            isin: item.sm_isin,
                            seqId: item.seq_id,
                        },
                    },
                },
                upsert: true,
            },
        };
    });

    // ordered:false so one duplicate-key race cannot abort the rest of the batch.
    const result = await MdFiling.bulkWrite(ops, { ordered: false });
    const inserted = result.upsertedCount || 0;

    return {
        fetched: items.length,
        matched: matched.length,
        inserted,
        existing: matched.length - inserted,
    };
}

/**
 * One scheduler tick: ingest, then analyse a bounded slice of the backlog.
 * Alerting for high-materiality filings is handled by services/alerts.js.
 */
async function ingestTick({ days = 1, analyzeLimit = 5 } = {}) {
    const settings = await getSettings();
    const ingested = await ingestFilings({ days });
    const analyzed = await summarizePending({ limit: analyzeLimit, settings });

    const { sendMaterialityAlerts } = require("../services/alerts");
    const alerted = await sendMaterialityAlerts({ settings });

    console.log(
        `[marketdesk] ingest fetched=${ingested.fetched} matched=${ingested.matched} ` +
        `new=${ingested.inserted} analyzed=${analyzed.processed} alerted=${alerted.sent}`
    );
    return { ingested, analyzed, alerted };
}

module.exports = { ingestFilings, ingestTick, watchlistSymbols };
