require("dotenv").config()
const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
const userRoutes = require("./routes/user");
const notesRoute = require("./routes/notes");
const { errorHandler, notFound } = require("./middleware/error");
const { protect } = require("./middleware/protect");
const { Note } = require("./config/models");
const cookieParser = require("cookie-parser");
const path = require("path")
app.use(express.json());
connectDB();

app.use(cookieParser());
app.use("/api/users", userRoutes)
app.use("/api/notes", notesRoute)


// __dirname = path.resolve();
// if (process.env.NODE_ENV === "production") {
//     app.use(express.static(path.join(__dirname, "/noteitfrontend/build",)))
//     app.get("*", (req, res) => {
//         res.sendFile(path.resolve(__dirname, "noteitfrontend", "build", "index.html"));
//     })
// } else {
//     app.get("/", async(req, res) => {
//         const notes = await Note.find({});
//         notes.forEach(n => {
//             n.archived = false
//             n.save();
//         })
//         res.send("done")
//     })
// }

app.use(errorHandler)
app.use(notFound)


app.listen(process.env.PORT, () => {
    console.log(`server running ${process.env.PORT}`)
})