const webPush = require('web-push');
const client = require('../middleware/redis');
const util = require("util");

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails(
    'mailto:kaushikappani@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

let notificationQueue = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || notificationQueue.length === 0) return;

    isProcessing = true;

    const { subscription, dataToSend, redisKey } = notificationQueue.shift();

    try {
        const response = await webPush.sendNotification(subscription, dataToSend);
        console.log('Push notification sent', response);

        const coolDown = process.env.NOTIFICATION_COOL_DOWN_HOURS || 6;
        client.set(redisKey.toLowerCase(), 'sent', 'EX', coolDown * 60 * 60);

    } catch (err) {
        console.error('Error sending notification', err);
    } finally {
        isProcessing = false;

        if (notificationQueue.length > 0) {
            processQueue();
        }
    }
};

const sendNotification = async (subscription, dataToSend = '') => {
    const redisKey = `notification:${subscription.endpoint}:${dataToSend}`.toLowerCase();

    const getAsync = util.promisify(client.get).bind(client);

    const notificationExists = await getAsync(redisKey);

    let coolDown = process.env.NOTIFICATION_COOL_DOWN_HOURS || 6;

    const filteredStrings = process.env.NOTIFICATION_FILTER_STRINGS
        ? process.env.NOTIFICATION_FILTER_STRINGS.split(',')
        : [];

    const shouldFilter = filteredStrings.some((filter) =>
        dataToSend.toLowerCase().includes(filter.trim().toLowerCase())
    );

    if (shouldFilter) {
        console.log('Notification contains filtered string and will not be sent.');
        return;
    }

    console.log(notificationExists);

    if (!notificationExists) {
        notificationQueue.push({ subscription, dataToSend, redisKey });

        processQueue();
    } else {
        console.log(`Notification already sent within the last ${coolDown} hours`);
    }
};



module.exports = { sendNotification };
