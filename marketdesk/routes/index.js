/**
 * MarketDesk HTTP API.
 *
 * Every route is admin-gated except /cron/run, which is token-gated because an
 * external pinger has no session cookie. Handlers stay thin — orchestration
 * lives in jobs/, so the same work is reachable from the scheduler and the CLIs.
 */

const express = require("express");
const asyncHandler = require("express-async-handler");

const { adminProtect, cronProtect } = require("../middleware/adminProtect");
const { getSettings, saveSettings } = require("../config/runtime");
const {
    MdEdition, MdCompanySnapshot, MdFiling, MdWatchlist, MdAgentRun,
    MdCorporateAction,
} = require("../models");

const router = express.Router();

/* ---- editions ----------------------------------------------------------- */

router.get("/editions", adminProtect, asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const editions = await MdEdition.find({})
        .sort({ date: -1, slot: -1 })
        .limit(limit)
        // The rendered HTML is large and never needed in a list.
        .select("-html -companyRefs -calendar")
        .lean();
    res.json({ count: editions.length, editions });
}));

router.get("/editions/latest", adminProtect, asyncHandler(async (req, res) => {
    const edition = await MdEdition.findOne({ status: "ready" })
        .sort({ date: -1, builtAt: -1 }).lean();
    if (!edition) return res.status(404).json({ message: "no edition has been built yet" });

    const snapshots = await MdCompanySnapshot.find({ editionId: edition._id }).lean();
    res.json({ edition, snapshots });
}));

router.get("/editions/:date/:slot", adminProtect, asyncHandler(async (req, res) => {
    const { date, slot } = req.params;
    const edition = await MdEdition.findOne({ date, slot: slot.toUpperCase() }).lean();
    if (!edition) return res.status(404).json({ message: "edition not found" });

    const snapshots = await MdCompanySnapshot.find({ editionId: edition._id }).lean();
    res.json({ edition, snapshots });
}));

/** The email HTML, handy for previewing exactly what was sent. */
router.get("/editions/:date/:slot/html", adminProtect, asyncHandler(async (req, res) => {
    const { date, slot } = req.params;
    const edition = await MdEdition.findOne({ date, slot: slot.toUpperCase() })
        .select("html").lean();
    if (!edition?.html) return res.status(404).send("not built");
    res.type("html").send(edition.html);
}));

router.post("/editions/build", adminProtect, asyncHandler(async (req, res) => {
    const { buildEdition } = require("../jobs/buildEdition");
    const { deliverEdition } = require("../jobs/deliverEdition");
    const { date, slot, force, deliver = true, dryRun } = req.body || {};

    const result = await buildEdition({ date, slot, force: !!force, dryRun: !!dryRun });
    let delivery = null;
    if (deliver && !dryRun && !result.skipped) {
        // force flows through to delivery as well. A forced rebuild replaces the
        // edition's content, so the previous build's per-channel sentAt stamps
        // must not suppress sending the new one — otherwise pressing rebuild
        // changes the newspaper and silently mails nobody.
        delivery = await deliverEdition(result.edition._id, { force: !!force });
    }
    res.json({ ...result, delivery });
}));

router.post("/editions/:id/deliver", adminProtect, asyncHandler(async (req, res) => {
    const { deliverEdition } = require("../jobs/deliverEdition");
    const delivery = await deliverEdition(req.params.id, {
        force: !!req.body?.force,
        only: req.body?.only,
    });
    res.json({ delivery });
}));

/* ---- screener + companies ----------------------------------------------- */

/**
 * The screener grid. Reads the latest ready edition's company refs so the table
 * matches the newspaper exactly, rather than recomputing a second ranking.
 */
/**
 * The screener grid.
 *
 * Returns every active watchlist company, not only the ones an edition covered.
 * A company with no filings still needs a row, because that row is the only way
 * to reach its page — and "nothing filed" is itself information.
 */
router.get("/companies", adminProtect, asyncHandler(async (req, res) => {
    const edition = await MdEdition.findOne({ status: "ready" })
        .sort({ date: -1, builtAt: -1 })
        .select("date slot builtAt companyRefs")
        .lean();

    const watchlist = await MdWatchlist.findOne({ key: "default" }).lean();
    const active = (watchlist?.symbols || []).filter((s) => s.active !== false);

    const covered = new Map();
    if (edition) {
        const snapshots = await MdCompanySnapshot.find({ editionId: edition._id })
            .select("symbol headline bullets sentiment materialityTop stale")
            .lean();
        const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));
        for (const ref of edition.companyRefs || []) {
            covered.set(ref.symbol, { ref, snapshot: bySymbol.get(ref.symbol) });
        }
    }

    // Latest filing per company, so an uncovered row can still say something
    // useful rather than just sitting blank.
    const symbols = active.map((s) => s.symbol);
    const latestFilings = await MdFiling.aggregate([
        { $match: { symbol: { $in: symbols } } },
        { $sort: { announcedAt: -1 } },
        {
            $group: {
                _id: "$symbol",
                desc: { $first: "$desc" },
                announcedAt: { $first: "$announcedAt" },
                materiality: { $first: "$materiality" },
                sentiment: { $first: "$sentiment" },
                count: { $sum: 1 },
            },
        },
    ]);
    const filingBySymbol = new Map(latestFilings.map((f) => [f._id, f]));

    const rows = active.map((entry) => {
        const hit = covered.get(entry.symbol);
        const latest = filingBySymbol.get(entry.symbol);

        return {
            symbol: entry.symbol,
            name: entry.name,
            sector: entry.sector,
            tags: entry.tags || [],

            // In this edition?
            covered: !!hit && !hit.ref.stale,
            stale: !!hit?.ref?.stale,

            materiality: hit?.ref?.materiality ?? latest?.materiality ?? 0,
            sentiment: hit?.ref?.sentiment || latest?.sentiment || null,
            headline: hit?.ref?.headline || latest?.desc || null,
            bullets: hit?.snapshot?.bullets || [],

            filingCount: latest?.count || 0,
            lastFilingAt: latest?.announcedAt || null,
        };
    });

    res.json({
        edition: edition
            ? { date: edition.date, slot: edition.slot, builtAt: edition.builtAt }
            : null,
        count: rows.length,
        rows,
    });
}));

router.get("/companies/:symbol", adminProtect, asyncHandler(async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    const [snapshots, filings, actions] = await Promise.all([
        MdCompanySnapshot.find({ symbol }).sort({ asOf: -1 }).limit(10).lean(),
        MdFiling.find({ symbol }).sort({ announcedAt: -1 }).limit(30).lean(),
        MdCorporateAction.find({ symbol, exDate: { $gte: new Date() } })
            .sort({ exDate: 1 }).limit(10).lean(),
    ]);

    const watchlist = await MdWatchlist.findOne({ key: "default" }).lean();
    const entry = (watchlist?.symbols || []).find((s) => s.symbol === symbol);

    res.json({
        symbol,
        meta: entry || { symbol },
        latest: snapshots[0] || null,
        history: snapshots.slice(1),
        filings,
        calendar: actions,
    });
}));

router.get("/companies/:symbol/filings", adminProtect, asyncHandler(async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Number(req.query.skip) || 0;

    const [filings, total] = await Promise.all([
        MdFiling.find({ symbol }).sort({ announcedAt: -1 }).skip(skip).limit(limit).lean(),
        MdFiling.countDocuments({ symbol }),
    ]);
    res.json({ symbol, total, skip, count: filings.length, filings });
}));

/* ---- watchlist + config ------------------------------------------------- */

router.get("/watchlist", adminProtect, asyncHandler(async (req, res) => {
    const doc = await MdWatchlist.findOne({ key: "default" }).lean();
    res.json({ symbols: doc?.symbols || [], updatedAt: doc?.updatedAt || null });
}));

router.put("/watchlist", adminProtect, asyncHandler(async (req, res) => {
    const incoming = Array.isArray(req.body?.symbols) ? req.body.symbols : null;
    if (!incoming) return res.status(400).json({ message: "symbols must be an array" });

    // Normalise here so the rest of the module can assume uppercase and unique.
    const seen = new Set();
    const symbols = incoming
        .map((s) => (typeof s === "string" ? { symbol: s } : s || {}))
        .map((s) => ({
            symbol: String(s.symbol || "").trim().toUpperCase(),
            name: s.name ? String(s.name).trim() : undefined,
            sector: s.sector ? String(s.sector).trim() : undefined,
            tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
            active: s.active !== false,
        }))
        .filter((s) => s.symbol && !seen.has(s.symbol) && seen.add(s.symbol))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));

    const doc = await MdWatchlist.findOneAndUpdate(
        { key: "default" },
        { $set: { key: "default", symbols, updatedBy: req.user.email } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ symbols: doc.symbols, count: doc.symbols.length });
}));

/** Seed or top up the watchlist from the caller's own portfolio. */
router.post("/watchlist/seed", adminProtect, asyncHandler(async (req, res) => {
    const { symbolQuantityObject } = require("../../routes/data");
    const portfolio = await symbolQuantityObject(req.user._id);
    const fromPortfolio = Object.keys(portfolio).map((s) => s.trim().toUpperCase());

    const doc = await MdWatchlist.findOne({ key: "default" });
    const known = new Map((doc?.symbols || []).map((s) => [s.symbol.toUpperCase(), s]));

    let added = 0;
    for (const symbol of fromPortfolio) {
        if (known.has(symbol)) continue;
        known.set(symbol, { symbol, active: true, tags: ["portfolio"] });
        added++;
    }
    const symbols = [...known.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));

    await MdWatchlist.findOneAndUpdate(
        { key: "default" },
        { $set: { key: "default", symbols, updatedBy: req.user.email } },
        { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ added, count: symbols.length, symbols });
}));

router.get("/config", adminProtect, asyncHandler(async (req, res) => {
    res.json(await getSettings({ fresh: true }));
}));

router.put("/config", adminProtect, asyncHandler(async (req, res) => {
    // Whitelisted so a stray key cannot quietly become part of the config shape.
    const allowed = [
        "schedule", "materialityAlertThreshold", "marketTopics",
        "recipients", "telegramIds", "enabled", "limits", "models",
    ];
    const patch = {};
    for (const key of allowed) {
        if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    if (!Object.keys(patch).length) {
        return res.status(400).json({ message: `nothing to update; allowed keys: ${allowed.join(", ")}` });
    }

    const settings = await saveSettings(patch, req.user.email);

    // Schedule changes only take effect once the rules are rebuilt.
    if (patch.schedule) {
        const { stopScheduler, startScheduler } = require("../scheduler");
        stopScheduler();
        await startScheduler();
    }
    res.json(settings);
}));

/* ---- diagnostics ------------------------------------------------------- */

router.get("/runs/:id", adminProtect, asyncHandler(async (req, res) => {
    const run = await MdAgentRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ message: "run not found" });
    res.json(run);
}));

router.get("/runs", adminProtect, asyncHandler(async (req, res) => {
    const runs = await MdAgentRun.find(req.query.editionId ? { editionId: req.query.editionId } : {})
        .sort({ createdAt: -1 }).limit(50)
        .select("-iterations")
        .lean();
    res.json({ count: runs.length, runs });
}));

router.get("/status", adminProtect, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const [filings, pending, editions, latest, watchlist] = await Promise.all([
        MdFiling.countDocuments({}),
        MdFiling.countDocuments({ status: { $in: ["new", "failed"] } }),
        MdEdition.countDocuments({}),
        MdEdition.findOne({ status: "ready" }).sort({ date: -1, builtAt: -1 })
            .select("date slot builtAt usage delivery").lean(),
        MdWatchlist.findOne({ key: "default" }).select("symbols").lean(),
    ]);

    res.json({
        provider: require("../config/settings").env.provider,
        searchProvider: require("../config/settings").env.searchProvider,
        watchlistCount: (watchlist?.symbols || []).filter((s) => s.active !== false).length,
        filings, pendingAnalysis: pending, editions,
        latestEdition: latest,
        schedule: settings.schedule,
        enabled: settings.enabled,
        mailerConfigured: !!process.env.MAILER_API_KEY,
    });
}));

/* ---- ingest + external trigger ----------------------------------------- */

router.post("/ingest", adminProtect, asyncHandler(async (req, res) => {
    const { ingestTick } = require("../jobs/ingestFilings");
    res.json(await ingestTick({
        days: Number(req.body?.days) || 1,
        analyzeLimit: Number(req.body?.analyzeLimit ?? 5),
    }));
}));

/**
 * External trigger, for when the host is asleep at 08:00 and the in-process rule
 * never fires. Responds immediately: a pinger should not hold a connection open
 * for the length of an edition build.
 */
router.post("/cron/run", cronProtect, (req, res) => {
    const { runEdition, runIngest } = require("../scheduler");
    const slot = String(req.query.slot || req.body?.slot || "").toUpperCase();
    const task = slot === "AM" || slot === "PM"
        ? runEdition(slot)
        : runIngest();

    res.status(202).json({ accepted: true, task: slot || "ingest" });
    task.catch((err) => console.error("[marketdesk] cron task failed:", err.message));
});

module.exports = router;
