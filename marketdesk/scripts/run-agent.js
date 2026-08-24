/**
 * Drive the agent loop by hand, without waiting for a scheduled edition.
 *
 *   node marketdesk/scripts/run-agent.js --task="What moved Indian markets today?"
 *   node marketdesk/scripts/run-agent.js --set=companySnapshot --task="Analyse INFY"
 *   node marketdesk/scripts/run-agent.js --no-db --task="Nifty today"
 */

const { run, connectMongo } = require("./_bootstrap");

run(async (argv) => {
    // Traces and the DB-backed tools need Mongo; --no-db exercises search only.
    if (!argv["no-db"]) await connectMongo();

    const { getProvider } = require("../llm");
    const { buildRegistry, TOOL_SETS } = require("../agent/tools");
    const { runAgent } = require("../agent/loop");

    const provider = getProvider({ provider: argv.provider });
    const registry = buildRegistry({ provider });
    const setName = argv.set || "marketBrief";

    console.log(`provider=${provider.name} set=${setName} tools=${(TOOL_SETS[setName] || registry.names()).join(", ")}`);

    const result = await runAgent({
        provider,
        registry,
        system: "You are an Indian equity market analyst. Use tools for every fact. Be concise and specific.",
        task: argv.task || "Summarise what moved Indian equity markets in the last 24 hours.",
        toolNames: TOOL_SETS[setName],
        tier: argv.tier || "balanced",
        maxIterations: Number(argv.iterations || 5),
        maxUsd: Number(argv.budget || 0.25),
        purpose: `cli:${setName}`,
    });

    console.log("\n── answer ──\n" + (result.text || "(none)"));
    console.log("\nfinish   :", result.finishReason);
    console.log("usage    :", JSON.stringify(result.usage));
    console.log("elapsed  :", result.ms + "ms");
    console.log("traceId  :", String(result.traceId));
    console.log("citations:", JSON.stringify(result.citations.slice(0, 5), null, 1));
});
