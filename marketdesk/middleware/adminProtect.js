/**
 * Admin gate.
 *
 * Composes the host app's existing `protect` rather than modifying it, the same
 * way middleware/protect.js's own `stockProtect` layers an allowlist on top of a
 * verified session. protect does the real work — JWT, Redis token slot, req.user
 * — and this only decides whether that user is allowed in here.
 *
 * The gate is by email because the User schema has neither a username nor an
 * isAdmin field. (routes/user.js returns isAdmin on login, but nothing ever sets
 * it, so it is always undefined and cannot be relied on.)
 */

const { protect } = require("../../middleware/protect");
const { env } = require("../config/settings");

function adminOnly(req, res, next) {
    const email = String(req.user?.email || "").toLowerCase();
    if (email && env.adminEmails.includes(email)) return next();

    console.warn(`[marketdesk] access denied for ${email || "anonymous"}`);
    return res.status(403).json({ message: "Access denied" });
}

/** Drop-in middleware array: router.get(path, adminProtect, handler). */
const adminProtect = [protect, adminOnly];

/**
 * Token gate for an external cron pinger, which has no cookie to present.
 * Refuses everything unless MARKETDESK_CRON_TOKEN is configured, so leaving it
 * unset means the endpoint is closed rather than open.
 */
function cronProtect(req, res, next) {
    const expected = env.cronToken;
    if (!expected) return res.status(404).json({ message: "cron trigger is not enabled" });

    const provided = req.get("x-marketdesk-token") || req.query.token;
    if (provided && provided === expected) return next();
    return res.status(401).json({ message: "invalid cron token" });
}

module.exports = { adminProtect, adminOnly, cronProtect };
