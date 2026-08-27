/**
 * Build one edition of the newspaper.
 *
 * Idempotent by construction: the {date, slot} unique index means the claim
 * below either wins or finds an existing edition, so a restart at 08:00, a
 * double scheduler tick and a manual rebuild all converge on one document.
 * Delivery is a separate job (deliverEdition.js) so that building again never
 * re-sends, and re-sending never rebuilds.
 */

const moment = require("moment-timezone");

const { TIME_ZONE, env } = require("../config/settings");
const { getSettings } = require("../config/runtime");
const { getProvider } = require("../llm");
const { parseJsonLoose, asArray } = require("../llm/json");
const { buildRegistry, TOOL_SETS } = require("../agent/tools");
const { runAgent } = require("../agent/loop");
const { mapWithConcurrency } = require("../agent/guards");
const {
    SNAPSHOT_SCHEMA, MARKET_SCHEMA, snapshotSystem, marketSystem,
    snapshotTask, marketTask,
} = require("../services/prompts");
const { renderEdition } = require("../services/editionRenderer");
const {
    MdEdition, MdFiling, MdWatchlist, MdCompanySnapshot, MdCorporateAction,
} = require("../models");

/** Which slot a moment belongs to: before the PM hour is still the AM edition. */
function slotFor(when, schedule) {
    return when.hour() < (schedule?.pmHour ?? 20) ? "AM" : "PM";
}

function resolveTarget({ date, slot }, settings) {
    const now = moment().tz(TIME_ZONE);
    return {
        date: date && date !== "today" ? date : now.format("YYYY-MM-DD"),
        slot: slot || slotFor(now, settings.schedule),
    };
}

/**
 * Everything since the previous edition, so the two daily editions do not both
 * report the same filings.
 *
 * Two different situations, and they want different answers:
 *
 * - Steady state: start from the previous edition's build time, capped at 14
 *   hours so a long gap in editions cannot dump a week of filings into one page.
 * - Very first edition: there is nothing to be "since". A 14-hour window would
 *   silently drop filings that were just ingested — including the whole previous
 *   trading day — and produce a near-empty first paper. Reach back further so the
 *   first edition reflects what is actually on record.
 */
async function windowStart(date, slot) {
    const previous = await MdEdition.findOne({
        status: "ready",
        $or: [{ date: { $lt: date } }, { date, slot: { $ne: slot } }],
    }).sort({ date: -1, builtAt: -1 }).lean();

    const now = moment().tz(TIME_ZONE);

    if (!previous?.builtAt) {
        console.log("[marketdesk] no previous edition — widening the window to 4 days");
        return now.clone().subtract(4, "days").toDate();
    }

    const cap = now.clone().subtract(14, "hours").toDate();
    return previous.builtAt < cap ? previous.builtAt : cap;
}

/** Active watchlist entries. */
async function activeWatchlist() {
    const doc = await MdWatchlist.findOne({ key: "default" }).lean();
    return (doc?.symbols || []).filter((s) => s.active !== false);
}

const sumUsage = (into, usage = {}) => {
    into.inputTokens += usage.inputTokens || 0;
    into.outputTokens += usage.outputTokens || 0;
    into.costUsd += usage.costUsd || 0;
    return into;
};

/**
 * One company's entry.
 *
 * A company with no new filings costs nothing: its previous snapshot is carried
 * forward marked stale. Across a 30-name watchlist on a quiet day that is the
 * difference between one LLM call and thirty.
 */
async function buildCompanySnapshot({
    entry, filings, edition, provider, registry, settings, slot, asOf,
}) {
    const { symbol } = entry;

    if (!filings.length) {
        const previous = await MdCompanySnapshot.findOne({ symbol })
            .sort({ asOf: -1 }).lean();
        if (!previous) return null;

        const carried = await MdCompanySnapshot.findOneAndUpdate(
            { editionId: edition._id, symbol },
            {
                $set: {
                    symbol, editionId: edition._id, asOf,
                    headline: previous.headline,
                    bullets: previous.bullets,
                    risks: previous.risks,
                    filingsDigest: previous.filingsDigest,
                    newsDigest: previous.newsDigest,
                    citations: previous.citations,
                    sentiment: previous.sentiment,
                    materialityTop: 0,
                    stale: true,
                    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
                },
            },
            { upsert: true, new: true }
        );
        // Plain object, so both branches of this function return the same shape.
        return carried.toObject();
    }

    const result = await runAgent({
        provider,
        registry,
        system: snapshotSystem(),
        task: snapshotTask({
            symbol,
            companyName: entry.name,
            slot,
            filings,
            charsPerFiling: settings.limits.summaryCharsPerFiling,
        }),
        toolNames: TOOL_SETS.companySnapshot,
        responseFormat: { json: SNAPSHOT_SCHEMA },
        tier: "balanced",
        maxIterations: settings.limits.maxIterations,
        toolTimeoutMs: settings.limits.toolTimeoutMs,
        runTimeoutMs: settings.limits.runTimeoutMs,
        maxUsd: env.maxUsdPerRun,
        editionId: edition._id,
        purpose: `companySnapshot:${symbol}`,
    });

    // A model that returned nothing usable should not sink the company entirely —
    // fall back to the filing headlines we already have on record.
    const parsed = parseJsonLoose(result.text, {
        fallback: {
            headline: filings[0].desc,
            bullets: filings.slice(0, 3).map((f) => f.summary || f.desc).filter(Boolean),
            sentiment: filings[0].sentiment || "neutral",
        },
    });

    const doc = await MdCompanySnapshot.findOneAndUpdate(
        { editionId: edition._id, symbol },
        {
            $set: {
                symbol,
                editionId: edition._id,
                asOf,
                headline: String(parsed.headline || filings[0].desc || symbol).slice(0, 300),
                bullets: asArray(parsed.bullets, 6),
                risks: asArray(parsed.risks, 4),
                newsDigest: parsed.newsDigest || "",
                filingsDigest: filings
                    .map((f) => `${f.desc} (${f.materiality}/100)`)
                    .join("; ")
                    .slice(0, 2000),
                citations: (result.citations || []).slice(0, 10),
                sentiment: ["positive", "negative", "neutral"].includes(parsed.sentiment)
                    ? parsed.sentiment
                    : "neutral",
                materialityTop: Math.max(...filings.map((f) => f.materiality || 0)),
                filingIds: filings.map((f) => f._id),
                stale: false,
                usage: result.usage,
            },
        },
        { upsert: true, new: true }
    );

    return { ...doc.toObject(), traceId: result.traceId };
}

/** The market-wide front page. */
/**
 * Keep only citations that could plausibly describe the current session.
 *
 * Search returns stale pages readily -- a query about today came back with
 * articles from the previous October and a year-ahead forecast. Undated
 * results are kept, since most publishers omit the field and dropping them
 * would empty the list; anything with a date older than the window goes.
 */
function freshCitations(citations = [], maxAgeDays = 10) {
    const cutoff = Date.now() - maxAgeDays * 86400000;
    const kept = citations.filter((c) => {
        if (!c?.published) return true;
        const at = Date.parse(c.published);
        return Number.isNaN(at) ? true : at >= cutoff;
    });
    const dropped = citations.length - kept.length;
    if (dropped > 0) {
        console.warn(
            "[marketdesk] dropped " + dropped + " citation(s) older than " + maxAgeDays + " days"
        );
    }
    return kept;
}

/** Loose match between a model-written index label and a symbol we fetched. */
function namesMatch(label, symbol) {
    const a = String(label || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const b = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!a || !b) return false;
    return a.includes(b) || b.includes(a);
}

async function buildMarketBrief({
    edition, provider, registry, settings, slot, dateLabel, headlines,
}) {
    // Collects what the tools actually returned, so the model's output can be
    // checked against reality rather than trusted.
    const facts = { prices: new Map(), sourced: 0 };

    const result = await runAgent({
        ctx: { facts },
        provider,
        registry,
        system: marketSystem(),
        task: marketTask({ slot, dateLabel, topics: settings.marketTopics, headlines }),
        toolNames: TOOL_SETS.marketBrief,
        responseFormat: { json: MARKET_SCHEMA },
        tier: "deep",
        maxIterations: settings.limits.maxIterations,
        toolTimeoutMs: settings.limits.toolTimeoutMs,
        runTimeoutMs: settings.limits.runTimeoutMs,
        maxUsd: env.maxUsdPerRun,
        editionId: edition._id,
        purpose: "marketBrief",
    });

    const parsed = parseJsonLoose(result.text, {
        fallback: { headline: "Market brief unavailable", points: [], indices: [] },
    });

    // asArray copes with a model that returns one blob instead of a list.
    const points = asArray(parsed.points, 10);

    const claimed = Array.isArray(parsed.indices)
        ? parsed.indices.slice(0, 10).map((i) => ({
            name: String(i.name || "").slice(0, 60),
            value: String(i.value ?? "").slice(0, 40),
            change: String(i.change ?? "").slice(0, 40),
        }))
        : [];

    // Keep only levels backed by a quote we actually fetched. A model asked for
    // index levels will supply them from training data when every lookup failed:
    // one run published Nifty, Sensex, Brent and USDINR to four significant
    // figures on the back of eight consecutive tool failures. Dropping unbacked
    // numbers is the only reliable guard - the prompt already forbids it.
    const indices = claimed.filter((i) =>
        [...facts.prices.keys()].some((symbol) => namesMatch(i.name, symbol)));

    const dropped = claimed.length - indices.length;
    if (dropped > 0) {
        console.warn(
            `[marketdesk] dropped ${dropped} index level(s) with no fetched quote behind them`
        );
    }

    // Nothing fetched at all means the prose is unsourced too, not just the
    // numbers. Flag it so the edition can say so rather than reading as reporting.
    const unsourced = facts.prices.size === 0 && facts.sourced === 0;

    return {
        headline: parsed.headline || "",
        points,
        // Kept populated so anything still reading marketBrief - an old edition
        // in the archive, a mail client - has something sensible to show.
        brief: points.join("\n\n"),
        themes: asArray(parsed.themes, 6),
        indices,
        unsourced,
        citations: freshCitations(result.citations || []),
        usage: result.usage,
        traceId: result.traceId,
    };
}

/**
 * @param {{date?:string, slot?:"AM"|"PM", force?:boolean, dryRun?:boolean}} opts
 * @returns {Promise<{edition:object, skipped?:boolean}>}
 */
async function buildEdition({ date, slot, force = false, dryRun = false } = {}) {
    const settings = await getSettings({ fresh: true });
    const target = resolveTarget({ date, slot }, settings);
    const startedAt = Date.now();

    // Claim the slot. Whoever loses this race gets the winner's document rather
    // than a second edition, which is the whole point of the unique index.
    let edition = await MdEdition.findOneAndUpdate(
        { date: target.date, slot: target.slot },
        { $setOnInsert: { date: target.date, slot: target.slot, status: "building" } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (edition.status === "ready" && !force) {
        console.log(`[marketdesk] edition ${target.date} ${target.slot} already built`);
        return { edition: edition.toObject(), skipped: true };
    }
    if (force) {
        // Clearing the delivery stamps is the point, not a side effect.
        //
        // deliverEdition() is idempotent per channel: a channel with a sentAt is
        // skipped, so that a retry after a half-failed delivery cannot send the
        // email twice. But a forced rebuild replaces the edition's CONTENT, and
        // the stamps left over from the previous build then suppress delivery of
        // the new one entirely — you press rebuild, the newspaper changes, and no
        // mail arrives. Resetting them here says "nothing has been sent for this
        // edition as it now stands", which is exactly true.
        //
        // Safe against a failed rebuild: status goes to "building" in the same
        // update, and deliverEdition() refuses anything that is not "ready", so a
        // build that dies cannot trigger a send off the cleared stamps.
        await MdEdition.updateOne(
            { _id: edition._id },
            { $set: { status: "building", error: null }, $unset: { delivery: "" } }
        );
    }

    try {
        const provider = getProvider({ models: settings.models });
        const registry = buildRegistry({ provider });
        const asOf = new Date();
        const since = await windowStart(target.date, target.slot);
        const watchlist = await activeWatchlist();

        console.log(
            `[marketdesk] building ${target.date} ${target.slot}: ` +
            `${watchlist.length} companies, filings since ${since.toISOString()}`
        );

        // One query for the whole window, grouped in memory — cheaper than a
        // find() per company and it keeps the per-company cap in one place.
        const filings = await MdFiling.find({
            symbol: { $in: watchlist.map((w) => w.symbol) },
            status: "summarized",
            announcedAt: { $gte: since },
        }).sort({ materiality: -1, announcedAt: -1 }).lean();

        const byCompany = new Map();
        for (const filing of filings) {
            const bucket = byCompany.get(filing.symbol) || [];
            if (bucket.length < settings.limits.filingsPerCompany) {
                bucket.push(filing);
                byCompany.set(filing.symbol, bucket);
            }
        }

        const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
        const agentRunIds = [];

        const snapshots = await mapWithConcurrency(
            watchlist,
            settings.limits.companyConcurrency,
            (entry) => buildCompanySnapshot({
                entry,
                filings: byCompany.get(entry.symbol) || [],
                edition, provider, registry, settings, slot: target.slot, asOf,
            })
        );

        const companyRefs = [];
        for (const snapshot of snapshots) {
            if (!snapshot) continue;
            sumUsage(usage, snapshot.usage);
            if (snapshot.traceId) agentRunIds.push(snapshot.traceId);
            companyRefs.push({
                symbol: snapshot.symbol,
                snapshotId: snapshot._id,
                materiality: snapshot.materialityTop || 0,
                sentiment: snapshot.sentiment,
                headline: snapshot.headline,
                stale: !!snapshot.stale,
            });
        }

        // Most material first; stale carry-forwards sink to the bottom.
        companyRefs.sort((a, b) =>
            (b.materiality - a.materiality) || Number(a.stale) - Number(b.stale));

        const headlines = filings
            .slice(0, 10)
            .map((f) => `${f.symbol}: ${f.desc} (${f.materiality}/100)`);

        const market = await buildMarketBrief({
            edition, provider, registry, settings,
            slot: target.slot,
            dateLabel: moment.tz(target.date, "YYYY-MM-DD", TIME_ZONE).format("dddd, D MMMM YYYY"),
            headlines,
        });
        sumUsage(usage, market.usage);
        if (market.traceId) agentRunIds.push(market.traceId);

        const calendar = await MdCorporateAction.find({
            symbol: { $in: watchlist.map((w) => w.symbol) },
            exDate: { $gte: new Date(), $lte: new Date(Date.now() + 21 * 86400000) },
        }).sort({ exDate: 1 }).limit(30).lean();

        const payload = {
            date: target.date,
            slot: target.slot,
            status: "ready",
            builtAt: new Date(),
            marketBrief: market.brief,
            marketPoints: market.points,
            marketHeadline: market.headline,
            marketThemes: market.themes,
            marketCitations: market.citations.slice(0, 12),
            indices: market.indices,
            marketBriefUnsourced: market.unsourced,
            companyRefs,
            calendar: calendar.map((c) => ({
                symbol: c.symbol, subject: c.subject,
                exDate: c.exDate, recordDate: c.recordDate,
            })),
            usage,
            agentRunIds,
            error: null,
        };

        payload.html = renderEdition({
            ...payload,
            snapshots: snapshots.filter(Boolean),
        });

        if (dryRun) {
            console.log(`[marketdesk] dry run — nothing saved. cost $${usage.costUsd.toFixed(4)}`);
            return { edition: { ...edition.toObject(), ...payload }, dryRun: true };
        }

        edition = await MdEdition.findOneAndUpdate(
            { _id: edition._id }, { $set: payload }, { new: true }
        );

        console.log(
            `[marketdesk] edition ${target.date} ${target.slot} ready in ` +
            `${Math.round((Date.now() - startedAt) / 1000)}s, ` +
            `${companyRefs.length} companies, $${usage.costUsd.toFixed(4)}`
        );
        return { edition: edition.toObject() };
    } catch (err) {
        await MdEdition.updateOne({ _id: edition._id }, {
            $set: { status: "failed", error: String(err.message || err).slice(0, 1000) },
        });
        throw err;
    }
}

module.exports = { buildEdition, slotFor, resolveTarget };
