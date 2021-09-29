const express = require("express");
const { Note, User } = require("../config/models");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { protect } = require("../middleware/protect");

const router = express.Router();

router.route("/").get(protect, asyncHandler(async (req, res) => {
    console.log("jello")
    const notes = await Note.find({ user: req.user._id });
    user = req.user;
    res.json({ notes, user });
}))

router.route("/create").post(protect, asyncHandler(async (req, res) => {
    const { title, content, category } = req.body;
    if (!content || !title || !category) {
        res.status(400);
        throw new Error("Please fill all the fields");
    } else {
        const note = new Note({ user: req.user._id, title, category, content })
        const createdNote = await note.save();
        res.status(201).json(createdNote);
    }
}))

router.route("/:id").get(protect, asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (note) {
        res.json({ note, user: req.user })
    } else {
        res.status(400).json({ message: "Note not found" })
    }
}))

router.route("/:id").put(protect, asyncHandler(async (req, res) => {
    const { title, content, category } = req.body;
    const note = await Note.findById(req.params.id);
    if (note.user.toString() !== req.user._id.toString()) {
        res.status(401)
        throw new Error("You cannot edit other notes");
    } if (note) {
        note.title = title;
        note.content = content;
        note.category = category;
        const updatedNote = await note.save();
        res.json(updatedNote);

    } else {
        res.status(401);
        throw new Error("Note not found")
    }
}))

router.route("/:id").delete(protect, asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (note.user.toString() !== req.user._id.toString()) {
        res.status(401)
        throw new Error("You cannot edit other notes");
    } if (note) {
        await note.remove();
        res.json({ message: "Note removed" })
    } else {
        res.status(401);
        throw new Error("Note not found")
    }
}))

module.exports = router