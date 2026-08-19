/**
 * Mounts the Noteit MCP server into this Express app.
 *
 * The MCP code under mcp-server/ is ESM, so it is pulled in with a dynamic
 * import(). The router is registered synchronously and resolves that import on
 * the first request — mounting must happen before the production catch-all in
 * app.js, so it cannot wait on a promise.
 */
const express = require("express");

const MCP_PATH = normalizePath(process.env.MCP_PATH || "/mcp");

function normalizePath(p) {
    const withSlash = p.startsWith("/") ? p : `/${p}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
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
            .then(({ createMcpHttpHandlers }) => createMcpHttpHandlers({ log }))
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

module.exports = { mountMcp, isMcpRequest, MCP_PATH };
