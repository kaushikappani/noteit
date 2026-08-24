/**
 * Send a built edition out.
 *
 * Separate from building on purpose, and idempotent per channel: each channel
 * stamps its own delivery.<channel>.sentAt, and a channel that already has a
 * stamp is skipped. So a rebuild never re-emails, a failed Telegram send can be
 * retried without a second email, and a crash mid-delivery resumes cleanly.
 */

const { mailer } = require("../../middleware/mailer");
const { sendTelegramMessage } = require("../../middleware/sendTelegramMessage");
const { getSettings } = require("../config/runtime");
const { renderDigest } = require("../services/editionRenderer");
const { pushToRecipients } = require("../services/alerts");
const { MdEdition } = require("../models");

const stamp = (edition, channel, error) =>
    MdEdition.updateOne({ _id: edition._id }, {
        $set: error
            ? { [`delivery.${channel}.error`]: String(error).slice(0, 500) }
            : { [`delivery.${channel}.sentAt`]: new Date(), [`delivery.${channel}.error`]: null },
    });

async function sendEmail(edition, settings) {
    if (!process.env.MAILER_API_KEY) {
        // middleware/mailer.js posts to an external service that requires this
        // key. Without it every send fails silently, so say so loudly once.
        throw new Error(
            "MAILER_API_KEY is not set — middleware/mailer.js cannot authenticate to the mail service"
        );
    }
    const recipients = (settings.recipients || []).filter((r) => r.email);
    if (!recipients.length) throw new Error("no recipients configured");

    const label = edition.slot === "AM" ? "Morning" : "Evening";
    const subject = `MarketDesk ${label} · ${edition.marketHeadline || edition.date}`;

    for (const recipient of recipients) {
        await mailer(
            { name: recipient.name || "there", email: recipient.email },
            { subject, text: renderDigest(edition), html: edition.html }
        );
    }
}

async function sendTelegram(edition, settings) {
    const ids = settings.telegramIds || [];
    if (!ids.length) throw new Error("no telegram ids configured");

    const base = (process.env.DOMAIN || "").replace(/\/$/, "");
    const link = `${base}/marketdesk/edition/${edition.date}/${edition.slot}`;
    const text = `${renderDigest(edition)}\n\n[Open the full edition](${link})`;

    for (const chatId of ids) {
        // Digest text embeds date and slot, so this clears the helper's own
        // 49-hour duplicate-text cooldown for every new edition.
        await sendTelegramMessage(chatId, text, false);
    }
}

async function sendPush(edition, settings) {
    const material = (edition.companyRefs || []).filter((r) => !r.stale).length;
    await pushToRecipients(settings.recipients || [], {
        title: `MarketDesk ${edition.slot === "AM" ? "morning" : "evening"} edition`,
        body: edition.marketHeadline
            || `${material} companies with news today`,
        data: { url: `/marketdesk/edition/${edition.date}/${edition.slot}` },
    });
}

const CHANNELS = {
    email: sendEmail,
    telegram: sendTelegram,
    push: sendPush,
};

/**
 * @param {object|string} target an edition document or its id
 * @param {{force?:boolean, only?:string[]}} opts force re-sends already-sent channels
 * @returns {Promise<Record<string,string>>} channel -> "sent" | "skipped" | "disabled" | "failed: …"
 */
async function deliverEdition(target, { force = false, only } = {}) {
    const edition = typeof target === "string" || target?.toHexString
        ? await MdEdition.findById(target).lean()
        : target;

    if (!edition) throw new Error("edition not found");
    if (edition.status !== "ready") {
        return { skipped: `edition is ${edition.status}, not ready` };
    }

    const settings = await getSettings();
    const results = {};

    for (const [channel, send] of Object.entries(CHANNELS)) {
        if (only && !only.includes(channel)) continue;

        if (!settings.enabled?.[channel]) { results[channel] = "disabled"; continue; }
        if (edition.delivery?.[channel]?.sentAt && !force) { results[channel] = "skipped"; continue; }

        try {
            await send(edition, settings);
            await stamp(edition, channel);
            results[channel] = "sent";
        } catch (err) {
            // One dead channel must not stop the others.
            await stamp(edition, channel, err.message);
            results[channel] = `failed: ${err.message}`;
            console.error(`[marketdesk] ${channel} delivery failed: ${err.message}`);
        }
    }

    console.log(`[marketdesk] delivery ${edition.date} ${edition.slot}: ${JSON.stringify(results)}`);
    return results;
}

module.exports = { deliverEdition };
