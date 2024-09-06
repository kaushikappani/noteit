const schedule = require('node-schedule');
const moment = require('moment-timezone');
const { scheduleTask, scheduleFiiDiiReport, scheduleCoorporateAnnouncments, scheduleCoorporateActions, getGlobalIndices, triggerNotifications, giftNifty } = require('../middleware/StockScheduler');
const { createPages, generateHtmlPage } = require('../middleware/FundamentalAnalysis');
const fetchStockData = require('./StockData');
const { symbolQuantityObject } = require('../routes/data');
const { scrapGlobalIndices } = require('../middleware/Scrapper');


const timeZone = 'Asia/Kolkata';

// First scheduler
const targetTime = moment.tz(process.env.TIME_RULE1, 'HH:mm', timeZone);
const rule = new schedule.RecurrenceRule();
rule.hour = targetTime.hour();
rule.minute = targetTime.minute();
rule.tz = timeZone;
rule.dayOfWeek = new schedule.Range(1, 5);

schedule.scheduleJob(rule, () => {
    console.log('Scheduler triggered with rule');
    scheduleTask();
    scheduleFiiDiiReport();
    scheduleCoorporateAnnouncments();
    scheduleCoorporateActions();
});

// Second scheduler
const rule2 = new schedule.RecurrenceRule();
rule2.minute = 0;
rule2.tz = timeZone;

schedule.scheduleJob(rule2, () => {
    const currentTime = moment.tz(timeZone);
    const currentHour = currentTime.hour();

    // Avoid running between 12 AM (00:00) and 6 AM (06:00)
    if (currentHour >= 0 && currentHour < 6) {
        console.log('Skipping task between 12 AM and 6 AM');
    } else {
        console.log('Scheduler triggered with rule2');
        scheduleCoorporateAnnouncments();
        scheduleCoorporateActions();
    }
});

// Third scheduler for pages
const pagesTime = moment.tz(process.env.PAGES_TIME, 'HH:mm', timeZone);
const pagesTimeRule = new schedule.RecurrenceRule();
pagesTimeRule.hour = pagesTime.hour();
pagesTimeRule.minute = pagesTime.minute();
pagesTimeRule.tz = timeZone;

schedule.scheduleJob(pagesTimeRule, () => {
    createPages();
    generateHtmlPage();
});

// Fourth scheduler for global indices
const rule3 = new schedule.RecurrenceRule();
rule3.minute = new schedule.Range(0, 59); // Runs the job every minute.
rule3.tz = timeZone;

schedule.scheduleJob(rule3, () => {
    getGlobalIndices();
});



const morningTime = moment.tz('09:16', 'HH:mm', timeZone);
const morningRule = new schedule.RecurrenceRule();
morningRule.hour = morningTime.hour();
morningRule.minute = morningTime.minute();
morningRule.tz = timeZone;

schedule.scheduleJob(morningRule, async() => {
    console.log('Scheduler triggered at 9:16 AM');
    // Add the task you want to run at 9:16 AM
    let pf = await fetchStockData(symbolQuantityObject);
    let notiReq = {
        title: "Portfolio Start",
        body: `P&l = ${pf.total}`
    }
    triggerNotifications(notiReq);
});

// Evening schedule for 3:31 PM
const eveningTime = moment.tz('15:31', 'HH:mm', timeZone);
const eveningRule = new schedule.RecurrenceRule();
eveningRule.hour = eveningTime.hour();
eveningRule.minute = eveningTime.minute();
eveningRule.tz = timeZone;

schedule.scheduleJob(eveningRule, async() => {
    console.log('Scheduler triggered at 3:31 PM');
    // Add the task you want to run at 3:31 PM
    let pf = await fetchStockData(symbolQuantityObject);
    let notiReq = {
        title: "Todays Close",
        body: `P&l = ${pf.total}`
    }
    triggerNotifications(notiReq);
});


const sevenAmTime = moment.tz('07:00', 'HH:mm', timeZone); 
const sevenAmRule = new schedule.RecurrenceRule();
sevenAmRule.hour = sevenAmTime.hour();
sevenAmRule.minute = sevenAmTime.minute();
sevenAmRule.tz = timeZone;

// Schedule the task to run at 7:00 AM every day
schedule.scheduleJob(sevenAmRule, async() => {
    console.log('Scheduler triggered at 7:00 AM');
    const data = await scrapGlobalIndices();
    let gn = await giftNifty(data);

    let notiReq = {
        title: "Market Start : GIft Nifty",
        body: `Gify Nifty : ${gn.giftNifty.price}, ${gn.giftNifty.priceChange} `
    }
    triggerNotifications(notiReq);
    

});


let lastPnl = 0; // to store the last P&L value

async function checkPnl() {
    try {
        let pf = await fetchStockData(symbolQuantityObject); // Fetch current P&L
        let currentPnl = pf.total;

        if (lastPnl !== null && Math.abs(currentPnl - lastPnl) > process.env.PANDL_CHANGE_THRESHOLD) {
            // P&L changed by more than 1000
            let notiReq = {
                title: "P&L Change Alert",
                body: `P&L changed by more than 1000. Current P&L: ${currentPnl}`
            };
            triggerNotifications(notiReq);
        }

        lastPnl = currentPnl; // Update lastPnl with current value

    } catch (error) {
        console.error('Error fetching stock data:', error);
    }
}

const checkEveryFiveMinutesRule = new schedule.RecurrenceRule();
checkEveryFiveMinutesRule.minute = new schedule.Range(0, 59, 5); // every 5 minutes
checkEveryFiveMinutesRule.hour = new schedule.Range(9, 15); // between 9 AM and 3 PM
checkEveryFiveMinutesRule.dayOfWeek = new schedule.Range(1, 5); // Monday to Friday
checkEveryFiveMinutesRule.tz = timeZone;

schedule.scheduleJob(checkEveryFiveMinutesRule, async () => {
    console.log('Scheduler triggered at:', moment().format('HH:mm'));
    await checkPnl();
});


module.exports = schedule;