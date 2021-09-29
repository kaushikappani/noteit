const mongoose = require("mongoose");

const connectDB = () => {
    mongoose.connect(process.env.MONGO_URI, {
        useUnifiedTopology: true,
        useNewUrlParser: true,
    }).then(() => {
        console.log("db connected");
    }).catch((err) => {
        console.error(err);
    })
}

module.exports = connectDB;