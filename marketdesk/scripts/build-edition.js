/**
 * Build an edition on demand, so nothing has to wait for 08:00.
 *
 *   node marketdesk/scripts/build-edition.js --dry-run
 *   node marketdesk/scripts/build-edition.js --slot=AM --force
 *   node marketdesk/scripts/build-edition.js --slot=PM --deliver
 *   node marketdesk/scripts/build-edition.js --slot=AM --dry-run --html=out.html
 */

const { run, connectMongo } = require("./_bootstrap");

run(async (argv) => {
    await connectMongo();

    const { buildEdition } = require("../jobs/buildEdition");
    const { deliverEdition } = require("../jobs/deliverEdition");

    const { edition, skipped, dryRun } = await buildEdition({
        date: argv.date,
        slot: argv.slot ? String(argv.slot).toUpperCase() : undefined,
        force: !!argv.force,
        dryRun: !!argv["dry-run"],
    });

    if (skipped) {
        console.log("already built — pass --force to rebuild");
        return;
    }

    console.log(`\n${edition.date} ${edition.slot}${dryRun ? " (dry run)" : ""}`);
    console.log(`headline : ${edition.marketHeadline}`);
    console.log(`companies: ${edition.companyRefs.length} (${edition.companyRefs.filter((c) => !c.stale).length} with news)`);
    console.log(`indices  : ${(edition.indices || []).map((i) => `${i.name} ${i.value}`).join(" | ")}`);
    console.log(`cost     : $${Number(edition.usage?.costUsd || 0).toFixed(4)}`);
    console.log(`traces   : ${(edition.agentRunIds || []).length}`);

    console.log("\ntop companies:");
    for (const ref of edition.companyRefs.filter((c) => !c.stale).slice(0, 10)) {
        console.log(`  ${String(ref.materiality).padStart(3)} ${ref.symbol.padEnd(14)} ${ref.headline || ""}`);
    }

    if (argv.html) {
        require("fs").writeFileSync(argv.html, `<!doctype html><meta charset="utf-8">${edition.html}`);
        console.log(`\nhtml written to ${argv.html}`);
    }

    if (argv.deliver && !dryRun) {
        console.log("\ndelivery:", JSON.stringify(await deliverEdition(edition._id, { force: !!argv.force })));
    }
});
