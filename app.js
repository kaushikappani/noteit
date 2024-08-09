require("dotenv").config()
const express = require("express");
const app = express();
const cors = require("cors");
const compression = require('compression')
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const stockRoute = require("./routes/Stock")
const { errorHandler, notFound } = require("./middleware/error");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser")
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const path = require("path");
const { scheduleTask, scheduleFiiDiiReport,
    scheduleCoorporateAnnouncments, scheduleCoorporateActions, giftNifty } = require("./middleware/StockScheduler");
const { generateHtmlPage, createPages } = require("./middleware/FundamentalAnalysis");
// createPages();
const timeZone = 'Asia/Kolkata';

const targetTime = moment.tz(process.env.TIME_RULE1, 'HH:mm', timeZone);
const rule = new schedule.RecurrenceRule();
rule.hour = targetTime.hour();
rule.minute = targetTime.minute();
rule.tz = 'Asia/Kolkata';
rule.dayOfWeek = new schedule.Range(1, 5);

const rule2 = new schedule.RecurrenceRule();
rule2.minute = 0; 
rule2.tz = 'Asia/Kolkata';


const pagesTime = moment.tz(process.env.PAGES_TIME, 'HH:mm', timeZone);
const pagesTimeRule = new schedule.RecurrenceRule();
pagesTimeRule.hour = targetTime.hour();
pagesTimeRule.minute = targetTime.minute();
pagesTimeRule.tz = 'Asia/Kolkata';
pagesTimeRule.dayOfWeek = new schedule.Range(1, 5);


app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false
}));
app.use(bodyParser.json({ limit: "50mb" }));


app.use(express.json());
connectDB();

app.use(cookieParser());
app.use(compression())
app.use("/api/users", userRoutes)
app.use("/api/notes", notesRoute)
app.use("/api/stock", stockRoute)


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

schedule.scheduleJob(rule, () => {
    console.log('Scheduler triggered with rule');
    scheduleTask();
    scheduleFiiDiiReport();
    scheduleCoorporateAnnouncments();
    scheduleCoorporateActions();
});

schedule.scheduleJob(rule2, () => {
    console.log('Scheduler triggered with rule2');
    scheduleCoorporateAnnouncments();
    scheduleCoorporateActions();
});


schedule.scheduleJob(pagesTimeRule, () => {
    createPages();
    generateHtmlPage();
})

giftNifty();

const server=app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)

})
