import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createNoteitServer } from "./server.js";

// A month. The login lives in the session and nowhere else — the token is never
// handed to the client — so the session's lifetime *is* how long a user stays
// logged in. Anything shorter marches them back through the browser flow while
// their year-long token is still perfectly good.
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

// With a month-long TTL the sweeper no longer bounds the map, so this does.
// Each entry pins a Server, a transport and a JWT for as long as it lives, and
// every re-handshake adds one. Evicting is a forced logout, so the cap is set
// far above any plausible fleet of real clients.
const DEFAULT_MAX_SESSIONS = 500;

/** Framework-agnostic Node req/res helpers so this file never imports express. */
function sendJson(res, status, payload) {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function rpcError(res, status, message, code = -32000) {
  sendJson(res, status, {
    jsonrpc: "2.0",
    id: null,
    error: { code, message },
  });
}

/**
 * Build the MCP-over-HTTP request handlers.
 *
 * Returns plain (req, res) handlers rather than an express Router on purpose:
 * `mcp-server/` resolves express 5 while the Noteit app runs express 4, and a
 * Router built by one cannot be mounted into the other. The caller wires the
 * routes with whatever express instance it already has.
 */
export function createMcpHttpHandlers({ sessionTtlMs, maxSessions, ssePath, log = () => {} } = {}) {
  const ttl =
    sessionTtlMs ?? (Number(process.env.MCP_SESSION_TTL_MS) || DEFAULT_SESSION_TTL_MS);
  const cap =
    maxSessions ?? (Number(process.env.MCP_MAX_SESSIONS) || DEFAULT_MAX_SESSIONS);

  // Streaming an SSE body through a compressing proxy is where hosted MCP most
  // often breaks, so plain JSON replies are the default. MCP_JSON_RESPONSE=false
  // opts back into spec-preferred SSE streaming.
  const enableJsonResponse = process.env.MCP_JSON_RESPONSE !== "false";

  /** sessionId -> { transport, server, lastSeen, kind } */
  const sessions = new Map();

  function track(id, kind, transport, server, api) {
    sessions.set(id, { transport, server, api, lastSeen: Date.now(), kind });
    log(`session opened (${kind}): ${id} — ${sessions.size} active`);

    transport.onclose = () => {
      if (sessions.delete(id)) {
        log(`session closed (${kind}): ${id} — ${sessions.size} active`);
      }
    };

    evictOverCap();
  }

  /**
   * Keep the map at the cap, giving up logged-out sessions before logged-in ones.
   *
   * The ordering is the security-relevant part, not a nicety. Opening a session
   * needs no credentials and `/mcp` is exempt from the app's rate limiter, so
   * anyone can create them for free; a plain least-recently-used cap would let
   * that evict every signed-in user, which is a cheap denial of login. An
   * attacker's sessions never authenticate, so spending those first means a
   * flood costs them their own sessions instead of someone's month-old login.
   *
   * Evicting an authenticated session is logged loudly: it is the one eviction
   * a user cannot recover from without signing in again, and it means the cap is
   * genuinely too low rather than that something went stale.
   */
  function evictOverCap() {
    if (sessions.size <= cap) return;

    const signedIn = (entry) => {
      try {
        return entry.api?.isAuthenticated() ? 1 : 0;
      } catch (_) {
        return 0;
      }
    };

    const giveUpFirst = [...sessions.entries()].sort(
      (a, b) => signedIn(a[1]) - signedIn(b[1]) || a[1].lastSeen - b[1].lastSeen
    );
    for (const [id, entry] of giveUpFirst.slice(0, sessions.size - cap)) {
      sessions.delete(id);
      const cost = signedIn(entry) ? " — that client must log in again" : " (never logged in)";
      log(`session evicted at cap ${cap} (${entry.kind}): ${id}${cost}`);
      Promise.resolve(entry.transport.close()).catch(() => {});
    }
  }

  function touch(id) {
    const entry = sessions.get(id);
    if (entry) entry.lastSeen = Date.now();
    return entry;
  }

  // Every idle session pins a user's JWT in memory, so expire them — but at the
  // month-long default that is a backstop for abandoned sessions, not the thing
  // that ends a normal login.
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - ttl;
    for (const [id, entry] of sessions) {
      if (entry.lastSeen < cutoff) {
        sessions.delete(id);
        log(`session expired (${entry.kind}): ${id}`);
        Promise.resolve(entry.transport.close()).catch(() => {});
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweeper.unref?.();

  /**
   * Streamable HTTP (current spec) — one endpoint serving POST / GET / DELETE.
   * `body` must be pre-parsed; pass `req.body` when body-parser ran upstream.
   */
  async function handleStreamable(req, res, body) {
    const sessionId = req.headers["mcp-session-id"];

    try {
      if (sessionId) {
        const entry = touch(sessionId);
        if (!entry) {
          rpcError(res, 404, "Unknown or expired MCP session. Re-initialize to continue.");
          return;
        }
        await entry.transport.handleRequest(req, res, body);
        return;
      }

      if (req.method !== "POST" || !isInitializeRequest(body)) {
        // A bare GET here is almost always a client configured for the older SSE
        // transport pointed at the streamable endpoint, so name the right URL
        // rather than leaving it to guess what it did wrong.
        const hint =
          req.method === "GET" && ssePath
            ? ` If your client uses the legacy SSE transport, point it at ${ssePath} instead.`
            : "";
        rpcError(
          res,
          400,
          "Missing mcp-session-id header. Open a session with an initialize request first." + hint
        );
        return;
      }

      const { server, api } = createNoteitServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse,
        onsessioninitialized: (id) => track(id, "streamable-http", transport, server, api),
        onsessionclosed: (id) => {
          sessions.delete(id);
          log(`session terminated by client: ${id}`);
        },
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      log(`streamable-http error: ${e.stack || e.message}`);
      rpcError(res, 500, `Internal MCP error: ${e.message}`);
    }
  }

  /**
   * Legacy SSE transport, for clients that predate streamable HTTP.
   * `postPath` is the absolute path the client should POST replies to.
   */
  async function handleSseConnect(req, res, postPath) {
    try {
      const { server, api } = createNoteitServer();
      const transport = new SSEServerTransport(postPath, res);
      track(transport.sessionId, "sse", transport, server, api);
      await server.connect(transport);
    } catch (e) {
      log(`sse connect error: ${e.stack || e.message}`);
      rpcError(res, 500, `Cannot open SSE stream: ${e.message}`);
    }
  }

  /** POST counterpart of the legacy SSE stream — session comes from ?sessionId=. */
  async function handleSseMessage(req, res, body, sessionId) {
    const entry = sessionId ? touch(sessionId) : undefined;
    if (!entry || entry.kind !== "sse") {
      rpcError(res, 404, "Unknown or expired SSE session. Reconnect to the SSE endpoint.");
      return;
    }

    try {
      await entry.transport.handlePostMessage(req, res, body);
    } catch (e) {
      log(`sse message error: ${e.stack || e.message}`);
      rpcError(res, 500, `Internal MCP error: ${e.message}`);
    }
  }

  return {
    handleStreamable,
    handleSseConnect,
    handleSseMessage,
    activeSessions: () => sessions.size,
    async close() {
      clearInterval(sweeper);
      const open = [...sessions.values()];
      sessions.clear();
      await Promise.allSettled(open.map((e) => e.transport.close()));
    },
  };
}
