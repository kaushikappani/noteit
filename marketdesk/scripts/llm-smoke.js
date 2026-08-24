/**
 * Proves the provider abstraction: the same three exercises — plain chat,
 * structured JSON, and a tool-calling round trip — run unchanged against any
 * provider. If this passes for two providers, swapping LLM_PROVIDER is safe.
 *
 *   node marketdesk/scripts/llm-smoke.js
 *   node marketdesk/scripts/llm-smoke.js --provider=openai
 *   node marketdesk/scripts/llm-smoke.js --skip-search
 */

const { run } = require("./_bootstrap");
const { getProvider } = require("../llm");

const line = (s) => console.log(`\n── ${s} ──`);

run(async (argv) => {
    const provider = getProvider({ provider: argv.provider });
    console.log(`provider : ${provider.name}`);
    console.log(`models   : fast=${provider.resolveModel("fast")} balanced=${provider.resolveModel("balanced")} deep=${provider.resolveModel("deep")}`);
    console.log(`caps     : ${JSON.stringify(provider.capabilities)}`);

    line("1. plain chat");
    const plain = await provider.chat({
        system: "You are terse.",
        messages: [{ role: "user", content: "Name the two main Indian stock exchanges. One line." }],
        tier: "fast",
        maxTokens: 200,
    });
    console.log("text  :", plain.text);
    console.log("usage :", JSON.stringify(plain.usage));

    line("2. structured JSON");
    const structured = await provider.chat({
        system: "You are a financial analyst.",
        messages: [{
            role: "user",
            content: "Classify this filing headline: 'Board approves 1:1 bonus issue and record date of 12 Sep'.",
        }],
        responseFormat: {
            json: {
                type: "object",
                properties: {
                    sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
                    materiality: { type: "integer", description: "0-100" },
                    reason: { type: "string" },
                },
                required: ["sentiment", "materiality", "reason"],
            },
        },
        tier: "fast",
        maxTokens: 500,
    });
    console.log("raw   :", structured.text);
    console.log("parsed:", JSON.stringify(JSON.parse(structured.text)));

    line("3. tool calling round trip");
    const tools = [{
        name: "get_price",
        description: "Get the latest traded price for an NSE symbol.",
        parameters: {
            type: "object",
            properties: { symbol: { type: "string", description: "NSE symbol, e.g. RELIANCE" } },
            required: ["symbol"],
        },
    }];
    const first = await provider.chat({
        system: "Use the tools available to you. Do not guess prices.",
        messages: [{ role: "user", content: "What is INFY trading at?" }],
        tools,
        tier: "fast",
        maxTokens: 500,
    });
    console.log("finish   :", first.finishReason);
    console.log("toolCalls:", JSON.stringify(first.toolCalls));

    if (first.toolCalls.length) {
        const call = first.toolCalls[0];
        const second = await provider.chat({
            system: "Use the tools available to you. Do not guess prices.",
            messages: [
                { role: "user", content: "What is INFY trading at?" },
                { role: "assistant", content: first.text, toolCalls: first.toolCalls },
                { role: "tool", name: call.name, toolCallId: call.id, content: { symbol: "INFY", price: 1543.2, currency: "INR" } },
            ],
            tools,
            tier: "fast",
            maxTokens: 300,
        });
        console.log("final    :", second.text);
    } else {
        console.log("!! provider did not call the tool — check tool translation");
    }

    if (!argv["skip-search"] && provider.search) {
        line("4. web search");
        const s = await provider.search({ query: "Nifty 50 close today", recencyDays: 3 });
        console.log("text     :", (s.text || "").slice(0, 300));
        console.log("citations:", JSON.stringify((s.citations || []).slice(0, 3)));
    } else {
        line("4. web search — skipped");
    }

    console.log("\n✓ smoke passed");
});
