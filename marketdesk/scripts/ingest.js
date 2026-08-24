/**
 * Poll NSE and store new filings. Run it twice — the second run must insert 0,
 * which is the fingerprint dedupe doing its job.
 *
 *   node marketdesk/scripts/ingest.js
 *   node marketdesk/scripts/ingest.js --days=3 --analyze=0
 */

const { run, connectMongo } = require("./_bootstrap");

run(async (argv) => {
    await connectMongo();

    const { ingestFilings } = require("../jobs/ingestFilings");
    const { summarizePending } = require("../services/filingAnalysis");
    const { getSettings } = require("../config/runtime");

    const days = Number(argv.days || 1);
    const analyze = argv.analyze === undefined ? 5 : Number(argv.analyze);

    const ingested = await ingestFilings({ days });
    console.log("ingest:", JSON.stringify(ingested));

    if (analyze > 0) {
        const settings = await getSettings();
        const result = await summarizePending({ limit: analyze, settings });
        console.log(`analyzed ${result.processed}:`);
        for (const r of result.results) {
            console.log(`  ${r.symbol.padEnd(14)} ${r.status.padEnd(11)} ` +
                `${r.materiality !== undefined ? `mat=${r.materiality}` : (r.error || "")}`);
        }
    }
});
