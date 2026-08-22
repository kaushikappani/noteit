/**
 * Redis-backed store for durable MCP logins.
 *
 * See mcp-server/src/grants.js for what a grant is and why it exists. The short
 * version: the MCP session map lives in process memory, this app runs on a plan
 * that stops the process whenever it goes idle, and until now the user's JWT
 * lived only in that map. Every cold start was a silent mass logout. Redis is
 * already here holding the login tokens, so the grant goes there too and the
 * login stops caring how many times the web service restarts.
 *
 * Stored under sha256(key), so a Redis dump yields no usable credentials — the
 * only copy of the key itself is the one the client kept.
 */
const client = require("./redis");

const KEY_PREFIX = "mcp_grant:";
// Long enough to hold a key nobody would want truncated, short enough that a
// junk Authorization header can't be used to write a huge Redis key.
const MAX_HASH_LEN = 128;

function redisKey(hash) {
    return `${KEY_PREFIX}${hash}`;
}

/** sha256 hex, and nothing else — this string goes straight into a Redis key. */
function isHash(hash) {
    return typeof hash === "string" && hash.length <= MAX_HASH_LEN && /^[a-f0-9]{64}$/.test(hash);
}

/** node-redis is in legacyMode here, so everything is callbacks. */
function promisify(fn) {
    return new Promise((resolve, reject) => {
        fn((err, value) => (err ? reject(err) : resolve(value)));
    });
}

function createRedisGrantStore() {
    return {
        durable: true,

        async save(hash, record, ttlMs) {
            if (!isHash(hash)) throw new Error("Invalid grant hash");
            const payload = JSON.stringify(record);
            await promisify((cb) => client.set(redisKey(hash), payload, "PX", ttlMs, cb));
        },

        async load(hash) {
            if (!isHash(hash)) return null;
            const raw = await promisify((cb) => client.get(redisKey(hash), cb));
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch (_) {
                // Corrupt entry: drop it rather than wedging the client on it forever.
                await this.delete(hash);
                return null;
            }
        },

        async delete(hash) {
            if (!isHash(hash)) return;
            await promisify((cb) => client.del(redisKey(hash), cb));
        },
    };
}

module.exports = { createRedisGrantStore };
