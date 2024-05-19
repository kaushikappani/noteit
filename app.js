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
const socket = require("socket.io");
const schedule = require('node-schedule');
const moment = require('moment-timezone');

const timeZone = 'Asia/Kolkata';

// Define the time in IST
const targetTime = moment.tz('18:00', 'HH:mm', timeZone);

// Create a new RecurrenceRule
const rule = new schedule.RecurrenceRule();
rule.hour = targetTime.hour();
rule.minute = targetTime.minute();
rule.tz = 'Asia/Kolkata';

// const {socketProtect} = require("./middleware/protect")

// const { NseIndia } = require("stock-nse-india");


app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false
}));
app.use(bodyParser.json({ limit: "50mb" }));

const path = require("path");
const { scheduleTask } = require("./middleware/StockScheduler");
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
    app.get("/", async(req, res) => {
        const notes = await Note.find({});
        notes.forEach(n => {
            n.archived = false
            n.save();
        })
        res.send("done")
    })
}



app.use(errorHandler)
app.use(notFound)

schedule.scheduleJob(rule, () => {
    console.log('Scheduler triggered at 6 PM');
    scheduleTask();
});


const server=app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)

})

// const io = socket(server, {
//     cors: {
//         origin: ["http://localhost:3000", "https://noteit-kof1.onrender.com"],
//         methods: ["GET", "POST"]
//     }
// });


// io.use(socketProtect);

// io.on("connection", (socket) => {

//     console.log(socket.id);

//     let intervalId;

//     // Fetch data for fixed symbols, calculate total, and emit to client
//     const fetchDataAndSendTotal = async () => {
//         const nseIndia = new NseIndia()
//         let total = 0;
//         let payload = [];
//         for (const symbol of Object.keys(symbolQuantityObject)) {
//             try {
//                 // const data = await nseIndia.getEquityCorporateInfo(symbol);
//                 const data = await getData(symbol, nseIndia);
//                 const tradeInfo = await tradeData(symbol, nseIndia);
//                 const quantity = symbolQuantityObject[symbol];
//                         let stockData = {
//                     currentPrice : data.priceInfo.lastPrice,
//                     daypnl : parseFloat(data.priceInfo.change) * quantity,
//                     symbol: symbol,
//                     pChange: data.priceInfo.pChange,
//                     change: data.priceInfo.change,
//                     deliveryToTradedQuantity: tradeInfo.securityWiseDP.deliveryToTradedQuantity,
//                     date: data.metadata.lastUpdateTime
//                 }
//                 payload.push(stockData);
//                 total += parseFloat(data.priceInfo.change) * quantity;
//             } catch (error) {
//                 console.error(`Error fetching data for ${symbol}: ${error}`);
//             }
//         }
//         console.log(total)
//         io.emit("totalPrice", total);
//         io.emit("payload", payload);
//     };

//     fetchDataAndSendTotal();

//     // Call fetchDataAndSendTotal when client connects and every 5 second
    
//     intervalId = setInterval(fetchDataAndSendTotal, 6000);
//     console.log("intervalId =",intervalId);

//     // Handle disconnection
//     socket.on("disconnect", async () => {
//         console.log(`Client disconnected: ${socket.id}`);
//         clearInterval(intervalId);
//     });

// });

