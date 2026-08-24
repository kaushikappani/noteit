/**
 * Immediate alerts for high-materiality filings, between editions.
 *
 * Deliberately reaches for config/webPush.js rather than
 * middleware/StockScheduler.js's triggerNotifications wrapper: requiring that
 * file executes a full NSE fetch plus LLM run as an import-time side effect
 * (StockScheduler.js:374). Calling sendNotification directly keeps this module's
 * dependency surface to leaf helpers with no side effects, which is also what
 * makes the folder liftable later.
 */

const { sendNotification } = require("../../config/webPush");
const { sendTelegramMessage } = require("../../middleware/sendTelegramMessage");
const { User } = require("../../config/models");
const { MdFiling } = require("../models");

/** Push to every device the admin users have registered. */
async function pushToRecipients(recipients, payload) {
    const emails = recipients.map((r) => r.email).filter(Boolean);
    if (!emails.length) return;

    const users = await User.find({ email: { $in: emails } }).select("subscriptions email");
    const body = JSON.stringify(payload);

    for (const user of users) {
        const { web, mobile } = user.subscriptions || {};
        // sendNotification already applies its own cooldown keyed on endpoint +
        // payload, so a repeated body is dropped there rather than here.
        if (web?.endpoint) await sendNotification(web, body);
        if (mobile?.endpoint) await sendNotification(mobile, body);
    }
}

/**
 * Send one alert per filing that clears the materiality threshold.
 *
 * `alertedAt` is stamped before the sends and is part of the query, so a filing
 * can never be alerted twice even if the process dies mid-send.
 */
async function sendMaterialityAlerts({ settings }) {
    const threshold = settings.materialityAlertThreshold ?? 70;
    const { push, telegram, tweet } = settings.enabled || {};

    if (!push && !telegram && !tweet) return { sent: 0 };

    const candidates = await MdFiling.find({
        status: "summarized",
        materiality: { $gte: threshold },
        alertedAt: { $exists: false },
    }).sort({ materiality: -1, announcedAt: -1 }).limit(10);

    let sent = 0;
    for (const filing of candidates) {
        // Claim it first: a crash after this point costs one alert, whereas
        // claiming afterwards would risk sending the same alert on every tick.
        const claim = await MdFiling.updateOne(
            { _id: filing._id, alertedAt: { $exists: false } },
            { $set: { alertedAt: new Date() } }
        );
        if (!claim.modifiedCount) continue;

        const title = `${filing.symbol} · ${filing.materiality}/100`;
        const text = `${filing.desc || ""}\n\n${filing.summary || ""}`.trim();

        try {
            if (push) {
                await pushToRecipients(settings.recipients || [], {
                    title,
                    body: (filing.summary || filing.desc || "").slice(0, 300),
                    data: { url: `/marketdesk/company/${filing.symbol}` },
                });
            }
            if (telegram) {
                for (const chatId of settings.telegramIds || []) {
                    await sendTelegramMessage(
                        chatId,
                        `*${filing.symbol}* · materiality ${filing.materiality}/100\n${text}`,
                        true,
                        `*${filing.symbol}*\n${text}\n\n[View filing](${filing.attachmentUrl})`
                    );
                }
            }
            if (tweet) {
                const { sendTweetSafely } = require("../../functions/xService");
                const { textToImageBuffer } = require("../../functions/textToImage");
                const tweetText = `${filing.symbol} - ${filing.desc}\n\n${filing.summary}`;
                await sendTweetSafely(tweetText, await textToImageBuffer(tweetText));
            }
            sent++;
        } catch (err) {
            // The claim stands: a delivery failure is logged rather than retried,
            // because the filing still appears in the next edition regardless.
            console.error(`[marketdesk] alert failed for ${filing.symbol}: ${err.message}`);
        }
    }
    return { sent };
}

module.exports = { sendMaterialityAlerts, pushToRecipients };
