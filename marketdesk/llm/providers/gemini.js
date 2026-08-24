/**
 * Gemini adapter, written against the v1beta REST API rather than
 * @google/generative-ai.
 *
 * The installed SDK (0.15.0) predates Gemini 2.x search grounding — its Tool
 * type knows only functionDeclarations — so going through it would make the one
 * capability we specifically want unreachable. Talking to REST directly also
 * means an SDK bump can never change this module's behaviour, and gives us
 * groundingMetadata, which the SDK does not surface.
 */

const { postJson } = require("../http");
const { SafetyError, LlmError } = require("../errors");
const { toGeminiTools, toGeminiToolConfig, toGeminiSchema } = require("../toolSchema");
const { estimateCostUsd } = require("../../config/settings");

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Canonical messages -> Gemini `contents`. */
function toContents(messages = []) {
    const contents = [];
    for (const m of messages) {
        if (m.role === "tool") {
            contents.push({
                // "user", not "function". The 2.5 API accepted a `function` role
                // for tool results, but 3.x rejects it outright ("Role 'function'
                // is not supported"). "user" carrying a functionResponse part is
                // what the REST docs show and is accepted by both generations.
                role: "user",
                parts: [{
                    functionResponse: {
                        name: m.name,
                        // Gemini requires an object here, never a bare string.
                        response: typeof m.content === "string"
                            ? { result: m.content }
                            : (m.content || {}),
                    },
                }],
            });
            continue;
        }
        if (m.role === "assistant") {
            const parts = [];
            if (m.content) parts.push({ text: m.content });
            for (const call of m.toolCalls || []) {
                const part = { functionCall: { name: call.name, args: call.args || {} } };
                // Gemini 3.x refuses a replayed function call that has lost its
                // thought signature ("Function call is missing a thought_signature
                // ... required for tools to work correctly"). It is an opaque token
                // the model hands us and expects back verbatim, so the adapter
                // carries it in the canonical toolCall's `meta` and restores it here.
                // 2.x never sends one, and ignores it if absent.
                if (call.meta?.thoughtSignature) part.thoughtSignature = call.meta.thoughtSignature;
                parts.push(part);
            }
            if (parts.length) contents.push({ role: "model", parts });
            continue;
        }
        contents.push({ role: "user", parts: [{ text: String(m.content ?? "") }] });
    }
    return contents;
}

const FINISH = { STOP: "stop", MAX_TOKENS: "length", SAFETY: "safety", RECITATION: "safety" };

/** Gemini response -> canonical result. */
function fromResponse(data, model) {
    if (data?.promptFeedback?.blockReason) {
        throw new SafetyError(`gemini blocked the prompt: ${data.promptFeedback.blockReason}`, {
            provider: "gemini", model,
        });
    }
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // 2.5 models can emit reasoning parts; they are not answer text.
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim() || null;

    const toolCalls = parts
        .filter((p) => p.functionCall)
        .map((p, i) => ({
            id: `${p.functionCall.name}_${i}`,
            name: p.functionCall.name,
            args: p.functionCall.args || {},
            // Opaque, provider-specific, round-tripped unchanged. Other adapters
            // simply ignore it.
            meta: p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : undefined,
        }));

    const usageMeta = data?.usageMetadata || {};
    const inputTokens = usageMeta.promptTokenCount || 0;
    const outputTokens = (usageMeta.candidatesTokenCount || 0) + (usageMeta.thoughtsTokenCount || 0);

    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const citations = chunks
        .filter((c) => c.web?.uri)
        .map((c) => ({ title: c.web.title || c.web.uri, url: c.web.uri }));

    return {
        text,
        toolCalls,
        finishReason: toolCalls.length ? "tool_calls" : (FINISH[candidate?.finishReason] || "stop"),
        usage: {
            inputTokens,
            outputTokens,
            costUsd: estimateCostUsd(model, inputTokens, outputTokens),
        },
        citations,
        raw: data,
    };
}

function createGeminiProvider({ apiKey, apiKeys, resolveModel }) {
    const keys = (apiKeys && apiKeys.length ? apiKeys : [apiKey]).filter(Boolean);
    if (!keys.length) throw new LlmError("GEMINI_API_KEY is not set", { provider: "gemini" });

    // Which key to start from. Advanced permanently once a key is exhausted, so
    // later calls do not keep paying a round trip to rediscover the same 429.
    let cursor = 0;

    /**
     * Try each key in turn, rotating past exhausted ones.
     *
     * Free-tier quota is per project per model per day (20), so a second key from
     * a different project is a genuinely fresh allowance rather than the same
     * bucket under another name. postJson has already applied its own retry
     * policy by the time a 429 reaches us, so arriving here means this key is
     * spent, not merely busy.
     */
    async function generate(model, body, signal) {
        let lastErr;

        for (let i = 0; i < keys.length; i++) {
            const index = (cursor + i) % keys.length;
            const url = `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${keys[index]}`;
            try {
                const data = await postJson(url, body, { signal, provider: "gemini", model });
                cursor = index;
                return fromResponse(data, model);
            } catch (err) {
                lastErr = err;
                // 429: this project's allowance is spent.
                // 404: this model is not released to this project -- Google is
                // retiring 2.5 models per-project, so another key may still have
                // it. Both are worth trying the next key for; nothing else is.
                const worthRotating = err.status === 429 || err.status === 404;
                if (!worthRotating || keys.length === 1) throw err;
                if (i < keys.length - 1) {
                    console.warn(
                        `[marketdesk/llm] gemini key ${index + 1}/${keys.length} exhausted for ${model} — trying key ${((index + 1) % keys.length) + 1}`
                    );
                }
            }
        }
        throw lastErr;
    }

    return {
        name: "gemini",
        capabilities: { toolCalling: true, nativeWebSearch: true, jsonSchema: true, citations: true },
        resolveModel,

        async chat({
            system, messages = [], tools = [], toolChoice, responseFormat,
            model, tier, temperature = 0.6, maxTokens = 4096, signal,
        }) {
            const resolved = model || resolveModel(tier);

            const generationConfig = {
                temperature,
                topP: 0.95,
                maxOutputTokens: maxTokens,
                responseMimeType: "text/plain",
            };
            if (responseFormat && responseFormat !== "text" && responseFormat.json) {
                generationConfig.responseMimeType = "application/json";
                const schema = toGeminiSchema(responseFormat.json);
                if (schema) generationConfig.responseSchema = schema;
            }

            const body = { contents: toContents(messages), generationConfig };
            if (system) body.systemInstruction = { parts: [{ text: system }] };

            const geminiTools = toGeminiTools(tools);
            if (geminiTools) {
                body.tools = geminiTools;
                const toolConfig = toGeminiToolConfig(toolChoice);
                if (toolConfig) body.toolConfig = toolConfig;
            }

            return generate(resolved, body, signal);
        },

        /**
         * Native Google Search grounding.
         *
         * This is its own request on purpose: the v1beta API refuses a call that
         * carries both google_search and functionDeclarations, so search can
         * never be just another entry in the tool registry. The agent still sees
         * a normal `web_search` tool — its handler lands here.
         */
        async search({ query, recencyDays, model, signal }) {
            const resolved = model || resolveModel("fast");
            const hint = recencyDays ? ` Focus on the last ${recencyDays} days. Include dates.` : "";
            const body = {
                contents: [{ role: "user", parts: [{ text: `${query}${hint}` }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
            };
            try {
                return await generate(resolved, body, signal);
            } catch (err) {
                // Older grounding dialect, for models that predate google_search.
                if (err.status === 400) {
                    return generate(resolved, { ...body, tools: [{ googleSearchRetrieval: {} }] }, signal);
                }
                throw err;
            }
        },
    };
}

module.exports = { createGeminiProvider, toContents, fromResponse };
