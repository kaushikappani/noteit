/**
 * Mounts the Noteit MCP server into this Express app.
 *
 * The MCP code under mcp-server/ is ESM, so it is pulled in with a dynamic
 * import(). The router is registered synchronously and resolves that import on
 * the first request — mounting must happen before the production catch-all in
 * app.js, so it cannot wait on a promise.
 */
const express = require("express");
const { createRedisGrantStore } = require("./mcpGrants");

const MCP_PATH = normalizePath(process.env.MCP_PATH || "/mcp");

// Origins allowed to drive /mcp from a browser, beyond the defaults below.
// Comma-separated; "*" restores the old allow-everything behaviour.
const EXTRA_ORIGINS = String(process.env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

function normalizePath(p) {
    const withSlash = p.startsWith("/") ? p : `/${p}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

/**
 * Decide whether an Origin may talk to /mcp.
 *
 * The MCP spec asks servers to validate Origin, and here it matters more than
 * usual: opening a session costs nothing, the app answers with a wildcard CORS
 * header, and a page the user happens to have open could otherwise sit there
 * driving this endpoint. It cannot read anyone's notes without a grant key, but
 * it can burn sessions and it has no business trying.
 *
 * The default is chosen so no real client has to be configured:
 *   - no Origin at all — every non-browser MCP client, curl, the inspector
 *   - browser extensions, which is what the TL;DR extension sends
 *   - this server's own origin, for the React app
 * Anything else is an ordinary web page and is turned away.
 */
function isAllowedOrigin(origin, req) {
    if (!origin) return true;
    if (EXTRA_ORIGINS.includes("*") || EXTRA_ORIGINS.includes(origin)) return true;

    let parsed;
    try {
        parsed = new URL(origin);
    } catch (_) {
        return false;
    }

    if (/^(chrome|moz|safari-web)-extension:$/.test(parsed.protocol)) return true;
    return !!req.headers.host && parsed.host === req.headers.host;
}

/** True for MCP_PATH itself and anything under it — but not e.g. /mcpfoo. */
function isMcpRequest(req, path = MCP_PATH) {
    return req.path === path || req.path.startsWith(`${path}/`);
}

function log(message) {
    console.log(`[noteit-mcp] ${message}`);
}

let handlersPromise = null;

function loadHandlers() {
    if (!handlersPromise) {
        handlersPromise = import("../mcp-server/src/http.js")
            .then(({ createMcpHttpHandlers }) =>
                createMcpHttpHandlers({
                    log,
                    ssePath: `${MCP_PATH}/sse`,
                    // The whole point of the mounted build: logins outlive the process.
                    grants: createRedisGrantStore(),
                })
            )
            .catch((e) => {
                // Reset so a transient failure (e.g. missing dependency during a
                // partial deploy) can be retried on the next request.
                handlersPromise = null;
                throw e;
            });
    }
    return handlersPromise;
}

function mountMcp(app, { path = MCP_PATH } = {}) {
    const router = express.Router();

    // Browser-based MCP clients cannot read the session id back without this.
    router.use((req, res, next) => {
        res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

        const origin = req.headers.origin;
        if (!isAllowedOrigin(origin, req)) {
            log(`refused cross-origin request from ${origin}`);
            return res.status(403).json({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32000, message: "Origin not allowed for this MCP endpoint." },
            });
        }

        next();
    });

    const withHandlers = (fn) => async (req, res, next) => {
        let handlers;
        try {
            handlers = await loadHandlers();
        } catch (e) {
            return next(e);
        }
        return fn(handlers, req, res);
    };

    const jsonBody = (req) => (req.method === "POST" ? req.body : undefined);

    // Legacy SSE transport, for clients that predate streamable HTTP.
    router.get("/sse", withHandlers((h, req, res) =>
        h.handleSseConnect(req, res, `${req.baseUrl}/messages`)
    ));

    router.post("/messages", withHandlers((h, req, res) =>
        h.handleSseMessage(req, res, req.body, req.query.sessionId)
    ));

    // Streamable HTTP (current spec) — POST to open/use, GET to stream, DELETE to end.
    router.all("/", withHandlers((h, req, res) =>
        h.handleStreamable(req, res, jsonBody(req))
    ));

    app.use(path, router);
    log(`mounted at ${path} (streamable http) and ${path}/sse (legacy sse)`);

    return { path };
}

module.exports = { mountMcp, isMcpRequest, isAllowedOrigin, MCP_PATH };
