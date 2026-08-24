/**
 * Runtime settings: the MdConfig document merged over the shipped defaults.
 *
 * Cached briefly so the 10-minute ingest and the edition build do not each hit
 * Mongo for settings on every filing.
 */

const { CONFIG_DEFAULTS } = require("./settings");
const { MdConfig } = require("../models");

const TTL_MS = 30000;
let cache = null;
let cachedAt = 0;

/** Shallow-merge one level deep, which is all the config shape needs. */
function merge(defaults, doc) {
    if (!doc) return { ...defaults };
    const out = { ...defaults };
    for (const [key, value] of Object.entries(defaults)) {
        const incoming = doc[key];
        if (incoming === undefined || incoming === null) continue;
        if (Array.isArray(value)) {
            out[key] = incoming.length ? incoming : value;
        } else if (value && typeof value === "object") {
            out[key] = { ...value };
            for (const [k, v] of Object.entries(value)) {
                const iv = incoming[k];
                if (iv !== undefined && iv !== null) out[key][k] = iv;
            }
        } else {
            out[key] = incoming;
        }
    }
    return out;
}

async function getSettings({ fresh = false } = {}) {
    if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
    let doc = null;
    try {
        doc = await MdConfig.findOne({ key: "settings" }).lean();
    } catch (err) {
        // Settings are a convenience; a database hiccup must not stop a run.
        console.error("[marketdesk] could not read settings, using defaults:", err.message);
    }
    cache = merge(CONFIG_DEFAULTS, doc);
    cachedAt = Date.now();
    return cache;
}

async function saveSettings(patch, updatedBy) {
    const doc = await MdConfig.findOneAndUpdate(
        { key: "settings" },
        { $set: { ...patch, key: "settings", updatedBy } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    cache = null;
    return merge(CONFIG_DEFAULTS, doc);
}

const invalidate = () => { cache = null; };

module.exports = { getSettings, saveSettings, invalidate };
