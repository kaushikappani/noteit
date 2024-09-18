const express = require("express");
const { Remainder, User } = require("../config/models");
const { protect } = require("../middleware/protect");
const { triggerNotifications } = require("../middleware/StockScheduler");
const cron = require('node-cron');
const moment = require('moment'); 
const router = express.Router();


router.route('/add').post(protect, async (req, res) => {
    const { description, date } = req.body;
    const remainderDate = moment.tz(date, process.env.TIME_ZONE).toDate();

    let remainder = new Remainder({
        user: req.user,
        description,
        date: remainderDate
    });

    remainder = await remainder.save();

    const user = await User.findById(req.user._id).select("-password");

    console.log(date);
    console.log(remainderDate);

    const cronTime = moment(remainderDate)
        .tz(process.env.TIME_ZONE)
        .format('m H D M *'); // minutes hours dayOfMonth month *

    console.log(cronTime);

    // Schedule the notification with cron
    const job = cron.schedule(cronTime, async () => {
        console.log(`Reminder: ${description} at ${remainderDate}`);

        // Trigger your notification
        let notificationRequest = {
            title: `Reminder : ${remainderDate} `,
            body: description
        };

        try {
            await triggerNotifications(notificationRequest, user);
        } catch (err) {
            console.error('Error sending notification:', err);
        }

        try {
            await Remainder.findByIdAndUpdate(remainder._id, { expired: true });
        } catch (err) {
            console.error('Error updating remainder:', err);
        }
    });

    res.status(201).json({ message: 'Remainder Added' });
});




router.route("/").get(protect, async (req, res) => {
    let remainders = await Remainder.find({
        user: req.user._id,
        expired : false
    })

    res.status(200).json(remainders)
})

module.exports = router;
