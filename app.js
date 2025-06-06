require("dotenv").config()
const express = require("express");
const cors = require("cors");
const compression = require('compression')
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const stockRoute = require("./routes/Stock")
const newsRoutes = require("./routes/news")
const expenseRoutes = require("./routes/expenses")
const webPushRoutes = require("./routes/notifications")
const remainderRoutes = require("./routes/remainder");
const { errorHandler, notFound } = require("./middleware/error");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser")
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const path = require("path");
const aiGptRoutes = require("./routes/aigpt");

require('./functions/Scheduler');

require("./middleware/telegramBot");
if (process.env.NODE_ENV === "production") {
    require("./middleware/telegramBot");
    require("./middleware/telegramAIBot");
}


const { runPendingReminders } = require("./functions/remainderJobs");

const app = express();
app.use(cors());

app.use(compression())

// createPages();

// test from TV Display 

app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false
}));
app.use(bodyParser.json({ limit: "50mb" }));


app.use(express.json());
connectDB();

app.use(cookieParser());

runPendingReminders();


app.use("/api/users", userRoutes)
app.use("/api/notes", notesRoute)
app.use("/api/stock", stockRoute)
app.use("/api/expenses", expenseRoutes);
app.use("/api/webpush", webPushRoutes)
app.use("/api/news", newsRoutes);

app.use("/api/remainders", remainderRoutes);

app.use("/gpt", aiGptRoutes);


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

const server=app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)

})
