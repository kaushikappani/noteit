/**
 * MarketDesk's own scheduler.
 *
 * Two edition slots, a frequent ingest tick, and — the part that matters on a
 * host that sleeps — a catch-up sweep on boot. Render's free tier spins a web
 * service down when idle, so an in-process 08:00 job can simply never fire.
 * Rather than assume the process is alive at the right minute, startup asks
 * "which slots are already past today and have no ready edition?" and builds
 * those. That also covers restarts, deploys and crashes.
 */

const schedule = require("node-schedule");
const moment = require("moment-timezone");

const { TIME_ZONE, env } = require("./config/settings");
const { getSettings } = require("./config/runtime");
const { MdEdition } = require("./models");

const jobs = [];
let running = false;

/** Never let two builds overlap; an edition build can take minutes. */
async function guarded(label, fn) {
    if (running) {
        console.log(`[marketdesk] ${label} skipped — another run is in progress`);
        return;
    }
    running = true;
    try {
        await fn();
    } catch (err) {
        console.error(`[marketdesk] ${label} failed:`, err?.stack || err);
    } finally {
        running = false;
    }
}

async function runEdition(slot, { force = false } = {}) {
    const { buildEdition } = require("./jobs/buildEdition");
    const { deliverEdition } = require("./jobs/deliverEdition");

    const { edition, skipped } = await buildEdition({ slot, force });
    if (skipped) return;
    await deliverEdition(edition._id);
}

async function runIngest() {
    const { ingestTick } = require("./jobs/ingestFilings");
    const { ingestCorporateActions } = require("./jobs/ingestCorporateActions");

    await ingestTick({ days: 1, analyzeLimit: 5 });
    // Actions change far more slowly than filings — once an hour is plenty.
    if (moment().tz(TIME_ZONE).minute() < 10) {
        const actions = await ingestCorporateActions({ weeksAhead: 4 });
        console.log(`[marketdesk] corporate actions ${JSON.stringify(actions)}`);
    }
}

/**
 * Build any slot whose time has passed today but which has no ready edition.
 * Bounded to today so a long outage cannot trigger a backfill storm.
 */
async function catchUpOnBoot() {
    const settings = await getSettings({ fresh: true });
    const now = moment().tz(TIME_ZONE);
    const date = now.format("YYYY-MM-DD");

    const slots = [
        { slot: "AM", hour: settings.schedule.amHour, minute: settings.schedule.amMinute },
        { slot: "PM", hour: settings.schedule.pmHour, minute: settings.schedule.pmMinute },
    ];

    for (const { slot, hour, minute } of slots) {
        const due = now.clone().hour(hour).minute(minute).second(0);
        if (now.isBefore(due)) continue;

        const existing = await MdEdition.findOne({ date, slot }).lean();
        if (existing?.status === "ready") continue;
        // A build that is genuinely still in flight elsewhere should be left alone.
        if (existing?.status === "building" && Date.now() - new Date(existing.updatedAt).getTime() < 15 * 60000) {
            continue;
        }

        console.log(`[marketdesk] catch-up: ${date} ${slot} is past due and not ready`);
        await guarded(`catch-up ${slot}`, () => runEdition(slot, { force: existing?.status === "failed" }));
    }
}

function rule({ hour, minute }) {
    const r = new schedule.RecurrenceRule();
    r.hour = hour;
    r.minute = minute;
    r.tz = TIME_ZONE;
    return r;
}

async function startScheduler() {
    if (!env.schedulerEnabled) {
        console.log("[marketdesk] scheduler disabled (MARKETDESK_SCHEDULER=false)");
        return;
    }

    const settings = await getSettings({ fresh: true });
    const { schedule: s } = settings;

    jobs.push(schedule.scheduleJob(
        rule({ hour: s.amHour, minute: s.amMinute }),
        () => guarded("AM edition", () => runEdition("AM"))
    ));
    jobs.push(schedule.scheduleJob(
        rule({ hour: s.pmHour, minute: s.pmMinute }),
        () => guarded("PM edition", () => runEdition("PM"))
    ));

    const ingestRule = new schedule.RecurrenceRule();
    ingestRule.minute = new schedule.Range(0, 59, s.ingestEveryMinutes || 10);
    ingestRule.tz = TIME_ZONE;
    jobs.push(schedule.scheduleJob(ingestRule, () => {
        // Nothing is filed overnight; skip the window the host app skips too.
        const hour = moment().tz(TIME_ZONE).hour();
        if (hour >= 0 && hour < 6) return;
        runIngest().catch((err) => console.error("[marketdesk] ingest failed:", err.message));
    }));

    console.log(
        `[marketdesk] scheduler up — editions ${s.amHour}:${String(s.amMinute).padStart(2, "0")} ` +
        `and ${s.pmHour}:${String(s.pmMinute).padStart(2, "0")} ${TIME_ZONE}, ` +
        `ingest every ${s.ingestEveryMinutes}m`
    );

    // Deliberately not awaited: a slow catch-up must not delay server startup.
    catchUpOnBoot().catch((err) => console.error("[marketdesk] catch-up failed:", err.message));
}

function stopScheduler() {
    jobs.forEach((job) => job?.cancel());
    jobs.length = 0;
}

module.exports = { startScheduler, stopScheduler, catchUpOnBoot, runEdition, runIngest };
