/**
 * Static defaults + environment for MarketDesk.
 *
 * Deliberately free of mongoose and of any other module in here, so that
 * everything else can require it without import cycles. Anything an admin can
 * change at runtime lives in the MdConfig document instead — see config/runtime.js.
 */

const TIME_ZONE = process.env.TIME_ZONE || "Asia/Kolkata";

/**
 * Task -> model tier. The point of naming tiers rather than models is that
 * switching provider only has to remap three names, not every call site.
 */
const TASK_TIERS = {
    filingSummary: "fast",
    materiality: "fast",
    companySnapshot: "balanced",
    marketBrief: "deep",
    search: "fast",
};

const PROVIDER_DEFAULTS = {
    gemini: {
        // The 3.5 family, not 2.5: Google has started answering 404 "no longer
        // available to new users" for gemini-2.5-flash-lite on freshly issued
        // keys, so a 2.5 default is a time bomb. Also deliberately not the
        // "-latest" aliases -- gemini-flash-latest answered 503 "high demand" and
        // took over three minutes when it did respond, which is no good for a
        // scheduled job.
        fast: "gemini-3.5-flash-lite",
        balanced: "gemini-3.5-flash-lite",
        // A distinct model for the market brief, which both writes better and
        // gives the tier ladder somewhere to fall back to: the free quota is per
        // model, so deep and fast do not compete for the same allowance.
        // Point LLM_MODEL_DEEP at a pro model once billing is on.
        deep: "gemini-3.5-flash",
    },
    openai: {
        fast: "gpt-4o-mini",
        balanced: "gpt-4o-mini",
        deep: "gpt-4o",
    },
    openrouter: {
        fast: "google/gemini-2.5-flash-lite",
        balanced: "google/gemini-2.5-flash",
        deep: "google/gemini-2.5-pro",
    },
};

/**
 * Approximate USD per 1M tokens. Used only to drive the per-run budget guard
 * and to make spend visible on the edition — it is not billing-accurate, and
 * an unknown model simply costs 0 rather than throwing.
 */
const PRICING = {
    "gemini-2.5-flash-lite": { in: 0.10, out: 0.40 },
    "gemini-2.5-flash": { in: 0.30, out: 2.50 },
    "gemini-2.5-pro": { in: 1.25, out: 10.00 },
    "gemini-3.5-flash-lite": { in: 0.10, out: 0.40 },
    "gemini-3.5-flash": { in: 0.30, out: 2.50 },
    "gemini-3-flash": { in: 0.30, out: 2.50 },
    "gemini-3.1-pro": { in: 1.25, out: 10.00 },
    "gpt-4o-mini": { in: 0.15, out: 0.60 },
    "gpt-4o": { in: 2.50, out: 10.00 },
};

// Longest key first, so "gemini-3.5-flash-lite" cannot be priced as the dearer
// "gemini-3.5-flash" just because that key happened to be checked earlier.
const PRICING_KEYS = Object.keys(PRICING).sort((a, b) => b.length - a.length);

/**
 * Read a comma-separated key pool from the first of `names` that is set, then
 * merge in any of the others.
 *
 * Merging rather than picking matters: someone who already had GEMINI_API_KEY
 * set and then adds GEMINI_API_KEYS should end up with all of them, not silently
 * lose the original. Duplicates collapse in the pool itself.
 */
function keyList(...names) {
    const out = [];
    for (const name of names) {
        for (const part of String(process.env[name] || "").split(",")) {
            const key = part.trim();
            if (key && !out.includes(key)) out.push(key);
        }
    }
    return out;
}

const env = {
    provider: (process.env.LLM_PROVIDER || "gemini").toLowerCase(),
    models: {
        fast: process.env.LLM_MODEL_FAST || null,
        balanced: process.env.LLM_MODEL_BALANCED || null,
        deep: process.env.LLM_MODEL_DEEP || null,
    },
    geminiApiKey: process.env.GEMINI_API_KEY,
    /**
     * Comma-separated key pools, one per provider.
     *
     * Free-tier Gemini allows only 20 requests per day per model per project,
     * which is less than one edition needs, so several keys from different
     * projects are alternated and failed over — see llm/keyPool.js.
     *
     * The plural and singular names are merged for every provider, so going from
     * one key to several is purely an env change and a single key is just a pool
     * of one.
     */
    geminiApiKeys: keyList("GEMINI_API_KEYS", "GEMINI_API_KEY"),
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiApiKeys: keyList("OPENAI_API_KEYS", "OPENAI_API_KEY"),
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterApiKeys: keyList("OPENROUTER_API_KEYS", "OPENROUTER_API_KEY"),
    searchProvider: (process.env.MARKETDESK_SEARCH_PROVIDER || "gemini-grounding").toLowerCase(),
    tavilyApiKey: process.env.TAVILY_API_KEY,
    serperApiKey: process.env.SERPER_API_KEY,
    maxUsdPerRun: Number(process.env.LLM_MAX_USD_PER_RUN || 0.5),
    adminEmails: (process.env.MARKETDESK_ADMIN_EMAILS || "kaushikappani@gmail.com")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    cronToken: process.env.MARKETDESK_CRON_TOKEN || null,
    timeZone: TIME_ZONE,
    schedulerEnabled: process.env.MARKETDESK_SCHEDULER !== "false",
};

/** Runtime-editable settings; these are the shipped defaults. */
const CONFIG_DEFAULTS = {
    key: "settings",
    schedule: { amHour: 8, amMinute: 0, pmHour: 20, pmMinute: 0, ingestEveryMinutes: 10 },
    materialityAlertThreshold: 70,
    marketTopics: [
        "Nifty 50 and Sensex levels, breadth and the day's drivers",
        "Global cues: US indices, Asian markets, crude oil, dollar index",
        "FII and DII flows in Indian equities",
        "Sector rotation and the day's leading and lagging sectors",
        "INR, bond yields and RBI or SEBI policy news",
    ],
    recipients: [{ name: "kaushik", email: "kaushikappani@gmail.com" }],
    telegramIds: ["1375808164"],
    enabled: { email: true, telegram: true, push: true, inApp: true, tweet: false },
    limits: {
        filingsPerCompany: 8,
        summaryCharsPerFiling: 600,
        // Serial by design. Running companies in parallel multiplies the burst
        // against a per-minute request cap, and the 429 backoffs that follow cost
        // more wall-clock than the parallelism ever saved. Raise this only on a
        // key with headroom to spare.
        companyConcurrency: 1,
        maxIterations: 8,
        toolTimeoutMs: 20000,
        runTimeoutMs: 180000,
    },
    models: { fast: null, balanced: null, deep: null },
};

/** Resolve a tier name to a concrete model id for the active provider. */
function resolveModel(tier, provider = env.provider, overrides = {}) {
    const t = tier || "balanced";
    return (
        overrides[t] ||
        env.models[t] ||
        (PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.gemini)[t] ||
        (PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.gemini).balanced
    );
}

/** Approximate cost of one call. Unknown models are free rather than fatal. */
function estimateCostUsd(model, inputTokens = 0, outputTokens = 0) {
    const key = PRICING_KEYS.find((k) => String(model || "").includes(k));
    if (!key) return 0;
    const p = PRICING[key];
    return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

module.exports = {
    TIME_ZONE, TASK_TIERS, PROVIDER_DEFAULTS, PRICING,
    env, CONFIG_DEFAULTS, resolveModel, estimateCostUsd,
};
