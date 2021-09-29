const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    }, email: {
        type: String,
        required: true,
        unique: true
    }, password: {
        type: String,
        required: true
    }, pic: {
        type: String,
        default: "https://www.pngfind.com/pngs/m/676-6764065_default-profile-picture-transparent-hd-png-download.png"
    }, verified: {
        type: Boolean,
        required: true,
        default: false
    }
}, { timestamps: true })

const User = mongoose.model("User", userSchema);

const noteModel = mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",

    },
}, {
    timestamps: true
})

const Note = mongoose.model("Note", noteModel)

module.exports = { User, Note }