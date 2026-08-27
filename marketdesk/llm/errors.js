/** Provider-neutral error types, so callers never have to know whose SDK failed. */

class LlmError extends Error {
    constructor(message, { provider, model, status, cause } = {}) {
        super(message);
        this.name = "LlmError";
        this.provider = provider;
        this.model = model;
        this.status = status;
        this.cause = cause;
    }
}

/** 429 / quota. Worth retrying with backoff, or downgrading a tier. */
class RateLimitError extends LlmError {
    constructor(message, meta) { super(message, meta); this.name = "RateLimitError"; }
}

/** Prompt too large. Retrying unchanged will not help — trim inputs. */
class ContextOverflowError extends LlmError {
    constructor(message, meta) { super(message, meta); this.name = "ContextOverflowError"; }
}

/** The run hit its USD ceiling. Not a provider failure. */
class BudgetError extends LlmError {
    constructor(message, meta) { super(message, meta); this.name = "BudgetError"; }
}

/** Content was blocked by a safety filter. */
class SafetyError extends LlmError {
    constructor(message, meta) { super(message, meta); this.name = "SafetyError"; }
}

/**
 * Gemini's 429 body carries a RetryInfo detail saying exactly how long to wait
 * ("retryDelay": "24s"). Guessing a backoff when the server has told us the
 * answer is how you end up retrying too early and burning the next quota slot.
 * @returns {number|null} milliseconds
 */
function retryAfterMs(body, headers = {}) {
    const details = body?.error?.details;
    if (Array.isArray(details)) {
        for (const d of details) {
            const raw = d?.retryDelay;
            if (typeof raw === "string") {
                const seconds = parseFloat(raw);
                if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
            }
        }
    }
    // OpenAI-shaped endpoints use the standard header instead.
    const header = headers["retry-after"];
    if (header) {
        const seconds = parseFloat(header);
        if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
    }
    return null;
}

/**
 * Whether a 429 is a per-DAY cap rather than a per-minute one.
 *
 * This matters because Gemini attaches the same RetryInfo either way — a
 * free-tier daily exhaustion still says "retryDelay: 33s", which is useless
 * advice: the quota resets tomorrow, not in half a minute. Retrying on that
 * hint just burns the retry budget and a couple of minutes of wall clock.
 */
function isDailyQuota(body) {
    const details = body?.error?.details;
    if (!Array.isArray(details)) return false;
    return details.some((d) =>
        Array.isArray(d?.violations) &&
        d.violations.some((v) => /PerDay/i.test(v?.quotaId || "")));
}

/** Map an HTTP status + body into the right class. */
function fromHttp(status, body, meta = {}) {
    const detail =
        (body && (body.error?.message || body.message)) ||
        (typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body || {}).slice(0, 400));
    const message = `${meta.provider || "llm"} ${status}: ${detail}`;
    // 402 means out of credit. No amount of retrying or tier-switching fixes
    // it, and the message already tells the operator what to do.
    if (status === 402) return new LlmError(message, { ...meta, status });

    if (status === 429) {
        const err = new RateLimitError(message, { ...meta, status });
        err.retryAfterMs = retryAfterMs(body, meta.headers);
        err.dailyQuota = isDailyQuota(body);
        return err;
    }
    if (status === 400 && /token|too long|context|exceeds/i.test(detail)) {
        return new ContextOverflowError(message, { ...meta, status });
    }
    return new LlmError(message, { ...meta, status });
}

const isRetryable = (err) => {
    // A daily cap is not a transient condition; waiting cannot clear it.
    if (err instanceof RateLimitError) return !err.dailyQuota;
    return err instanceof LlmError && [500, 502, 503, 504, 529].includes(err.status);
};

module.exports = {
    LlmError, RateLimitError, ContextOverflowError, BudgetError, SafetyError,
    fromHttp, isRetryable, retryAfterMs, isDailyQuota,
};
