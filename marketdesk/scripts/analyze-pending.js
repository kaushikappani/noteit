/**
 * Summarise and score filings that are still waiting.
 *
 *   node marketdesk/scripts/analyze-pending.js --limit=5
 *
 * Re-run it straight after: the second run should report 0, because analysis is
 * persisted on the filing rather than cached with a TTL.
 */

const { run, connectMongo } = require("./_bootstrap");

run(async (argv) => {
    await connectMongo();

    const { summarizePending } = require("../services/filingAnalysis");
    const { getSettings } = require("../config/runtime");
    const { MdFiling } = require("../models");

    const before = await MdFiling.countDocuments({ status: { $in: ["new", "failed"] } });
    console.log(`pending before: ${before}`);

    const settings = await getSettings();
    const result = await summarizePending({ limit: Number(argv.limit || 5), settings });

    for (const r of result.results) {
        console.log(`  ${r.symbol.padEnd(14)} ${r.status.padEnd(11)} ` +
            (r.materiality !== undefined ? `mat=${String(r.materiality).padStart(3)} ${r.sentiment}` : r.error || ""));
    }

    const after = await MdFiling.countDocuments({ status: { $in: ["new", "failed"] } });
    console.log(`processed ${result.processed}, pending after: ${after}`);
});
