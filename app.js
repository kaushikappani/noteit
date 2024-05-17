require("dotenv").config()
const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const { errorHandler, notFound } = require("./middleware/error");
const { Note } = require("./config/models");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser")
const socket = require("socket.io");

const {socketProtect} = require("./middleware/protect")

const { NseIndia } = require("stock-nse-india");
const nseIndia = new NseIndia()

app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: false
}));
app.use(bodyParser.json({ limit: "50mb" }));

const path = require("path")
app.use(express.json());
connectDB();

app.use(cookieParser());
app.use("/api/users", userRoutes)
app.use("/api/notes", notesRoute)

const getData =  async (symbol) => {

    // let config = {
    //     method: 'get',
    //     maxBodyLength: Infinity,
    //     url: 'https://www.nseindia.com/api/quote-equity?symbol=' + symbol,
    //     headers: {
    //         'accept': '*/*',
    //         'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    //         'cookie': '_abck=4FD9F68B71338A97380FE55F897F76D7~-1~YAAQDuscuNYlUTWPAQAAnHQghQs1aVpvCIIHu032CDrptWDTAPpWEDGUbTayeEQHdHRWoDGrgVDf2fjD+c/YmOfsekK7XqPQk+wmMFfPcI+yBHk6icF1yoLBKL6f+XZllzUGs2wuKGC4fOBvKhGz+Rs/Uymo2i6o6no4QzAzimEPy6/cN/JY/QMkjOy0wv05cXQIYdy/q88/ZP5rwS/36PBEyClN36R2f6MV3W2Jp5JFYkyiBdwVcnXIh19Rmr72bBc3Rkocf+Es/7c/tIWVlKKgfhSSjeu9AsO2TX2izhS+BLBmbvlGoN7RP4R+OURvUQfA5WGOoty+3U4b7dLabsYTfttLNuZgl/1+7saiOO0fCJaXoBVi0yBpEVGIiPhEEMccOpDg28cNRZ2o~-1~||1-YzKvHYGrms-1500-10-1000-2||~-1; Domain=.nseindia.com; Path=/; Expires=Sat, 17 May 2025 05:57:27 GMT; Max-Age=31536000; Secure',
    //         'priority': 'u=1, i',
    //         'referer': 'https://www.nseindia.com/get-quotes/equity?symbol=JIOFIN',
    //         'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    //         'sec-ch-ua-mobile': '?0',
    //         'sec-ch-ua-platform': '"macOS"',
    //         'sec-fetch-dest': 'empty',
    //         'sec-fetch-mode': 'cors',
    //         'sec-fetch-site': 'same-origin',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    //     }
    // };
    // const { data } = await axios.request(config);

    const data = await nseIndia.getEquityDetails(symbol);

    return data;
}

const tradeData = async (symbol) => {
    
    const data = await nseIndia.getEquityTradeInfo(symbol);
    return data;
}


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


const server=app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)
})

const io = socket(server, {
    cors: {
        origin: ["http://localhost:3000", "https://noteit-kof1.onrender.com"],
        methods: ["GET", "POST"]
    }
});

const symbolQuantityObject = {
    "ARVIND": 20,
    "DREAMFOLKS": 21,
    "EXIDEIND": 40,
    "FEDERALBNK": 16,
    "INDHOTEL": 17,
    "ITC": 40,
    "JIOFIN": 240,
    "KCP": 25,
    "MOTHERSON": 110,
    "NHPC": 59,
    "PARKHOTELS": 9,
    "PNB": 160,
    "POWERGRID": 20,
    "RECLTD": 62,
    "SBIN": 25,
    "SUZLON": 418,
    "TATAMOTORS": 10,
    "TATAPOWER": 85,
    "TITAGARH": 48,
    // "UJJIVAN": 20,
    "UJJIVANSFB": 506,
    "VBL": 10,
    "SHRIRAMFIN":1,
};

io.use(socketProtect);

io.on("connection", (socket) => {

    console.log(socket.id);

    let intervalId;

    // Fetch data for fixed symbols, calculate total, and emit to client
    const fetchDataAndSendTotal = async () => {
        let total = 0;
        let payload = [];
        for (const symbol of Object.keys(symbolQuantityObject)) {
            try {
                // const data = await nseIndia.getEquityCorporateInfo(symbol);
                const data = await getData(symbol);
                const tradeInfo = await tradeData(symbol);
                const quantity = symbolQuantityObject[symbol];
                        let stockData = {
                    currentPrice : data.priceInfo.lastPrice,
                    daypnl : parseFloat(data.priceInfo.change) * quantity,
                    symbol: symbol,
                    pChange: data.priceInfo.pChange,
                    change: data.priceInfo.change,
                    deliveryToTradedQuantity: tradeInfo.securityWiseDP.deliveryToTradedQuantity,
                    date: data.metadata.lastUpdateTime
                }
                payload.push(stockData);
                total += parseFloat(data.priceInfo.change) * quantity;
            } catch (error) {
                console.error(`Error fetching data for ${symbol}: ${error}`);
            }
        }
        console.log(total)
        io.to(socket.id).emit("totalPrice", total);
        io.to(socket.id).emit("payload", payload);
    };

    // Call fetchDataAndSendTotal when client connects and every 1 second
    intervalId = setInterval(fetchDataAndSendTotal, 5000);
    console.log("intervalId =",intervalId);

    // Handle disconnection
    socket.on("disconnect", async () => {
        console.log(`Client disconnected: ${socket.id}`);
        clearInterval(intervalId);
    });

});

