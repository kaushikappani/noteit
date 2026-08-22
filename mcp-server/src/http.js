import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createNoteitServer } from "./server.js";
import { createMemoryGrantStore, grantKeyFromHeaders, hashGrantKey } from "./grants.js";

// A month. Sessions are a cache in front of the grant store now, not the thing
// that holds a login: a client presenting a grant key re-authenticates whatever
// session it lands on, so losing one costs a handshake rather than a sign-in.
// Kept long anyway for clients that don't store the credential.
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

// With a month-long TTL the sweeper no longer bounds the map, so this does.
// Each entry pins a Server, a transport and a JWT for as long as it lives, and
// every re-handshake adds one.
const DEFAULT_MAX_SESSIONS = 500;

// How long a session may trust a grant it has already resolved before checking
// the store again. Caps how long a revoked login keeps working on a session
// that is still open somewhere else.
const GRANT_RECHECK_MS = 60 * 1000;

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
export function createMcpHttpHandlers({
  sessionTtlMs,
  maxSessions,
  ssePath,
  grants = createMemoryGrantStore(),
  log = () => {},
} = {}) {
  const ttl =
    sessionTtlMs ?? (Number(process.env.MCP_SESSION_TTL_MS) || DEFAULT_SESSION_TTL_MS);
  const cap =
    maxSessions ?? (Number(process.env.MCP_MAX_SESSIONS) || DEFAULT_MAX_SESSIONS);

  // Streaming an SSE body through a compressing proxy is where hosted MCP most
  // often breaks, so plain JSON replies are the default. MCP_JSON_RESPONSE=false
  // opts back into spec-preferred SSE streaming.
  const enableJsonResponse = process.env.MCP_JSON_RESPONSE !== "false";

  /** sessionId -> { transport, server, api, session, lastSeen, kind } */
  const sessions = new Map();

  /**
   * Re-attach a stored login to this session, if the client presented a grant key.
   *
   * This is what makes a login outlive the process. The session map is memory
   * and dies with the server; the grant store is not. A client that kept its
   * key gets re-authenticated here on the very first request of a brand new
   * session, so a restart, a redeploy or a second instance costs it a handshake
   * and nothing else.
   *
   * A key that no longer resolves — revoked by logout, or expired — is simply
   * ignored rather than rejected: the session stays open and unauthenticated,
   * and the tools say "not logged in", which is the truth and is recoverable.
   */
  async function applyGrant(req, entry) {
    if (!entry?.api || !entry?.session) return;

    const key = grantKeyFromHeaders(req.headers);
    if (!key) return;

    const hash = hashGrantKey(key);

    // Already bound to this grant: skip the lookup, but not forever. Revocation
    // happens in the store, and a session that never looks again would keep
    // working after another client called logout. Re-checking on a timer bounds
    // that window without a Redis round trip on every single tool call.
    const fresh = Date.now() - (entry.session.grantCheckedAt || 0) < GRANT_RECHECK_MS;
    if (entry.session.grantHash === hash && entry.api.isAuthenticated() && fresh) return;

    let record;
    try {
      record = await grants.load(hash);
    } catch (e) {
      log(`grant lookup failed: ${e.message}`);
      return;
    }

    if (!record?.token) {
      // Only interesting once per session; after that it is just noise.
      if (entry.session.grantHash !== null) {
        entry.session.grantHash = null;
        entry.api.clearToken();
        log(`grant no longer valid (${entry.kind}) — client must log in again`);
      }
      return;
    }

    entry.api.setToken(record.token);
    entry.session.grantHash = hash;
    entry.session.grantCheckedAt = Date.now();
  }

  function track(id, kind, transport, server, api, session) {
    sessions.set(id, { transport, server, api, session, lastSeen: Date.now(), kind });
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
   * needs no credentials, so anyone can create them cheaply; a plain
   * least-recently-used cap would let that evict every signed-in user. An
   * attacker's sessions never authenticate, so spending those first means a
   * flood costs them their own sessions rather than someone else's work.
   *
   * Evicting an authenticated session is still logged loudly. A client holding
   * a grant re-authenticates on its next request and never notices, but one
   * that does not store the credential has to sign in again — either way it
   * means the cap is too low rather than that something went stale.
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
      const cost = signedIn(entry)
        ? " — that client re-authenticates on its next request only if it kept its grant key"
        : " (never logged in)";
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
        await applyGrant(req, entry);
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

      const { server, api, session } = createNoteitServer({ grants });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse,
        onsessioninitialized: (id) => track(id, "streamable-http", transport, server, api, session),
        onsessionclosed: (id) => {
          sessions.delete(id);
          log(`session terminated by client: ${id}`);
        },
      });

      await server.connect(transport);
      // Before the handshake is answered, so a returning client is already
      // logged in by the time it asks for anything.
      await applyGrant(req, { api, session, kind: "streamable-http" });
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
      const { server, api, session } = createNoteitServer({ grants });
      const transport = new SSEServerTransport(postPath, res);
      const entry = { transport, server, api, session, kind: "sse" };
      track(transport.sessionId, "sse", transport, server, api, session);
      await applyGrant(req, entry);
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
      // The legacy transport POSTs each call to a different request than the
      // one that opened the stream, so the key arrives here too.
      await applyGrant(req, entry);
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
