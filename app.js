require("dotenv").config()
const express = require("express");
const notes = require("./data");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const { errorHandler, notFound } = require("./middleware/error");
const { protect } = require("./middleware/protect");
const path = require("path")


var corsOptions = {
    origin: 'http://192.168.29.200:3000',
    optionsSuccessStatus: 200
}
connectDB();
app.use(cors(corsOptions))
app.use(express.json())

app.get("/", (req, res) => {
    res.send({ text: "hello world" });
})

app.use("/api/users", userRoutes)
app.use("/api/notes", notesRoute)

__dirname = path.resolve();
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname)))
} else {

}

app.use(errorHandler)
app.use(notFound)


app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)
})