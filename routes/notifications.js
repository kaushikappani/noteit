const express = require("express");
const client = require("../middleware/redis");
const router = express.Router();
const util = require("util");
const { stockProtect } = require("../middleware/protect");
const { User } = require("../config/models");


router.route("/subscribe").post(stockProtect, async (req, res) => {
    const { user, subscriptionType, subscription } = req.body;

    // Validate subscription type (web or mobile)
    if (!['web', 'mobile'].includes(subscriptionType)) {
        return res.status(400).json({ error: "Invalid subscription type" });
    }

    try {
        const existingUser = await User.findById(req.user._id );
        console.log(existingUser)

        if (!existingUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Update the corresponding subscription field
        existingUser.subscriptions[subscriptionType] = subscription;
        const updatedUser = await existingUser.save();

        res.status(200).json({ message: "Subscription updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
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

