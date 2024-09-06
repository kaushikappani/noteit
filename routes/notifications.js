const express = require("express");
const client = require("../middleware/redis");
const router = express.Router();
const util = require("util");
const { stockProtect } = require("../middleware/protect")


router.route("/subscribe").post(stockProtect , (req, res) => {
    const subscription = req.body.subscription;
    const user = req.body.user;

    // Use SADD for unique users and subscriptions
    client.sadd("notification_users", JSON.stringify(user), (err, reply) => {
        if (err) {
            return res.status(500).json({ error: "Failed to add user" });
        }
    });

    client.sadd("notification_subs", JSON.stringify(subscription), (err, reply) => {
        if (err) {
            return res.status(500).json({ error: "Failed to add subscription" });
        }
    });

    res.status(201).json({ message: "Subscription added successfully" });
});


// router.route("/trigger-notification").post(async(req, res)=> {
//     const data = JSON.stringify({
//         title: 'New Notification',
//         body: 'This is a push notification',
//     });

//     subscriptions.forEach(subscription => {
//         sendNotification(subscription, data);
//     });

//     res.status(200).json({ message: 'Notification sent' });
// })



module.exports = router;

