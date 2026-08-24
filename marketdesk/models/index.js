/**
 * MarketDesk's own mongoose models.
 *
 * Every collection is named md_* explicitly rather than letting mongoose
 * pluralise the model name: it keeps the module's data visually grouped in the
 * database, makes it greppable, and means the whole feature can be dropped or
 * exported with one prefix match when it moves to its own project.
 *
 * Nothing here touches an existing collection. The host app's User and Portfolio
 * are read from elsewhere (seeding, recipient lookup) but never written.
 */

const mongoose = require("mongoose");

/** Re-registering a model throws; scripts and the server can both load this file. */
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

/* ---- watchlist ---------------------------------------------------------- */

const watchlistSchema = new mongoose.Schema({
    key: { type: String, default: "default", unique: true },
    symbols: [{
        _id: false,
        symbol: { type: String, required: true },
        name: String,
        sector: String,
        tags: [String],
        active: { type: Boolean, default: true },
    }],
    updatedBy: String,
}, { timestamps: true, collection: "md_watchlist" });

/* ---- filings ------------------------------------------------------------ */

const filingSchema = new mongoose.Schema({
    symbol: { type: String, required: true, index: true },
    desc: String,
    attachmentUrl: String,
    attachmentText: String,
    announcedAt: { type: Date, required: true },

    // sha1(symbol|announcedAt|attachmentUrl||desc). The unique index on this is
    // what makes the rolling 24h NSE window safe to re-poll every 10 minutes.
    fingerprint: { type: String, required: true, unique: true },
    source: { type: String, default: "NSE" },

    // new -> summarized, or -> failed (retried) -> skipped (gave up)
    status: {
        type: String,
        enum: ["new", "summarized", "failed", "skipped"],
        default: "new",
        index: true,
    },
    summary: String,
    sentiment: { type: String, enum: ["positive", "negative", "neutral"] },
    materiality: { type: Number, min: 0, max: 100 },
    materialityReason: String,

    attempts: { type: Number, default: 0 },
    lastError: String,
    model: String,
    /** Whether the summary came from the PDF or fell back to NSE metadata. */
    textSource: { type: String, enum: ['pdf', 'metadata', 'none'] },

    /** Set once an alert has gone out, so a materiality alert can never repeat. */
    alertedAt: Date,

    raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true, collection: "md_filings" });

filingSchema.index({ symbol: 1, announcedAt: -1 });
filingSchema.index({ status: 1, attempts: 1 });
filingSchema.index({ announcedAt: -1 });
filingSchema.index({ materiality: -1, announcedAt: -1 });

/* ---- company snapshots -------------------------------------------------- */

const snapshotSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    editionId: { type: mongoose.Schema.Types.ObjectId, ref: "MdEdition", index: true },
    asOf: { type: Date, required: true },

    headline: String,
    bullets: [String],
    risks: [String],
    filingsDigest: String,
    newsDigest: String,
    citations: [{ _id: false, title: String, url: String }],
    sentiment: { type: String, enum: ["positive", "negative", "neutral"] },
    materialityTop: Number,
    filingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MdFiling" }],

    /** True when carried forward unchanged - no filings, no news, no tokens spent. */
    stale: { type: Boolean, default: false },
    usage: { inputTokens: Number, outputTokens: Number, costUsd: Number },
}, { timestamps: true, collection: "md_company_snapshots" });

snapshotSchema.index({ editionId: 1, symbol: 1 }, { unique: true });
snapshotSchema.index({ symbol: 1, asOf: -1 });

/* ---- editions (the newspaper) ------------------------------------------- */

const editionSchema = new mongoose.Schema({
    date: { type: String, required: true },              // YYYY-MM-DD in TIME_ZONE
    slot: { type: String, required: true, enum: ["AM", "PM"] },
    status: { type: String, enum: ["building", "ready", "failed"], default: "building" },

    builtAt: Date,
    marketHeadline: String,
    marketBrief: String,
    marketThemes: [String],
    /** True when the market pass gathered no real data - the brief is unsourced. */
    marketBriefUnsourced: Boolean,
    marketCitations: [{ _id: false, title: String, url: String }],
    indices: [{ _id: false, name: String, value: String, change: String }],

    companyRefs: [{
        _id: false,
        symbol: String,
        snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: "MdCompanySnapshot" },
        materiality: Number,
        sentiment: String,
        headline: String,
        stale: Boolean,
    }],
    calendar: [{
        _id: false,
        symbol: String, subject: String, exDate: Date, recordDate: Date,
    }],

    html: String,

    // Each channel stamps itself, so delivery is idempotent per channel and a
    // partial failure can be retried without re-sending what already went.
    delivery: {
        email: { sentAt: Date, error: String },
        telegram: { sentAt: Date, error: String },
        push: { sentAt: Date, error: String },
    },

    usage: { inputTokens: Number, outputTokens: Number, costUsd: Number },
    agentRunIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MdAgentRun" }],
    error: String,
}, { timestamps: true, collection: "md_editions" });

// The idempotency key for the whole feature: one edition per date per slot.
editionSchema.index({ date: 1, slot: 1 }, { unique: true });
editionSchema.index({ createdAt: -1 });

/* ---- agent run traces --------------------------------------------------- */

const agentRunSchema = new mongoose.Schema({
    editionId: { type: mongoose.Schema.Types.ObjectId, ref: "MdEdition", index: true },
    purpose: String,                                     // e.g. "companySnapshot:INFY"
    provider: String,
    model: String,
    status: { type: String, enum: ["running", "done", "failed", "budget"], default: "running" },

    iterations: [{
        _id: false,
        i: Number,
        request: mongoose.Schema.Types.Mixed,            // system/messages/tools, trimmed
        text: String,
        toolCalls: mongoose.Schema.Types.Mixed,
        toolResults: mongoose.Schema.Types.Mixed,
        finishReason: String,
        usage: mongoose.Schema.Types.Mixed,
        ms: Number,
    }],

    totalUsage: { inputTokens: Number, outputTokens: Number, costUsd: Number },
    startedAt: Date,
    endedAt: Date,
    error: String,
}, { timestamps: true, collection: "md_agent_runs" });

agentRunSchema.index({ createdAt: -1 });

/* ---- corporate actions (calendar panel) --------------------------------- */

const corporateActionSchema = new mongoose.Schema({
    symbol: { type: String, required: true, index: true },
    subject: String,
    purpose: String,
    exDate: Date,
    recordDate: Date,
    faceValue: String,
    fingerprint: { type: String, required: true, unique: true },
    raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true, collection: "md_corporate_actions" });

corporateActionSchema.index({ exDate: 1 });

/* ---- runtime settings --------------------------------------------------- */

const configSchema = new mongoose.Schema({
    key: { type: String, default: "settings", unique: true },
    schedule: {
        amHour: Number, amMinute: Number,
        pmHour: Number, pmMinute: Number,
        ingestEveryMinutes: Number,
    },
    materialityAlertThreshold: Number,
    marketTopics: [String],
    recipients: [{ _id: false, name: String, email: String }],
    telegramIds: [String],
    enabled: {
        email: Boolean, telegram: Boolean, push: Boolean, inApp: Boolean, tweet: Boolean,
    },
    limits: {
        filingsPerCompany: Number,
        summaryCharsPerFiling: Number,
        companyConcurrency: Number,
        maxIterations: Number,
        toolTimeoutMs: Number,
        runTimeoutMs: Number,
    },
    models: { fast: String, balanced: String, deep: String },
}, { timestamps: true, collection: "md_config" });

module.exports = {
    MdWatchlist: model("MdWatchlist", watchlistSchema),
    MdFiling: model("MdFiling", filingSchema),
    MdCompanySnapshot: model("MdCompanySnapshot", snapshotSchema),
    MdEdition: model("MdEdition", editionSchema),
    MdAgentRun: model("MdAgentRun", agentRunSchema),
    MdCorporateAction: model("MdCorporateAction", corporateActionSchema),
    MdConfig: model("MdConfig", configSchema),
};
