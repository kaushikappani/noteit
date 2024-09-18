const { Remainder, User } = require("../config/models");
const { triggerNotifications } = require("../middleware/StockScheduler");
const schedule = require('node-schedule');
const moment = require('moment-timezone');


async function runPendingReminders() {
    try {
        const remainders = await Remainder.find({ expired: false });
        console.log(remainders);
        remainders.forEach(remainder => {
            const reminderDate = moment.tz(remainder.date, process.env.TIME_ZONE).toDate();
            
            const job = schedule.scheduleJob(reminderDate, async () => {
                console.log(`Reminder: ${remainder.description} at ${reminderDate}`);

                // Trigger your notification
                const user = await User.findById(remainder.user).select("-password");

                try {
                     await Remainder.findByIdAndUpdate(remainder._id, { expired: true });

                } catch (err) {
                    console.error('Error updating remainder:', err);
                }

                let notificationRequest = {
                    title: `Reminder : ${reminderDate}`,
                    body: remainder.description
                };

                try {
                    await triggerNotifications(notificationRequest,user);
                } catch (err) {
                    console.error('Error sending notification:', err);
                }

                
            });
        });
    } catch (err) {
        console.error('Error running pending reminders:', err);
    }
}

// Call this function when your server starts
module.exports = { runPendingReminders };