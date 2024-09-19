const webPush = require('web-push');
const client = require('../middleware/redis');
const util = require("util");

// VAPID keys should be generated only once.
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails(
    'mailto:kaushikappani@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Send Notification
const sendNotification = async (subscription, dataToSend = '') => {
    const redisKey = `notification:${subscription.endpoint}:${dataToSend}`;

    const getAsync = util.promisify(client.get).bind(client)

    const notificationExists = await getAsync(redisKey);

    let coolDown = process.env.NOTIFICATION_COOL_DOWN_HOURS || 6;

    console.log(notificationExists)

    if (!notificationExists) {
        // If the notification hasn't been sent in the last 6 hours, send it
        webPush.sendNotification(subscription, dataToSend)
            .then(response => {
                console.log('Push notification sent', response);
                // Store the notification with expiration in 
              
                client.set(redisKey, 'sent', 'EX', coolDown * 60 * 60); // 6 hours in seconds
            })
            .catch(err => console.error('Error sending notification', err));
    } else {
        console.log(`Notification already sent within the last ${coolDown} hours`);
    }
};


module.exports = { sendNotification };
