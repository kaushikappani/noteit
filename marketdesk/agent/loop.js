/**
 * The agent loop.
 *
 * Provider-neutral by construction: it only ever calls provider.chat() with the
 * canonical message shape, so the same loop drives Gemini, OpenAI or OpenRouter
 * unchanged. Kept separate from every market-specific concern — the domain
 * arrives only as a system prompt, a task string and a set of tools.
 */

const { BudgetGuard, withTimeout } = require("./guards");
const { startTrace } = require("./trace");
const { BudgetError } = require("../llm/errors");

/**
 * Execute the tool calls a model asked for.
 *
 * A failing tool comes back as a result the model can read and react to, not as
 * an exception. That is what lets one company's news lookup fail without taking
 * the whole edition down with it.
 */
async function dispatch(toolCalls, registry, ctx, timeoutMs) {
    const results = [];
    for (const call of toolCalls) {
        const tool = registry.get(call.name);
        if (!tool) {
            results.push({ call, content: { error: `unknown tool "${call.name}"` } });
            continue;
        }
        if (call.args?.__parseError !== undefined) {
            results.push({
                call,
                content: { error: "arguments were not valid JSON; resend them as a JSON object" },
            });
            continue;
        }
        try {
            const value = await withTimeout(
                timeoutMs,
                (signal) => tool.handler(call.args || {}, { ...ctx, signal }),
                `tool ${call.name}`
            );
            results.push({ call, content: value === undefined ? { ok: true } : value });
        } catch (err) {
            results.push({ call, content: { error: String(err.message || err).slice(0, 500) } });
        }
    }
    return results;
}

/**
 * @param {object} opts
 * @param {object} opts.provider       from llm/index.js getProvider()
 * @param {ToolRegistry} opts.registry
 * @param {string} opts.system
 * @param {string} opts.task           the opening user message
 * @param {string[]} [opts.toolNames]  subset of the registry to expose
 * @param {object} [opts.responseFormat]
 * @param {string} [opts.tier]         fast | balanced | deep
 * @param {object} [opts.ctx]          passed to every tool handler
 * @returns {Promise<{text, citations, usage, iterations, finishReason, traceId}>}
 */
async function runAgent({
    provider, registry, system, task,
    toolNames, responseFormat, tier = "balanced",
    maxIterations = 8, toolTimeoutMs = 20000, runTimeoutMs = 180000,
    maxUsd = 0.5, ctx = {}, editionId, purpose = "agent", temperature = 0.5,
    maxTokens = 4096,
}) {
    const budget = new BudgetGuard({ maxUsd });
    const tools = registry ? registry.declarations(toolNames) : [];
    const messages = [{ role: "user", content: task }];
    const citations = [];
    const startedAt = Date.now();

    const trace = await startTrace({
        editionId, purpose, provider: provider.name, model: provider.resolveModel(tier),
    });

    let finishReason = "stop";
    let text = null;

    try {
        for (let i = 1; i <= maxIterations; i++) {
            if (Date.now() - startedAt > runTimeoutMs) {
                finishReason = "timeout";
                break;
            }
            budget.assert(`iteration ${i}`);

            const iterationStart = Date.now();
            const result = await provider.chat({
                system, messages, tools,
                // Structured output is requested only once the model has stopped
                // calling tools; asking for it earlier fights with tool calling.
                responseFormat: tools.length ? undefined : responseFormat,
                tier, temperature, maxTokens,
            });

            budget.add(result.usage);
            if (result.citations?.length) citations.push(...result.citations);
            text = result.text ?? text;
            finishReason = result.finishReason;

            if (result.finishReason !== "tool_calls" || !result.toolCalls.length) {
                await trace.iteration({
                    i, system, messages, tools, text: result.text,
                    finishReason: result.finishReason, usage: result.usage,
                    ms: Date.now() - iterationStart,
                });
                break;
            }

            const toolResults = await dispatch(result.toolCalls, registry, ctx, toolTimeoutMs);

            messages.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });
            for (const { call, content } of toolResults) {
                messages.push({
                    role: "tool", name: call.name, toolCallId: call.id, content,
                });
                if (Array.isArray(content?.citations)) citations.push(...content.citations);
            }

            await trace.iteration({
                i, system, messages, tools, text: result.text,
                toolCalls: result.toolCalls, toolResults: toolResults.map((r) => ({
                    name: r.call.name, content: r.content,
                })),
                finishReason: result.finishReason, usage: result.usage,
                ms: Date.now() - iterationStart,
            });

            if (i === maxIterations) finishReason = "max_iterations";
        }

        // Two reasons to make one more call with tools switched off.
        //
        // 1. A tool-using run can end without prose, leaving nothing to return.
        // 2. Structured output cannot be requested while tools are declared —
        //    the two fight with each other — so a run that wants JSON has been
        //    answering in prose up to this point and still owes us the JSON.
        const owesStructuredAnswer = !!responseFormat && tools.length > 0;

        if ((!text || owesStructuredAnswer) && finishReason !== "budget") {
            budget.assert("final answer");

            // Hand back the prose the model just wrote so this call reformats an
            // answer it already reasoned through, rather than starting over.
            const closingMessages = [...messages];
            if (text && owesStructuredAnswer) {
                closingMessages.push({ role: "assistant", content: text });
                closingMessages.push({
                    role: "user",
                    content: "Now return exactly that analysis as JSON matching the required schema. Add nothing new.",
                });
            }

            const closing = await provider.chat({
                system, messages: closingMessages, tools: [],
                responseFormat, tier, temperature, maxTokens,
            });
            budget.add(closing.usage);
            if (closing.text) text = closing.text;
            if (closing.citations?.length) citations.push(...closing.citations);
        }

        await trace.finish(finishReason === "budget" ? "budget" : "done", budget.usage);
    } catch (err) {
        if (err instanceof BudgetError) {
            finishReason = "budget";
            await trace.finish("budget", budget.usage);
            console.warn(`[marketdesk/agent] ${purpose}: ${err.message}`);
        } else {
            await trace.fail(err);
            throw err;
        }
    }

    // Same URL surfacing from several tools should appear once.
    const seen = new Set();
    const unique = citations.filter((c) => c?.url && !seen.has(c.url) && seen.add(c.url));

    return {
        text, citations: unique, usage: budget.usage,
        finishReason, traceId: trace.id, ms: Date.now() - startedAt,
    };
}

module.exports = { runAgent, dispatch };
