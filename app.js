require("dotenv").config()
const express = require("express");
const cors = require("cors");
const compression = require('compression')
const rateLimit = require('express-rate-limit');
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
const tradebookRoutes = require("./routes/tradebook");
const { mountMcp, isMcpRequest } = require("./middleware/mcp");

require('./functions/Scheduler');

if (process.env.NODE_ENV === "production") {
    require("./middleware/telegramBot");
    require("./middleware/telegramAIBot");
}

// TODO : Kite integration

const { runPendingReminders } = require("./functions/remainderJobs");

const app = express();
app.use(cors());

// Skip /mcp: gzip buffers SSE frames, which stalls the MCP event stream.
app.use(compression({
    filter: (req, res) =>
        !isMcpRequest(req) && compression.filter(req, res),
}))

const postApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: {
        message: 'Too many requests, please try again after a minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use((req, res, next) => {
    // MCP is JSON-RPC over POST — a tool-heavy session blows past 60/min.
    if (req.method === 'POST' && !isMcpRequest(req)) {
        return postApiLimiter(req, res, next);
    }
    next();
});

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
app.use("/api/tradebook", tradebookRoutes);

// MCP server — must be mounted before the production catch-all below.
if (process.env.MCP_HTTP_ENABLED !== "false") {
    mountMcp(app);

    // Remote MCP clients probe these before connecting, to find out whether the
    // server wants an OAuth handshake. The React catch-all below answers every
    // unknown GET with index.html, so without this they get 200 text/html where
    // they expect JSON metadata — and a client that cannot read "no OAuth here"
    // from that may try to start an auth flow instead of just connecting. Noteit
    // authenticates inside the session (start_login), not at the transport, so
    // 404 is the honest and useful answer.
    app.use([
        "/.well-known/oauth-authorization-server",
        "/.well-known/oauth-protected-resource",
        "/.well-known/openid-configuration",
    ], (req, res) => {
        res.status(404).json({
            error: "not_supported",
            message: "This MCP server does not use OAuth. Connect without auth and call start_login.",
        });
    });
}


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
