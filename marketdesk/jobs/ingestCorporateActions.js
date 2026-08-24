/**
 * Forward-looking corporate actions for the calendar panel.
 *
 * Same upsert-on-fingerprint pattern as filings, so this is safe to run as often
 * as the scheduler likes.
 */

const {
    fetchCorporateActions, parseNseDate, fingerprintAction,
} = require("../services/nseClient");
const { MdCorporateAction } = require("../models");
const { watchlistSymbols } = require("./ingestFilings");

async function ingestCorporateActions({ weeksAhead = 4 } = {}) {
    const [items, symbols] = await Promise.all([
        fetchCorporateActions({ weeksAhead }),
        watchlistSymbols(),
    ]);

    const matched = items.filter((i) =>
        symbols.has(String(i.symbol || "").trim().toUpperCase()));

    if (!matched.length) return { fetched: items.length, matched: 0, inserted: 0 };

    const ops = matched.map((item) => {
        const fingerprint = fingerprintAction(item);
        return {
            updateOne: {
                filter: { fingerprint },
                update: {
                    $set: {
                        fingerprint,
                        symbol: String(item.symbol).trim().toUpperCase(),
                        subject: item.subject || "",
                        purpose: item.purpose || item.subject || "",
                        // Ex-dates get revised, so unlike filings these are $set
                        // rather than $setOnInsert.
                        exDate: parseNseDate(item.exDate),
                        recordDate: parseNseDate(item.recDate),
                        faceValue: item.faceVal ? String(item.faceVal) : undefined,
                        raw: { comp: item.comp, series: item.series },
                    },
                },
                upsert: true,
            },
        };
    });

    const result = await MdCorporateAction.bulkWrite(ops, { ordered: false });
    return {
        fetched: items.length,
        matched: matched.length,
        inserted: result.upsertedCount || 0,
        updated: result.modifiedCount || 0,
    };
}

module.exports = { ingestCorporateActions };
