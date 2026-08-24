/**
 * The things that stop an agent run from becoming unbounded: a spend ceiling,
 * a wall-clock ceiling, and a per-tool timeout.
 */

const { BudgetError } = require("../llm/errors");

/**
 * Tracks accumulated spend and refuses the next provider call once the ceiling
 * is reached. Checked before each call rather than after, so the ceiling is
 * never overshot by a whole request.
 */
class BudgetGuard {
    constructor({ maxUsd = 0.5 } = {}) {
        this.maxUsd = maxUsd;
        this.usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }

    add(usage = {}) {
        this.usage.inputTokens += usage.inputTokens || 0;
        this.usage.outputTokens += usage.outputTokens || 0;
        this.usage.costUsd += usage.costUsd || 0;
        return this.usage;
    }

    get exhausted() { return this.maxUsd > 0 && this.usage.costUsd >= this.maxUsd; }

    assert(context = "") {
        if (this.exhausted) {
            throw new BudgetError(
                `run budget of $${this.maxUsd} reached ($${this.usage.costUsd.toFixed(4)} spent)${context ? ` before ${context}` : ""}`
            );
        }
    }
}

/** An AbortSignal that fires after ms, plus a clear() to stop the timer. */
function deadline(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Run a promise with a timeout.
 *
 * The tool handler receives the signal so a well-behaved one can cancel its own
 * HTTP call; the race is there for handlers that ignore it.
 */
async function withTimeout(ms, fn, label = "operation") {
    const { signal, clear } = deadline(ms);
    try {
        return await Promise.race([
            fn(signal),
            new Promise((_, reject) =>
                signal.addEventListener("abort", () =>
                    reject(new Error(`${label} timed out after ${ms}ms`)))),
        ]);
    } finally {
        clear();
    }
}

/** Bounded concurrency over a list — used for the per-company pass. */
async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            try {
                results[index] = await fn(items[index], index);
            } catch (err) {
                // One item's failure must not sink the batch; the caller filters nulls.
                console.error(`[marketdesk] item ${index} failed: ${err.message}`);
                results[index] = null;
            }
        }
    });
    await Promise.all(workers);
    return results;
}

module.exports = { BudgetGuard, deadline, withTimeout, mapWithConcurrency };
