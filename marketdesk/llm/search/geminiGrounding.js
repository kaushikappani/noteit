/**
 * Native Google Search grounding as a standalone search function.
 *
 * Search backend and chat provider are chosen independently, so this exists to
 * let LLM_PROVIDER=openai still use Google grounding for research, as long as a
 * GEMINI_API_KEY is present.
 */

const { createGeminiProvider } = require("../providers/gemini");

function createGeminiGroundingSearch({ apiKey, apiKeys, pool, model }) {
    const provider = createGeminiProvider({
        // Passed straight through: the caller shares the chat provider's pool so
        // a spent key is known to both, rather than being rediscovered here.
        pool,
        apiKey,
        apiKeys,
        resolveModel: () => model,
    });
    return ({ query, recencyDays, signal }) => provider.search({ query, recencyDays, signal });
}

module.exports = { createGeminiGroundingSearch };
