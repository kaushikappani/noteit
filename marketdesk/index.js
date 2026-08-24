/**
 * MarketDesk mount point — the module's entire contract with the host app.
 *
 * Mirrors middleware/mcp.js's mountMcp: build a router internally, mount it, and
 * expose nothing else. Two lines in app.js is the whole integration, which is
 * also what makes the folder liftable into its own service later.
 */

const marketDeskRoutes = require("./routes");
const { env } = require("./config/settings");

const DEFAULT_PATH = "/api/marketdesk";

/**
 * @param {import("express").Express} app
 * @param {{path?: string, scheduler?: boolean}} [opts]
 */
function mountMarketDesk(app, { path = DEFAULT_PATH, scheduler = true } = {}) {
    app.use(path, marketDeskRoutes);

    if (scheduler && env.schedulerEnabled) {
        // Fire and forget: the scheduler reads settings from Mongo, and app.js
        // mounts routes synchronously, so this cannot be awaited here. Startup
        // must not be blocked on it either.
        require("./scheduler")
            .startScheduler()
            .catch((err) => console.error("[marketdesk] scheduler failed to start:", err.message));
    }

    console.log(`[marketdesk] mounted at ${path}`);
    return app;
}

module.exports = { mountMarketDesk, MARKETDESK_PATH: DEFAULT_PATH };
