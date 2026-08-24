/** get_calendar — upcoming ex-dates, dividends and board meetings from our store. */

const { MdCorporateAction } = require("../../models");

module.exports = function calendarTool() {
    return {
        name: "get_calendar",
        description:
            "Upcoming corporate actions (ex-dates, dividends, bonuses, board meetings) for tracked companies.",
        parameters: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Optional: restrict to one NSE symbol." },
                daysAhead: { type: "integer", description: "Window in days. Default 21." },
            },
        },
        handler: async ({ symbol, daysAhead = 21 }) => {
            const query = {
                exDate: { $gte: new Date(), $lte: new Date(Date.now() + daysAhead * 86400000) },
            };
            if (symbol) query.symbol = String(symbol).trim().toUpperCase();

            const actions = await MdCorporateAction.find(query)
                .sort({ exDate: 1 }).limit(40).lean();

            return {
                count: actions.length,
                actions: actions.map((a) => ({
                    symbol: a.symbol, subject: a.subject,
                    exDate: a.exDate, recordDate: a.recordDate,
                })),
            };
        },
    };
};
