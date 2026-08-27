/**
 * Adapter for every OpenAI-shaped /chat/completions endpoint — OpenAI itself,
 * OpenRouter, and anything else that copies the format (Groq, Together, a local
 * vLLM). Written against REST rather than the `openai` package so a version bump
 * cannot change behaviour, and so OpenRouter needs no second client.
 */

const { postJson } = require("../http");
const { getPool } = require("../keyPool");
const { LlmError, SafetyError } = require("../errors");
const { toOpenAITools, toOpenAIToolChoice } = require("../toolSchema");
const { estimateCostUsd, env: llmEnv } = require("../../config/settings");

/** Canonical messages -> OpenAI `messages`. */
function toOpenAIMessages(messages = [], system) {
    const out = [];
    if (system) out.push({ role: "system", content: system });
    for (const m of messages) {
        if (m.role === "tool") {
            out.push({
                role: "tool",
                tool_call_id: m.toolCallId,
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? {}),
            });
            continue;
        }
        if (m.role === "assistant") {
            const msg = { role: "assistant", content: m.content || null };
            if (m.toolCalls?.length) {
                msg.tool_calls = m.toolCalls.map((c) => ({
                    id: c.id,
                    type: "function",
                    function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
                }));
            }
            out.push(msg);
            continue;
        }
        out.push({ role: "user", content: String(m.content ?? "") });
    }
    return out;
}

const FINISH = {
    stop: "stop", tool_calls: "tool_calls", length: "length",
    content_filter: "safety", function_call: "tool_calls",
};

function fromResponse(data, model) {
    const choice = data?.choices?.[0];
    if (!choice) throw new LlmError("no choices in response", { model });
    if (choice.finish_reason === "content_filter") {
        throw new SafetyError("response blocked by content filter", { model });
    }

    const toolCalls = (choice.message?.tool_calls || [])
        .filter((c) => c.function?.name)
        .map((c) => {
            let args = {};
            try {
                args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
            } catch {
                // A model that emits malformed JSON should surface as a tool error
                // the loop can feed back, not as a crash here.
                args = { __parseError: c.function.arguments };
            }
            return { id: c.id, name: c.function.name, args };
        });

    const usage = data?.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    // OpenRouter returns web citations as message annotations when :online is used.
    const citations = (choice.message?.annotations || [])
        .filter((a) => a.url_citation?.url)
        .map((a) => ({ title: a.url_citation.title || a.url_citation.url, url: a.url_citation.url }));

    return {
        text: choice.message?.content?.trim() || null,
        toolCalls,
        finishReason: toolCalls.length ? "tool_calls" : (FINISH[choice.finish_reason] || "stop"),
        usage: { inputTokens, outputTokens, costUsd: estimateCostUsd(model, inputTokens, outputTokens) },
        citations,
        raw: data,
    };
}

/**
 * @param {object} opts
 * @param {string} opts.name          provider label, e.g. "openai" | "openrouter"
 * @param {string} opts.baseUrl       up to and including /v1
 * @param {string} [opts.apiKey]     single key; shorthand for a one-key pool
 * @param {string[]} [opts.apiKeys]   key pool, alternated and failed over
 * @param {object} [opts.extraHeaders]
 * @param {boolean} [opts.jsonSchema] true when the endpoint supports response_format json_schema
 */
function createOpenAICompatibleProvider({
    name, baseUrl, apiKey, apiKeys, extraHeaders = {}, resolveModel, jsonSchema = false,
}) {
    // Same pool machinery as the Gemini adapter: alternate across keys, fail over
    // on 429/auth, drop a key that turns out to be invalid. See llm/keyPool.js.
    const keyPool = getPool({
        keys: apiKeys && apiKeys.length ? apiKeys : [apiKey],
        provider: name,
    });

    return {
        name,
        capabilities: { toolCalling: true, nativeWebSearch: false, jsonSchema, citations: false },
        resolveModel,
        keyPool,

        async chat({
            system, messages = [], tools = [], toolChoice, responseFormat,
            model, tier, temperature = 0.6, maxTokens = 4096, signal,
        }) {
            const resolved = model || resolveModel(tier);
            const cap = llmEnv.maxTokensCeiling
                ? Math.min(maxTokens, llmEnv.maxTokensCeiling)
                : maxTokens;
            let effectiveSystem = system;

            const body = { model: resolved, temperature, max_tokens: cap };

            if (responseFormat && responseFormat !== "text" && responseFormat.json) {
                if (jsonSchema) {
                    body.response_format = {
                        type: "json_schema",
                        json_schema: { name: "result", schema: responseFormat.json, strict: false },
                    };
                } else {
                    // Older endpoints only have json_object, which enforces valid
                    // JSON but not our shape — so the shape goes in the prompt.
                    body.response_format = { type: "json_object" };
                    effectiveSystem = [
                        system || "",
                        "Reply with a single JSON object matching this JSON Schema. No prose, no code fences.",
                        JSON.stringify(responseFormat.json),
                    ].filter(Boolean).join("\n\n");
                }
            }

            body.messages = toOpenAIMessages(messages, effectiveSystem);

            const openAiTools = toOpenAITools(tools);
            if (openAiTools) {
                body.tools = openAiTools;
                const choice = toOpenAIToolChoice(toolChoice);
                if (choice) body.tool_choice = choice;
            }

            // The key travels in the Authorization header here, so it is applied
            // per attempt and the pool can hand out a different one on failover.
            return keyPool.run(async (key) => {
                const data = await postJson(`${baseUrl}/chat/completions`, body, {
                    headers: { Authorization: `Bearer ${key}`, ...extraHeaders },
                    signal, provider: name, model: resolved,
                    retryRateLimit: keyPool.liveCount() < 2,
                });
                return fromResponse(data, resolved);
            }, { model: resolved });
        },

        // No native search on this shape. llm/index.js attaches a search
        // implementation chosen by MARKETDESK_SEARCH_PROVIDER instead.
    };
}

module.exports = { createOpenAICompatibleProvider, toOpenAIMessages, fromResponse };
