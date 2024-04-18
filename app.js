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


const server = app.listen(process.env.PORT, () => {
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
    "INDHOTEL": 17,
    "ITC": 40,
    "JIOFIN": 227,
    "KCP": 25,
    "MOTHERSON": 110,
    "NHPC": 51,
    "PARKHOTELS": 9,
    "PNB": 155,
    "POWERGRID": 17,
    "RECLTD": 50,
    "SBIN": 22,
    "SUZLON": 418,
    "TATAMOTORS": 10,
    "TATAPOWER": 82,
    "TITAGARH": 48,
    "UJJIVAN": 20,
    "UJJIVANSFB": 152,
    "VBL": 10
};

io.on("connection", (socket) => {

    console.log(socket.id);

    // Fetch data for fixed symbols, calculate total, and emit to client
    const fetchDataAndSendTotal = async () => {
        let total = 0;
        for (const symbol of Object.keys(symbolQuantityObject)) {
            try {
                const data = await nseIndia.getEquityCorporateInfo(symbol);
                const quantity = symbolQuantityObject[symbol];
                total += parseFloat(data.priceInfo.change) * quantity;
            } catch (error) {
                console.error(`Error fetching data for ${symbol}: ${error}`);
            }
        }
        console.log(total)
        io.to(socket.id).emit("totalPrice", total);
    };

    // Call fetchDataAndSendTotal when client connects and every 1 second
    setInterval(fetchDataAndSendTotal, 1000);

    // Handle disconnection
    socket.on("disconnect", async () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

});


