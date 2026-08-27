/**
 * Portable web search — the fallback for any chat provider without native
 * grounding. Returns the same {text, citations, usage} shape the Gemini
 * grounding call returns, so the agent's web_search tool cannot tell them apart.
 */

const { postJson } = require("../http");
const { LlmError } = require("../errors");

/**
 * Fold results into one readable block, since that is what the model consumes.
 *
 * The publication date is included deliberately. Search happily returns pages
 * years out of date -- a query for today's close came back with index levels
 * from a previous decade -- and without a date on each result the model has no
 * way to tell. An unknown date is stated as such rather than left blank.
 */
function render(results) {
    return results
        .map((r, i) =>
            "[" + (i + 1) + "] " + r.title +
            (r.published ? " (published " + r.published + ")" : " (date unknown)") +
            String.fromCharCode(10) + r.url +
            String.fromCharCode(10) + (r.snippet || "").trim())
        .join(String.fromCharCode(10) + String.fromCharCode(10));
}

async function tavily({ apiKey, query, recencyDays, signal }) {
    const body = {
        query,
        search_depth: "basic",
        max_results: 8,
        include_answer: true,
        topic: "news",
    };
    if (recencyDays) body.days = recencyDays;

    const data = await postJson("https://api.tavily.com/search", body, {
        // Bearer, not api_key in the body: both work today, but the body form is
        // the deprecated one.
        headers: { Authorization: "Bearer " + apiKey },
        signal, provider: "tavily", retries: 1,
    });
    const results = (data.results || []).map((r) => ({
        title: r.title, url: r.url, snippet: r.content,
        published: r.published_date || null,
    }));
    return {
        text: data.answer ? `${data.answer}\n\n${render(results)}` : render(results),
        citations: results.map((r) => ({ title: r.title, url: r.url, published: r.published || null })),
    };
}

async function serper({ apiKey, query, recencyDays, signal }) {
    const body = { q: query, num: 8 };
    // Serper expresses recency as a qdr: token rather than a day count.
    if (recencyDays) body.tbs = recencyDays <= 1 ? "qdr:d" : recencyDays <= 7 ? "qdr:w" : "qdr:m";

    const data = await postJson("https://google.serper.dev/search", body, {
        headers: { "X-API-KEY": apiKey }, signal, provider: "serper", retries: 1,
    });
    const results = [...(data.news || []), ...(data.organic || [])]
        .slice(0, 8)
        .map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
    return {
        text: render(results),
        citations: results.map((r) => ({ title: r.title, url: r.url, published: r.published || null })),
    };
}

/**
 * @param {"tavily"|"serper"} backend
 */
function createHttpSearch({ backend, apiKey }) {
    if (!apiKey) throw new LlmError(`${backend} API key is not set`, { provider: backend });
    const impl = backend === "serper" ? serper : tavily;

    return async function search({ query, recencyDays, signal }) {
        const { text, citations } = await impl({ apiKey, query, recencyDays, signal });
        return {
            text: text || "No results.",
            citations,
            toolCalls: [],
            finishReason: "stop",
            // Search APIs bill per call, not per token; cost is tracked separately.
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        };
    };
}

module.exports = { createHttpSearch };
