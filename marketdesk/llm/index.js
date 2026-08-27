/**
 * Provider factory — the single place that knows which vendor is in play.
 *
 * Everything downstream (agent loop, services, jobs) talks only to the returned
 * object's `chat()` and `search()`, so swapping vendors is an env change:
 *
 *     LLM_PROVIDER=gemini | openai | openrouter
 *     MARKETDESK_SEARCH_PROVIDER=gemini-grounding | tavily | serper | none
 *
 * Note that the two are deliberately independent: search grounding is a separate
 * request in every case, so there is no reason a Gemini-grounded search cannot
 * back an OpenAI chat model.
 */

const { createGeminiProvider } = require("./providers/gemini");
const { createOpenAICompatibleProvider } = require("./providers/openaiCompatible");
const { createGeminiGroundingSearch } = require("./search/geminiGrounding");
const { createHttpSearch } = require("./search/httpSearch");
const { createGoogleCseSearch } = require("./search/googleCse");
const { getPool } = require("./keyPool");
const { env, resolveModel: resolveFromSettings } = require("../config/settings");
const { LlmError, RateLimitError, isRetryable } = require("./errors");

const TIER_DOWNGRADE = { deep: "balanced", balanced: "fast", fast: null };

function buildChatProvider(providerName, overrides) {
    const resolveModel = (tier) => resolveFromSettings(tier, providerName, overrides);

    switch (providerName) {
        case "gemini":
            return createGeminiProvider({
                // getPool() memoises per key list, so the grounding search below
                // lands on this same pool rather than relearning every 429.
                pool: getPool({ keys: env.geminiApiKeys, provider: "gemini" }),
                resolveModel,
            });

        case "openai":
            return createOpenAICompatibleProvider({
                name: "openai",
                baseUrl: "https://api.openai.com/v1",
                apiKeys: env.openaiApiKeys,
                resolveModel,
                // The installed-era OpenAI API has json_object but not json_schema.
                jsonSchema: false,
            });

        case "openrouter":
            return createOpenAICompatibleProvider({
                name: "openrouter",
                baseUrl: "https://openrouter.ai/api/v1",
                apiKeys: env.openrouterApiKeys,
                extraHeaders: {
                    "HTTP-Referer": process.env.DOMAIN || "https://noteit.local",
                    "X-Title": "Noteit MarketDesk",
                },
                resolveModel,
                jsonSchema: true,
            });

        default:
            throw new LlmError(`unknown LLM_PROVIDER "${providerName}"`);
    }
}

/**
 * Resolve the search implementation, degrading rather than throwing: a missing
 * search key must not take the whole newspaper down, it should just cost us the
 * research section.
 */
/** The portable backends, in preference order, or null if none is configured. */
function portableSearch() {
    if (env.googleSearchApiKey && env.googleSearchCx) {
        return createGoogleCseSearch({
            apiKey: env.googleSearchApiKey,
            cx: env.googleSearchCx,
        });
    }
    if (env.tavilyApiKey) return createHttpSearch({ backend: "tavily", apiKey: env.tavilyApiKey });
    if (env.serperApiKey) return createHttpSearch({ backend: "serper", apiKey: env.serperApiKey });
    return null;
}
function buildSearch(provider, overrides) {
    const want = env.searchProvider;

    if (want === "none") return null;

    if (want === "gemini-grounding") {
        if (provider.capabilities.nativeWebSearch && provider.name === "gemini") {
            return provider.search.bind(provider);
        }
        if (env.geminiApiKeys.length) {
            return createGeminiGroundingSearch({
                pool: getPool({ keys: env.geminiApiKeys, provider: "gemini" }),
                model: resolveFromSettings("fast", "gemini", overrides),
            });
        }
        // Asked for grounding, no Gemini key — try a portable backend instead.
        if (env.tavilyApiKey) return createHttpSearch({ backend: "tavily", apiKey: env.tavilyApiKey });
        if (env.serperApiKey) return createHttpSearch({ backend: "serper", apiKey: env.serperApiKey });
        return null;
    }

    if (want === "google" || want === "google-cse") {
        if (env.googleSearchApiKey && env.googleSearchCx) {
            return createGoogleCseSearch({
                apiKey: env.googleSearchApiKey,
                cx: env.googleSearchCx,
            });
        }
        console.warn("[marketdesk] MARKETDESK_SEARCH_PROVIDER=google but GOOGLE_SEARCH_API_KEY/CX are not set");
        return portableSearch();
    }

    if (want === "tavily" && env.tavilyApiKey) {
        return createHttpSearch({ backend: "tavily", apiKey: env.tavilyApiKey });
    }
    if (want === "serper" && env.serperApiKey) {
        return createHttpSearch({ backend: "serper", apiKey: env.serperApiKey });
    }
    return null;
}

/**
 * Retry a rate-limited or 5xx call once on the next cheaper tier.
 *
 * This generalises what functions/analyzeDocument.js already does by hand
 * (2.5-flash, then 2.5-flash-lite) so every call site inherits it.
 */
function withTierFallback(provider) {
    const chat = provider.chat.bind(provider);
    return {
        ...provider,
        chat: async (args) => {
            try {
                return await chat(args);
            } catch (err) {
                const nextTier = TIER_DOWNGRADE[args.tier || "balanced"];
                // An explicit model pin is a deliberate choice; don't second-guess it.
                if (!nextTier || args.model) throw err;

                // 404 means the configured model was retired or is not available
                // to this key -- Google closed gemini-2.5-pro to new keys mid-flight
                // and returned 404 with a "use X instead" message. That is not
                // retryable, but it is very much recoverable: drop a tier rather
                // than losing the whole edition to a stale model name.
                const unavailable = err.status === 404;

                // A daily cap is not retryable in place, but it IS per model, so
                // the next tier down has its own untouched allowance. This is the
                // one case where changing model is the only thing that can work.
                const exhausted = !!err.dailyQuota;

                if (!unavailable && !exhausted && !isRetryable(err)) throw err;

                const why = unavailable ? " (model unavailable)"
                    : exhausted ? " (daily quota for this model)" : "";
                console.warn(
                    `[marketdesk/llm] ${err.name}${why} on tier ${args.tier} — retrying on ${nextTier}`
                );
                return chat({ ...args, tier: nextTier });
            }
        },
    };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.provider]  override LLM_PROVIDER
 * @param {object} [opts.models]    {fast, balanced, deep} overrides from MdConfig
 * @returns provider with .chat(), .search()|null, .capabilities, .resolveModel()
 */
function getProvider({ provider, models = {} } = {}) {
    const name = (provider || env.provider).toLowerCase();
    const base = buildChatProvider(name, models);
    const search = buildSearch(base, models);

    const wrapped = withTierFallback(base);
    wrapped.search = search;
    wrapped.capabilities = { ...base.capabilities, webSearch: !!search };
    return wrapped;
}

module.exports = { getProvider, RateLimitError, LlmError };
