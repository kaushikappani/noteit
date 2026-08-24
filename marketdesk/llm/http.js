/** Shared HTTP for the provider adapters: throttle, retry policy, error mapping. */

const axios = require("axios");
const { fromHttp, isRetryable, LlmError } = require("./errors");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimum gap between outbound LLM calls, process-wide.
 *
 * Gemini's free tier caps this project at 20 requests/minute. An edition build
 * fans out across companies and each agent turn is several calls, so without a
 * gate it fires a burst, collects 429s, and then sits out 40-60 second server-
 * mandated backoffs — far slower overall than simply pacing the calls.
 *
 * 3500ms gives roughly 17 requests/minute, which stays under the cap with a
 * little headroom. Set LLM_MIN_INTERVAL_MS=0 on a paid key, where bursting is
 * free and this would only slow the build down.
 */
const MIN_INTERVAL_MS = Number(
    process.env.LLM_MIN_INTERVAL_MS === undefined ? 3500 : process.env.LLM_MIN_INTERVAL_MS
);

// A promise chain rather than a timestamp check, so concurrent callers queue
// instead of all reading the same "last call" value and racing through together.
let gate = Promise.resolve();
let lastCallAt = 0;

function throttle() {
    if (MIN_INTERVAL_MS <= 0) return Promise.resolve();
    const wait = gate.then(async () => {
        const gap = Date.now() - lastCallAt;
        if (gap < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - gap);
        lastCallAt = Date.now();
    });
    gate = wait.catch(() => {});
    return wait;
}

const MAX_BACKOFF_MS = 65000;

/**
 * POST JSON with bounded retries.
 *
 * Retries only what is worth retrying — 429 and 5xx — and prefers the server's
 * own retryDelay over a guessed backoff. Honours an AbortSignal so a stuck call
 * cannot outlive the agent run that owns it.
 */
async function postJson(url, body, {
    headers = {}, signal, timeoutMs = 180000, provider, model, retries = 3,
} = {}) {
    let lastErr;

    for (let attempt = 0; attempt <= retries; attempt++) {
        await throttle();
        try {
            const res = await axios.post(url, body, {
                headers: { "Content-Type": "application/json", ...headers },
                signal,
                timeout: timeoutMs,
                // Status is mapped here so the error carries provider context.
                validateStatus: () => true,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });
            if (res.status >= 200 && res.status < 300) return res.data;
            lastErr = fromHttp(res.status, res.data, { provider, model, headers: res.headers });
        } catch (err) {
            if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
                throw new LlmError("aborted", { provider, model, cause: err });
            }
            lastErr = new LlmError(`${provider} request failed: ${err.message}`, {
                provider, model, cause: err,
            });
            // Network-level failures and timeouts are worth another go.
            lastErr.status = lastErr.status || 503;
        }

        if (attempt < retries && isRetryable(lastErr)) {
            // Cap the server's suggestion: a multi-minute quota reset should
            // surface as a failure the caller can degrade around, not a stall.
            const suggested = Math.min(lastErr.retryAfterMs || 0, MAX_BACKOFF_MS);
            const backoff = suggested || 800 * Math.pow(2, attempt);
            console.warn(
                `[marketdesk/llm] ${lastErr.name} from ${provider}` +
                `${model ? ` (${model})` : ""} — retry ${attempt + 1}/${retries} in ${Math.round(backoff / 1000)}s`
            );
            await sleep(backoff);
            continue;
        }
        throw lastErr;
    }
    throw lastErr;
}

module.exports = { postJson, sleep, MIN_INTERVAL_MS };
