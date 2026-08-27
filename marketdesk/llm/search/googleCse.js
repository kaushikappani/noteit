/**
 * Google search via the Programmable Search Engine JSON API.
 *
 * The one genuinely free route to real Google results: 100 queries/day with no
 * billing account attached. Gemini's own grounding needs billing, Serper's free
 * tier is a one-off credit grant, and scraping google.com is both against their
 * terms and reliably blocked — so for a free deployment this is the option.
 *
 * Setup is two values, both free:
 *   GOOGLE_SEARCH_API_KEY  console.cloud.google.com -> enable "Custom Search API"
 *   GOOGLE_SEARCH_CX       programmablesearchengine.google.com -> create an
 *                          engine with "Search the entire web" switched on
 */

const axios = require("axios");
const { LlmError } = require("../errors");

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

/** Fold results into one readable block, since that is what the model consumes. */
function render(results) {
    return results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${(r.snippet || "").trim()}`)
        .join("\n\n");
}

function createGoogleCseSearch({ apiKey, cx }) {
    if (!apiKey || !cx) {
        throw new LlmError(
            "google search needs both GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX",
            { provider: "google-cse" }
        );
    }

    return async function search({ query, recencyDays, signal }) {
        const params = {
            key: apiKey,
            cx,
            q: query,
            num: 8,
            // Bias to India, which is what every query here is about.
            gl: "in",
            hl: "en",
            safe: "off",
        };
        // dateRestrict takes d/w/m units rather than a day count.
        if (recencyDays) {
            params.dateRestrict = recencyDays <= 1 ? "d1"
                : recencyDays <= 7 ? `d${recencyDays}`
                : `m${Math.ceil(recencyDays / 30)}`;
        }

        const { data, status } = await axios.get(ENDPOINT, {
            params, signal, timeout: 20000, validateStatus: () => true,
        });

        if (status !== 200) {
            const detail = data?.error?.message || `HTTP ${status}`;
            // 429 here means the 100/day allowance is gone. Returning a note
            // rather than throwing lets the agent write around the gap instead of
            // failing the whole edition on a quota that resets tomorrow.
            if (status === 429 || /quota/i.test(detail)) {
                return {
                    text: "Google search daily quota exhausted; no results available.",
                    citations: [], toolCalls: [], finishReason: "stop",
                    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
                };
            }
            throw new LlmError(`google-cse ${status}: ${detail}`, {
                provider: "google-cse", status,
            });
        }

        const results = (data.items || []).map((i) => ({
            title: i.title,
            url: i.link,
            snippet: i.snippet,
        }));

        return {
            text: results.length ? render(results) : "No results.",
            citations: results.map((r) => ({ title: r.title, url: r.url })),
            toolCalls: [],
            finishReason: "stop",
            // Billed per query, not per token.
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        };
    };
}

module.exports = { createGoogleCseSearch };
