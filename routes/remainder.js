const express = require("express");
const { Remainder, User } = require("../config/models");
const { protect } = require("../middleware/protect");
const { triggerNotifications } = require("../middleware/StockScheduler");
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const router = express.Router();



router.route('/add').post(protect, async (req, res) => {
    const { description, date } = req.body;
    const timeZone = process.env.TIME_ZONE; // Fetch time zone from environment variables

    // Convert the input date to the specified timezone
    const reminderDate = moment.tz(date, timeZone).toDate();

    let reminder = new Remainder({
        user: req.user,
        description,
        date: reminderDate
    });

    reminder = await reminder.save();

    const user = await User.findById(req.user._id).select("-password");

    console.log(date);
    console.log(reminderDate);

    // Schedule the task using node-schedule with the reminder date in the correct timezone
    const job = schedule.scheduleJob(reminderDate, async () => {
        console.log(`Reminder: ${description} at ${reminderDate}`);

        // Trigger your notification
        let notificationRequest = {
            title: `Reminder : ${reminderDate} `,
            body: description
        };

        try {
            await triggerNotifications(notificationRequest, user);
        } catch (err) {
            console.error('Error sending notification:', err);
        }

        // Update the reminder to mark it as expired
        try {
            await Remainder.findByIdAndUpdate(reminder._id, { expired: true });
        } catch (err) {
            console.error('Error updating reminder:', err);
        }
    });

    console.log(job); // Log the job details

    res.status(201).json({ message: 'Reminder Added' });
});




router.route("/").get(protect, async (req, res) => {
    let remainders = await Remainder.find({
        user: req.user._id,
        expired : false
    })

    res.status(200).json(remainders)
})

module.exports = router;
