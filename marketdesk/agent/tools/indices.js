/**
 * get_indices — every headline level in one call.
 *
 * Previously the model had to guess a symbol per index and call get_price
 * repeatedly; it burned turns and, when the lookups failed, it filled the gap
 * from training data. One call that returns the whole board removes both the
 * guessing and the excuse.
 */

const { fetchHeadlineIndices } = require("../../services/priceSources");

const fmt = (i) => ({
    name: i.name,
    value: i.value,
    change: i.change,
    percentChange: i.percentChange,
    source: i.source,
});

module.exports = function indicesTool() {
    return {
        name: "get_indices",
        description:
            "Get current levels for the main Indian indices (Nifty 50, Bank Nifty, sector indices, India VIX) " +
            "and for global indices and commodities. Call this once before writing about the market. " +
            "Quote only the levels this returns.",
        parameters: { type: "object", properties: {} },
        handler: async (_args, ctx) => {
            const { domestic, global } = await fetchHeadlineIndices();

            // Record every level so the caller can verify the written brief only
            // quotes numbers that were actually fetched.
            if (ctx?.facts?.prices) {
                for (const i of [...domestic, ...global]) ctx.facts.prices.set(i.name, i);
            }

            if (!domestic.length && !global.length) {
                return { note: "no index data available right now; do not quote any levels" };
            }

            return {
                asOf: new Date().toISOString(),
                indian: domestic.map(fmt),
                global: global.map(fmt),
            };
        },
    };
};
