require("dotenv").config()
const express = require("express");
const cors = require("cors");
const compression = require('compression')
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const stockRoute = require("./routes/Stock")
const expenseRoutes = require("./routes/expenses")
const { errorHandler, notFound } = require("./middleware/error");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser")
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const path = require("path");
const { scheduleTask, scheduleFiiDiiReport,
    scheduleCoorporateAnnouncments, scheduleCoorporateActions, giftNifty, getGlobalIndices } = require("./middleware/StockScheduler");
const { generateHtmlPage, createPages } = require("./middleware/FundamentalAnalysis");
const bot = require("./middleware/telegramBot");
const aibot = require("./middleware/telegramAIBot");
const yahooFinance = require('yahoo-finance2').default;

const app = express();
app.use(compression())

const timeZone = 'Asia/Kolkata';

// createPages();


app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false
}));
app.use(bodyParser.json({ limit: "50mb" }));


app.use(express.json());
connectDB();

app.use(cookieParser());

app.use("/api/users", userRoutes)
app.use("/api/notes", notesRoute)
app.use("/api/stock", stockRoute)
app.use("/api/expenses", expenseRoutes);



__dirname = path.resolve();
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "/noteitfrontend/build",)))
    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "noteitfrontend", "build", "index.html"));
    })
} else {
    app.get("*", (req, res) => {
        res.send("OOPS! Came to wrong place")
    })
}

app.use(errorHandler)
app.use(notFound)

const targetTime = moment.tz(process.env.TIME_RULE1, 'HH:mm', timeZone);
const rule = new schedule.RecurrenceRule();
rule.hour = targetTime.hour();
rule.minute = targetTime.minute();
rule.tz = 'Asia/Kolkata';
rule.dayOfWeek = new schedule.Range(1, 5);

schedule.scheduleJob(rule, () => {
    console.log('Scheduler triggered with rule');
    scheduleTask();
    scheduleFiiDiiReport();
    scheduleCoorporateAnnouncments();
    scheduleCoorporateActions();
});


const rule2 = new schedule.RecurrenceRule();
rule2.minute = 0;
rule2.tz = 'Asia/Kolkata';

schedule.scheduleJob(rule2, () => {
    console.log('Scheduler triggered with rule2');
    scheduleCoorporateAnnouncments();
    scheduleCoorporateActions();
});


const pagesTime = moment.tz(process.env.PAGES_TIME, 'HH:mm', timeZone);
const pagesTimeRule = new schedule.RecurrenceRule();
pagesTimeRule.hour = pagesTime.hour();
pagesTimeRule.minute = pagesTime.minute();
pagesTimeRule.tz = 'Asia/Kolkata';

schedule.scheduleJob(pagesTimeRule, () => {
    createPages();
    generateHtmlPage();
})

const rule3 = new schedule.RecurrenceRule();
rule3.minute = new schedule.Range(0, 59); // This will run the job every minute.
rule3.tz = 'Asia/Kolkata';

schedule.scheduleJob(rule3, () => {
    giftNifty();
    getGlobalIndices();
})





const server=app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)

})
