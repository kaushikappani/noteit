require("dotenv").config()
const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const stockRoute = require("./routes/Stock")
const { errorHandler, notFound } = require("./middleware/error");
const { Note } = require("./config/models");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser")
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const { scheduleTask, scheduleFiiDiiReport,
    scheduleCoorporateAnnouncments, scheduleCoorporateActions } = require("./middleware/StockScheduler");


const timeZone = 'Asia/Kolkata';

const targetTime = moment.tz(process.env.TIME_RULE1, 'HH:mm', timeZone);
const rule = new schedule.RecurrenceRule();
rule.hour = targetTime.hour();
rule.minute = targetTime.minute();
rule.tz = 'Asia/Kolkata';
rule.dayOfWeek = new schedule.Range(1, 5);

// const targetTime2 = moment.tz(process.env.TIME_RULE2, 'HH:mm', timeZone);
// const rule2 = new schedule.RecurrenceRule();
// rule2.hour = targetTime2.hour();
// rule2.minute = targetTime2.minute();
// rule2.tz = 'Asia/Kolkata';

const rule2 = new schedule.RecurrenceRule();
rule2.minute = 0; 
rule2.tz = 'Asia/Kolkata';



app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false
}));
app.use(bodyParser.json({ limit: "50mb" }));

const path = require("path");
app.use(express.json());
connectDB();

app.use(cookieParser());
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

const server=app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)

})
