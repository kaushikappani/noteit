/**
 * get_news — headline lookup via NewsAPI.
 *
 * Secondary to web_search: NewsAPI's free tier is development-only and answers
 * 426 from a deployed server, so this returns a note rather than an error and
 * lets the model fall back to searching.
 */

const axios = require("axios");

module.exports = function newsTool() {
    return {
        name: "get_news",
        description:
            "Fetch recent news headlines for a company or topic. If this returns nothing useful, use web_search instead.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Company name or topic." },
                days: { type: "integer", description: "Look back this many days. Default 2." },
            },
            required: ["query"],
        },
        handler: async ({ query, days = 2 }, ctx) => {
            const { signal } = ctx;
            const apiKey = process.env.NEWS_API_KEY;
            if (!apiKey) return { note: "NEWS_API_KEY is not configured; use web_search" };

            const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
            try {
                const { data, status } = await axios.get("https://newsapi.org/v2/everything", {
                    params: {
                        q: query, from, language: "en",
                        // Body matching pulls in wholly unrelated stories -- a query
                        // about Nifty came back with NFL and camera reviews -- so
                        // restrict matching to the headline.
                        searchIn: "title",
                        sortBy: "publishedAt", pageSize: 12,
                    },
                    headers: { "X-Api-Key": apiKey },
                    signal,
                    timeout: 15000,
                    validateStatus: () => true,
                });
                if (status !== 200) {
                    return { note: `news api returned ${status}; use web_search`, detail: data?.message };
                }
                // Second guard: keep only headlines that actually mention a
                // meaningful word from the query, so nothing irrelevant can reach
                // the edition's citation list.
                const tokens = String(query).toLowerCase().split(/[^a-z0-9]+/i)
                    .filter((t) => t.length > 2);
                const relevant = (a) => {
                    const haystack = `${a.title || ""} ${a.description || ""}`.toLowerCase();
                    return !tokens.length || tokens.some((t) => haystack.includes(t));
                };

                const articles = (data.articles || [])
                    .filter(relevant)
                    .slice(0, 8)
                    .map((a) => ({
                        title: a.title,
                        source: a.source?.name,
                        publishedAt: a.publishedAt,
                        description: a.description,
                        url: a.url,
                    }));

                if (!articles.length) return { count: 0, articles: [], note: "nothing relevant; use web_search" };

                if (ctx?.facts) ctx.facts.sourced = (ctx.facts.sourced || 0) + articles.length;

                return {
                    count: articles.length,
                    articles,
                    citations: articles.map((a) => ({ title: a.title, url: a.url })),
                };
            } catch (err) {
                return { note: `news lookup failed (${err.message}); use web_search` };
            }
        },
    };
};
