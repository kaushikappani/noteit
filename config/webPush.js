const webPush = require('web-push');

// VAPID keys should be generated only once.
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Send Notification
const sendNotification = (subscription, dataToSend = '') => {
    webPush.sendNotification(subscription, dataToSend)
        .then(response => console.log('Push notification sent', response))
        .catch(err => console.error('Error sending notification', err));
};

module.exports = { sendNotification };
