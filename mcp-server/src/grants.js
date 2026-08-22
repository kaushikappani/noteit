/**
 * Durable MCP logins ("grants").
 *
 * The JWT captured by check_login used to live in the per-session API client
 * and nowhere else, which made a login exactly as durable as the Node process.
 * On Render's free plan that is about fifteen idle minutes, so every cold start
 * silently signed everyone out and the next tool call sent them back through
 * the browser flow — holding a token that was still good for another eleven
 * months. Session ids do not help: the client faithfully replays the one it
 * stored, the restarted process has never heard of it, and the 404 buys a fresh
 * session with no login in it.
 *
 * A grant moves the login out of process memory and gives the client something
 * to present instead:
 *
 *   check_login   mint a key, store sha256(key) -> { token }, and hand the key
 *                 to the client in `_meta` — never in the text the model reads
 *   any request   Authorization: Bearer <key> re-binds the token to whichever
 *                 session the client is on now, including a brand new one
 *   logout        delete the record; the key stops working everywhere at once
 *
 * Only the hash is stored, so a leaked dump of the store yields no working
 * keys, and unlike the account JWT — signed for 365 days with no revocation
 * list behind it — a grant can actually be taken away.
 *
 * Grants are additive. A client that ignores `_meta` (Claude Desktop, the
 * inspector) keeps the old session-bound behaviour exactly as it was.
 */
import { createHash, randomBytes } from "node:crypto";

/** Marks a bearer value as ours, so an unrelated Authorization header is ignored. */
export const GRANT_PREFIX = "nk_";

// Matched to the account JWT's 365d lifetime. A grant that outlived the token
// it wraps would keep answering "logged in" and then fail on the first call.
export const GRANT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const KEY_BYTES = 32;
// 32 bytes of base64url. Bounds work before hashing an attacker-supplied header.
const KEY_BODY = /^[A-Za-z0-9_-]{16,128}$/;

/** A fresh, unguessable grant key. Returned to the client; never stored as-is. */
export function mintGrantKey() {
  return GRANT_PREFIX + randomBytes(KEY_BYTES).toString("base64url");
}

/** Storage key for a grant. Hashing means the store never holds a usable credential. */
export function hashGrantKey(key) {
  return createHash("sha256").update(String(key)).digest("hex");
}

/** True for something shaped like one of our keys. Cheap reject before any lookup. */
export function isGrantKey(value) {
  return (
    typeof value === "string" &&
    value.startsWith(GRANT_PREFIX) &&
    KEY_BODY.test(value.slice(GRANT_PREFIX.length))
  );
}

/**
 * Pull a grant key out of request headers.
 *
 * `Authorization: Bearer nk_…` is the primary spelling; X-Noteit-Mcp-Key exists
 * for clients that reserve Authorization for a proxy in front of us.
 */
export function grantKeyFromHeaders(headers = {}) {
  const get = (name) => {
    const value = typeof headers.get === "function" ? headers.get(name) : headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const auth = String(get("authorization") || "").trim();
  if (auth) {
    const bearer = /^bearer\s+(.+)$/i.exec(auth);
    const candidate = bearer ? bearer[1].trim() : auth;
    if (isGrantKey(candidate)) return candidate;
  }

  const direct = String(get("x-noteit-mcp-key") || "").trim();
  return isGrantKey(direct) ? direct : null;
}

/**
 * In-memory grant store — the fallback for standalone/stdio runs.
 *
 * Deliberately no better than the thing it replaces: it dies with the process.
 * It exists so the tools behave identically without Redis wired up; the mounted
 * server passes a Redis-backed store, which is the one that fixes the bug.
 */
export function createMemoryGrantStore() {
  /** hash -> { record, expires } */
  const records = new Map();

  const live = (hash) => {
    const entry = records.get(hash);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      records.delete(hash);
      return null;
    }
    return entry;
  };

  return {
    durable: false,
    async save(hash, record, ttlMs = GRANT_TTL_MS) {
      records.set(hash, { record, expires: Date.now() + ttlMs });
    },
    async load(hash) {
      return live(hash)?.record ?? null;
    },
    async delete(hash) {
      records.delete(hash);
    },
  };
}

/**
 * `_meta` key carrying a credential from server to client.
 *
 * Not a spec feature — a convention this server and the TL;DR extension agree
 * on, namespaced so it cannot collide with anything the spec later defines.
 * The payload is `{ header, value, expiresInMs }` to set one, or `null` to tell
 * the client to throw away whatever it stored.
 */
export const CREDENTIAL_META_KEY = "mcp.client/credential";

/**
 * Build the `_meta` a client reads to start (or stop) sending a grant key.
 * `ttlMs` should match what the store was told, so the client stops sending a
 * key at the same moment the server stops honouring it.
 */
export function credentialMeta(key, ttlMs = GRANT_TTL_MS) {
  return {
    [CREDENTIAL_META_KEY]: key
      ? { header: "Authorization", value: `Bearer ${key}`, expiresInMs: ttlMs }
      : null,
  };
}
