/**
 * A rotating pool of API keys for one provider.
 *
 * Free-tier Gemini quota is per project per model per day, so several keys from
 * different projects are genuinely separate allowances rather than the same
 * bucket under another name. One edition build needs far more calls than a
 * single free key allows, so the pool exists to spread the load and to survive
 * a key running dry mid-build.
 *
 * Two behaviours, and the difference matters:
 *
 *   ALTERNATE  every call starts from the next key in the ring, so N keys carry
 *              roughly 1/N of the traffic each. This is what keeps any single
 *              key from hitting its per-minute cap while the others sit idle.
 *   FAIL OVER  when a key answers 429/404/auth-error, the same call is retried
 *              on the next eligible key rather than failing.
 *
 * With exactly one key both reduce to "use that key", with no extra round trips
 * and no behaviour change from having no pool at all.
 *
 * Keys carry state between calls, so the pool must be shared process-wide —
 * rediscovering the same exhausted key on every call costs a round trip each
 * time. Use getPool(), not createKeyPool(), so the chat provider and the
 * grounding search converge on one pool for the same key list.
 */

const { LlmError } = require("./errors");
const { configureThrottle } = require("./http");

const MINUTE_MS = 60 * 1000;
const DEFAULT_RATE_COOLDOWN_MS = 60 * 1000;

/**
 * How long a daily-quota key sits out.
 *
 * Google's free tier resets at midnight Pacific. Waiting for the exact boundary
 * would need timezone maths that goes stale the moment Google moves it, so this
 * parks the key until the next UTC midnight instead: never longer than a day,
 * and always long enough that a retry inside the same build cannot waste a call
 * on a key that has nothing left.
 */
function nextUtcMidnight(now) {
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    return next.getTime();
}

/** A key that is malformed or revoked, as opposed to merely out of quota. */
const AUTH_PATTERN =
    /api[_ -]?key not valid|api[_ -]?key.*invalid|invalid.*api[_ -]?key|api_key_invalid|permission[_ ]denied|unauthenticated|unauthorized|invalid authentication|incorrect api key/i;

/**
 * Classify a failure from the key's point of view.
 * @returns {"rate"|"daily"|"model"|"auth"|"other"}
 */
function classify(err) {
    const message = String(err?.message || "");
    if (err?.status === 429) return err.dailyQuota ? "daily" : "rate";
    // 404 is per project: Google retires models per key, so another project may
    // still serve this one. Worth the next key, not worth failing the build.
    if (err?.status === 404) return "model";
    // A bad key answers 400 INVALID_ARGUMENT / 403 PERMISSION_DENIED. Crucially
    // this must NOT be fatal: one malformed key in the pool would otherwise take
    // down every call that happened to land on it.
    if ((err?.status === 400 || err?.status === 401 || err?.status === 403) && AUTH_PATTERN.test(message)) {
        return "auth";
    }
    if (err?.status === 401 || err?.status === 403) return "auth";
    return "other";
}

/**
 * Log label for a key: always its position, plus a masked fingerprint when the
 * key is long enough for one to be meaningful.
 *
 * Position alone is what makes a log line actionable ("key #2 is invalid" tells
 * you which entry of GEMINI_API_KEYS to replace); the fingerprint is there to
 * confirm you are looking at the right one. Never the whole key.
 */
function label(key, index) {
    const text = String(key || "");
    const position = `#${index + 1}`;
    return text.length >= 16 ? `${position} (${text.slice(0, 6)}…${text.slice(-4)})` : position;
}

function createKeyPool({ keys, provider }) {
    // Dedupe: the same key twice is one allowance, and pretending otherwise just
    // spends a round trip proving it.
    const unique = [...new Set((keys || []).map((k) => String(k || "").trim()).filter(Boolean))];
    if (!unique.length) {
        throw new LlmError(`${provider} API key is not set`, { provider });
    }

    const slots = unique.map((key, index) => ({
        key,
        label: label(key, index),
        dead: null,          // permanent: malformed / revoked
        cooledUntil: 0,      // transient: 429
        unavailable: new Set(), // models this key cannot serve (404)
        calls: 0,
        failures: 0,
    }));

    // Where the next call starts. Advanced on EVERY call, which is what makes
    // the pool alternate rather than hammer key 1 until it dies.
    let cursor = 0;
    const single = slots.length === 1;

    const liveCount = () => slots.filter((s) => !s.dead).length;

    /**
     * The per-minute gate in http.js is global and sized for ONE key. N live keys
     * have N times the allowance, so keeping the one-key pace would make extra
     * keys buy reliability but no speed. Re-sized whenever a key dies.
     */
    function syncThrottle() {
        configureThrottle({ divisor: Math.max(1, liveCount()) });
    }
    syncThrottle();

    /** Slots eligible for `model`, in round-robin order from the cursor. */
    function eligible(model, now) {
        const ordered = [];
        for (let i = 0; i < slots.length; i++) {
            ordered.push(slots[(cursor + i) % slots.length]);
        }
        const ready = ordered.filter(
            (s) => !s.dead && s.cooledUntil <= now && !(model && s.unavailable.has(model))
        );
        if (ready.length) return ready;

        // Everything is cooling. Rather than fail outright, offer the ones whose
        // cooldown is nearest to expiry: postJson's own backoff may well outlast
        // a per-minute cooldown, in which case the call still succeeds.
        return ordered
            .filter((s) => !s.dead && !(model && s.unavailable.has(model)))
            .sort((a, b) => a.cooledUntil - b.cooledUntil);
    }

    function note(slot, kind, err, model, now) {
        slot.failures += 1;
        if (kind === "auth") {
            slot.dead = err?.message?.slice(0, 200) || "authentication failed";
            // liveCount() already reflects the drop — slot.dead is set above.
            console.warn(
                `[marketdesk/llm] ${provider} key ${slot.label} is invalid and has been dropped ` +
                `from the pool (${liveCount()}/${slots.length} usable): ${slot.dead}`
            );
            syncThrottle();
            return;
        }
        if (kind === "daily") {
            slot.cooledUntil = nextUtcMidnight(now);
            console.warn(
                `[marketdesk/llm] ${provider} key ${slot.label} hit its DAILY quota` +
                `${model ? ` for ${model}` : ""} — resting until ${new Date(slot.cooledUntil).toISOString()}`
            );
            return;
        }
        if (kind === "rate") {
            const wait = Math.min(err?.retryAfterMs || DEFAULT_RATE_COOLDOWN_MS, 5 * MINUTE_MS);
            slot.cooledUntil = now + wait;
            return;
        }
        if (kind === "model" && model) {
            slot.unavailable.add(model);
            console.warn(
                `[marketdesk/llm] ${provider} key ${slot.label} cannot serve ${model} (404) — ` +
                "not trying that pairing again"
            );
        }
    }

    /**
     * Run `fn` with a key, failing over to the next eligible key.
     *
     * @param {(key: string) => Promise<any>} fn
     * @param {{model?: string}} [opts]
     */
    async function run(fn, { model } = {}) {
        const now = Date.now();
        const candidates = eligible(model, now);

        if (!candidates.length) {
            const why = slots.every((s) => s.dead)
                ? "every key is invalid"
                : `no key can serve ${model}`;
            throw new LlmError(`${provider}: ${why}`, { provider, model });
        }

        // Alternate: the next call begins one further along the ring. Done before
        // the attempts so a throwing call still moves the cursor and cannot pin
        // every subsequent call to the same key.
        cursor = (cursor + 1) % slots.length;

        let lastErr;
        for (let i = 0; i < candidates.length; i++) {
            const slot = candidates[i];
            slot.calls += 1;
            try {
                return await fn(slot.key);
            } catch (err) {
                lastErr = err;
                const kind = classify(err);
                if (kind === "other") throw err;   // not the key's fault
                note(slot, kind, err, model, Date.now());

                const remaining = candidates.length - i - 1;
                if (!remaining) break;
                console.warn(
                    `[marketdesk/llm] ${provider} key ${slot.label} failed (${kind})` +
                    `${model ? ` on ${model}` : ""} — switching to ${candidates[i + 1].label}` +
                    ` (${remaining} alternative${remaining === 1 ? "" : "s"} left)`
                );
            }
        }
        throw lastErr;
    }

    return {
        provider,
        size: slots.length,
        single,
        run,
        /**
         * Keys not permanently dropped. Callers use this to decide whether a 429
         * is worth waiting out (one key) or worth rotating past (several).
         */
        liveCount,
        /** Keys that could serve a call right now — excludes those cooling off. */
        readyCount: (model) => eligible(model, Date.now())
            .filter((s) => s.cooledUntil <= Date.now()).length,
        /** Diagnostics for the admin/status surfaces. Never exposes a whole key. */
        stats: () => slots.map((s) => ({
            key: s.label,
            calls: s.calls,
            failures: s.failures,
            dead: !!s.dead,
            reason: s.dead || null,
            cooling: s.cooledUntil > Date.now() ? new Date(s.cooledUntil).toISOString() : null,
            unavailableModels: [...s.unavailable],
        })),
    };
}

/**
 * Process-wide pool cache.
 *
 * getProvider() is called per build and the grounding search builds a second
 * Gemini adapter, so without this each would carry its own idea of which keys
 * are spent and re-learn every 429 the hard way.
 */
const cache = new Map();

function getPool({ keys, provider }) {
    const unique = [...new Set((keys || []).map((k) => String(k || "").trim()).filter(Boolean))];
    const cacheKey = `${provider}:${unique.join("|")}`;
    if (!cache.has(cacheKey)) {
        cache.set(cacheKey, createKeyPool({ keys: unique, provider }));
    }
    return cache.get(cacheKey);
}

/** Test seam. */
function resetPools() { cache.clear(); }

module.exports = { createKeyPool, getPool, resetPools, classify };
