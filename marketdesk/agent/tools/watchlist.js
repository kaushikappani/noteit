/** get_watchlist — the configured universe, so the market pass knows its scope. */

const { MdWatchlist } = require("../../models");

module.exports = function watchlistTool() {
    return {
        name: "get_watchlist",
        description: "List the companies this dashboard tracks.",
        parameters: { type: "object", properties: {} },
        handler: async () => {
            const doc = await MdWatchlist.findOne({ key: "default" }).lean();
            const symbols = (doc?.symbols || []).filter((s) => s.active !== false);
            return {
                count: symbols.length,
                symbols: symbols.map((s) => s.symbol),
            };
        },
    };
};
