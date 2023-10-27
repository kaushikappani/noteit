const express = require("express");
const { Note, User, NoteHistory } = require("../config/models");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { protect } = require("../middleware/protect");
// const { map } = require("draft-js/lib/DefaultDraftBlockRenderMap");

const router = express.Router();

router.route("/").get(
    protect,
    asyncHandler(async (req, res) => {
        try {
            var notes = await Note.find({
                user: req.user._id,
                archived: false,
            }).sort({
                createdAt: -1,
            });
            const modifiedNotes = notes.map((note) => ({
                ...note.toObject(),
                view: true,
            }));
            user = {
                email: req.user.email,
                name: req.user.name,
            };
            res.json({ modifiedNotes, user });
        } catch (err) {
            console.log(err);
            res.clearCookie("token");
        }
    })
);
router.route("/archived").get(
    protect,
    asyncHandler(async (req, res) => {
        const notes = await Note.find({ user: req.user._id, archived: true }).sort({
            updatedAt: -1,
        });
        user = req.user;
        res.json({ notes, user });
    })
);

router.route("/create").post(
    protect,
    asyncHandler(async (req, res) => {
        const { title, content, category } = req.body;
        if (!content || !title) {
            res.status(400);
            throw new Error("Please fill all the required feilds");
        } else {
            if (req.user.verified === true) {
                const note = new Note({ user: req.user._id, title, category, content });
                const createdNote = await note.save();
                res.status(201).json(createdNote);
            } else {
                res.status(400);
                throw new Error("Please verify your account");
            }
        }
    })
);

router.route("/:id").get(
    protect,
    asyncHandler(async (req, res) => {
        const note = await Note.findById(req.params.id)
            .select("-color")
            .select("-archived")
            .select("-pinned");
        const modifiedNote = { ...note.toObject(), view: true };
        if (note) {
            res.json({ note: modifiedNote, user: req.user });
        } else {
            res.status(400).json({ message: "Note not found" });
        }
    })
);

router.route("/:id").put(
    protect,
    asyncHandler(async (req, res) => {
        const { title, content, category, color, pinned, archived } = req.body;
        const note = await Note.findById(req.params.id);
        const noteHistory = await NoteHistory.findOne({ note: note.id });
        console.log("---------")
        console.log(typeof noteHistory)
        if (note.user.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error("You cannot edit other notes");
        }

        if (note) {
            console.log(note.color, color);
            if (note.content === content) {
                res.status(304);
                console.log("no changes");
                throw new Error("No Changes in note");
            } else {
                if (noteHistory==null) {
                    const newNotehistory = new NoteHistory({ note: note.id, h1: note.content,h2:"",h3:"" });
                    const res = await newNotehistory.save();
                    console.log("res1");
                    console.log(res)
                } else {
                    console.log(noteHistory);
                    noteHistory.h3 = noteHistory.h2;
                    noteHistory.h2 = noteHistory.h1;
                    noteHistory.h1 = note.content;
                    const res = await noteHistory.save();
                    console.log("res",res);
                }
            }
            note.title = title || note.title;
            note.content = content || note.content;
            note.category = category || note.category;
            console.log("archived", archived);
            if (archived) {
                note.archived = !note.archived;
            }
            if (pinned) {
                note.pinned = !note.pinned;
            }
            if (color && color === note.color) {
                note.color = "#202124";
            } else {
                note.color = color || note.color;
            }

            const updatedNote = await note.save();
            res.json(updatedNote);
        } else {
            res.status(401);
            throw new Error("Note not found");
        }
    })
);

router.route("/:id").delete(
    protect,
    asyncHandler(async (req, res) => {
        const note = await Note.findById(req.params.id);
        if (note.user.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error("You cannot edit other notes");
        }
        if (note) {
            await note.remove();
            res.json({ message: "Note removed" });
        } else {
            res.status(401);
            throw new Error("Note not found");
        }
    })
);

module.exports = router;
