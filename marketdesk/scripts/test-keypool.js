/**
 * Behaviour check for llm/keyPool.js — no network, no API keys needed.
 *
 *     node marketdesk/scripts/test-keypool.js
 *
 * Covers the cases that actually bite: alternation across calls, failover on a
 * spent key, a malformed key being dropped rather than killing the call, and a
 * single-key pool behaving exactly as it did before the pool existed.
 */

const assert = require("assert");
const { createKeyPool, classify } = require("../llm/keyPool");

let passed = 0;
function test(name, fn) {
    return Promise.resolve()
        .then(fn)
        .then(() => { passed += 1; console.log(`  ok   ${name}`); })
        .catch((err) => { console.error(`  FAIL ${name}\n       ${err.message}`); process.exitCode = 1; });
}

/** An error shaped like the ones llm/errors.js produces. */
function httpError(status, message, extra = {}) {
    const err = new Error(`gemini ${status}: ${message}`);
    err.name = status === 429 ? "RateLimitError" : "LlmError";
    err.status = status;
    Object.assign(err, extra);
    return err;
}

async function main() {
    console.log("keyPool");

    await test("alternates across consecutive calls", async () => {
        const pool = createKeyPool({ keys: ["a", "b", "c"], provider: "test" });
        const used = [];
        for (let i = 0; i < 6; i++) {
            await pool.run(async (key) => { used.push(key); return "ok"; });
        }
        // Round-robin, so each key carries a third of six calls.
        const counts = used.reduce((acc, k) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {});
        assert.deepStrictEqual(counts, { a: 2, b: 2, c: 2 }, `spread was ${JSON.stringify(counts)}`);
        // And no key is used twice in a row.
        for (let i = 1; i < used.length; i++) {
            assert.notStrictEqual(used[i], used[i - 1], `key repeated back-to-back at ${i}`);
        }
    });

    await test("single key is used every time, no rotation", async () => {
        const pool = createKeyPool({ keys: ["solo"], provider: "test" });
        assert.strictEqual(pool.single, true);
        const used = [];
        for (let i = 0; i < 3; i++) await pool.run(async (k) => { used.push(k); });
        assert.deepStrictEqual(used, ["solo", "solo", "solo"]);
    });

    await test("single key surfaces its error rather than looping", async () => {
        const pool = createKeyPool({ keys: ["solo"], provider: "test" });
        let attempts = 0;
        await assert.rejects(
            pool.run(async () => { attempts += 1; throw httpError(429, "quota"); }),
            /429/
        );
        assert.strictEqual(attempts, 1, `tried ${attempts} times, expected 1`);
    });

    await test("fails over to the next key on 429", async () => {
        const pool = createKeyPool({ keys: ["spent", "fresh"], provider: "test" });
        const tried = [];
        const out = await pool.run(async (key) => {
            tried.push(key);
            if (key === "spent") throw httpError(429, "rate limit");
            return "served";
        });
        assert.strictEqual(out, "served");
        assert.ok(tried.includes("spent") && tried.includes("fresh"), `tried ${tried}`);
    });

    await test("a daily-quota key is skipped on later calls", async () => {
        const pool = createKeyPool({ keys: ["dead-today", "good"], provider: "test" });
        // Burn the first key with a per-day 429.
        await pool.run(async (key) => {
            if (key === "dead-today") throw httpError(429, "quota", { dailyQuota: true });
            return "served";
        });
        // It must not be offered again while it is resting.
        const seen = [];
        for (let i = 0; i < 4; i++) {
            await pool.run(async (key) => { seen.push(key); return "ok"; });
        }
        assert.ok(!seen.includes("dead-today"), `rested key was reused: ${seen}`);
        assert.deepStrictEqual([...new Set(seen)], ["good"]);
    });

    await test("a malformed key is dropped, not fatal", async () => {
        const pool = createKeyPool({ keys: ["bad", "good"], provider: "test" });
        const out = await pool.run(async (key) => {
            if (key === "bad") throw httpError(400, "API key not valid. Please pass a valid API key.");
            return "served";
        });
        assert.strictEqual(out, "served");

        const stats = pool.stats();
        const bad = stats.find((s) => s.dead);
        assert.ok(bad, "expected the bad key to be marked dead");
        assert.strictEqual(pool.liveCount(), 1);

        // Later calls must not spend a round trip on it again.
        const seen = [];
        await pool.run(async (key) => { seen.push(key); return "ok"; });
        assert.deepStrictEqual(seen, ["good"]);
    });

    await test("404 is remembered per key+model, not per key", async () => {
        const pool = createKeyPool({ keys: ["old", "new"], provider: "test" });
        await pool.run(async (key) => {
            if (key === "old") throw httpError(404, "model not available");
            return "served";
        }, { model: "gemini-2.5-pro" });

        // The same key is still fine for a different model.
        const seen = [];
        for (let i = 0; i < 4; i++) {
            await pool.run(async (key) => { seen.push(key); return "ok"; }, { model: "gemini-3.5-flash" });
        }
        assert.ok(seen.includes("old"), "key was blacklisted wholesale instead of per model");
    });

    await test("a non-key error is not retried on another key", async () => {
        const pool = createKeyPool({ keys: ["a", "b", "c"], provider: "test" });
        let attempts = 0;
        await assert.rejects(
            pool.run(async () => { attempts += 1; throw httpError(500, "internal"); }),
            /500/
        );
        assert.strictEqual(attempts, 1, `a 500 burned ${attempts} keys, expected 1`);
    });

    await test("duplicate keys collapse to one allowance", async () => {
        const pool = createKeyPool({ keys: ["same", "same", " same "], provider: "test" });
        assert.strictEqual(pool.size, 1);
    });

    await test("empty pool is rejected up front", () => {
        assert.throws(() => createKeyPool({ keys: [], provider: "test" }), /API key is not set/);
        assert.throws(() => createKeyPool({ keys: [null, "", "  "], provider: "test" }), /API key is not set/);
    });

    await test("classify maps statuses to the right treatment", () => {
        assert.strictEqual(classify(httpError(429, "x")), "rate");
        assert.strictEqual(classify(httpError(429, "x", { dailyQuota: true })), "daily");
        assert.strictEqual(classify(httpError(404, "x")), "model");
        assert.strictEqual(classify(httpError(400, "API key not valid")), "auth");
        assert.strictEqual(classify(httpError(403, "PERMISSION_DENIED")), "auth");
        // A plain 400 is a bad request, not a bad key — must not drop the key.
        assert.strictEqual(classify(httpError(400, "invalid argument: contents")), "other");
        assert.strictEqual(classify(httpError(500, "boom")), "other");
    });

    console.log(`\n${passed} passed${process.exitCode ? ", with failures" : ""}`);
}

main();
