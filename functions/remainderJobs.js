const { Remainder, User } = require("../config/models");
const { triggerNotifications } = require("../middleware/StockScheduler");
const cron = require('node-cron');
const moment = require('moment'); 


async function runPendingReminders() {
    try {
        const remainders = await Remainder.find({ expired: false });
        console.log(remainders);
        remainders.forEach(remainder => {
            const remainderDate = moment.tz(remainder.date, process.env.TIME_ZONE).toDate();
            const cronTime = moment(remainderDate)
                .tz(process.env.TIME_ZONE)
                .format('m H D M *');
            
            const job = cron.schedule(cronTime, async () => {
                console.log(`Reminder: ${remainder.description} at ${remainderDate}`);

                // Trigger your notification
                const user = await User.findById(remainder.user).select("-password");

                try {
                     await Remainder.findByIdAndUpdate(remainder._id, { expired: true });

                } catch (err) {
                    console.error('Error updating remainder:', err);
                }

                let notificationRequest = {
                    title: `Reminder : ${remainderDate}`,
                    body: remainder.description
                };

                try {
                    await triggerNotifications(notificationRequest,user);
                } catch (err) {
                    console.error('Error sending notification:', err);
                }

                
            });
            job.start();
        });
    } catch (err) {
        console.error('Error running pending reminders:', err);
    }
}

// Call this function when your server starts
module.exports = { runPendingReminders };