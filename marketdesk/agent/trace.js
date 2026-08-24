/**
 * Run traces.
 *
 * An edition is built unattended twice a day, so when one comes out wrong the
 * only way to find out why is to have kept what the model was asked and what
 * the tools answered. Payloads are trimmed before storage — the point is
 * diagnosis, not a byte-exact replay.
 */

const { MdAgentRun } = require("../models");

const MAX_FIELD = 4000;

const trim = (value) => {
    if (value === undefined || value === null) return value;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > MAX_FIELD ? `${text.slice(0, MAX_FIELD)}… [${text.length} chars]` : text;
};

/**
 * @returns a tracer with .iteration(), .finish() and .fail(); every method
 *          swallows its own storage errors, because losing a trace must never
 *          fail the run it was observing.
 */
async function startTrace({ editionId, purpose, provider, model }) {
    let doc = null;
    try {
        doc = await MdAgentRun.create({
            editionId, purpose, provider, model,
            status: "running", startedAt: new Date(), iterations: [],
        });
    } catch (err) {
        console.error(`[marketdesk/trace] could not open trace: ${err.message}`);
    }

    const safe = async (fn) => {
        if (!doc) return;
        try { await fn(); } catch (err) {
            console.error(`[marketdesk/trace] ${err.message}`);
        }
    };

    return {
        get id() { return doc?._id || null; },

        iteration: (entry) => safe(() => MdAgentRun.updateOne({ _id: doc._id }, {
            $push: {
                iterations: {
                    i: entry.i,
                    request: {
                        system: trim(entry.system),
                        messages: trim(entry.messages),
                        tools: (entry.tools || []).map((t) => t.name),
                    },
                    text: trim(entry.text),
                    toolCalls: trim(entry.toolCalls),
                    toolResults: trim(entry.toolResults),
                    finishReason: entry.finishReason,
                    usage: entry.usage,
                    ms: entry.ms,
                },
            },
        })),

        finish: (status, totalUsage) => safe(() => MdAgentRun.updateOne({ _id: doc._id }, {
            $set: { status, totalUsage, endedAt: new Date() },
        })),

        fail: (error) => safe(() => MdAgentRun.updateOne({ _id: doc._id }, {
            $set: { status: "failed", error: String(error?.message || error).slice(0, 1000), endedAt: new Date() },
        })),
    };
}

module.exports = { startTrace };
