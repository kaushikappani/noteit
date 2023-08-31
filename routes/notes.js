const express = require("express");
const { Note, User } = require("../config/models");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { protect } = require("../middleware/protect");
const { map } = require("draft-js/lib/DefaultDraftBlockRenderMap");

const router = express.Router();

router.route("/").get(protect, asyncHandler(async (req, res) => {
    try {
        var notes = await Note.find({
          user: req.user._id,
          archived: false,
        }).sort({
          createdAt: -1,
        })
        const modifiedNotes = notes.map(note => ({
            ...note.toObject(), 
            view: true 
        }));
        console.log(modifiedNotes)
        user = {
            email: req.user.email,
            name: req.user.name
        };
        res.json({ modifiedNotes, user });
    } catch (err) {
        console.log(err)
        res.clearCookie("token");
    }
}))
router.route("/archived").get(protect, asyncHandler(async (req, res) => {
    const notes = await Note.find({ user: req.user._id ,archived:true}).sort({
      updatedAt: -1,
    });
    user = req.user;
    res.json({ notes, user });
}))

router.route("/create").post(protect, asyncHandler(async (req, res) => {
    const { title, content, category } = req.body;
    if (!content || !title) {
        res.status(400);
        throw new Error("Please fill all the required feilds");
    } else {
        if (req.user.verified === true) {
            const note = new Note({ user: req.user._id, title, category, content })
            const createdNote = await note.save();
            res.status(201).json(createdNote);
        } else {
            res.status(400);
            throw new Error("Please verify your account");
        }
    }
}))

router.route("/:id").get(protect, asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id).select("-color").select("-archived").select("-pinned");
    const modifiedNote = {...note.toObject(),view:true}
    if (note) {
        res.json({ note: modifiedNote, user: req.user })
    } else {
        res.status(400).json({ message: "Note not found" })
    }
}))

router.route("/:id").put(protect, asyncHandler(async (req, res) => {
    const { title, content, category, color,pinned,archived} = req.body;
    const note = await Note.findById(req.params.id);
    if (note.user.toString() !== req.user._id.toString()) {
        res.status(401)
        throw new Error("You cannot edit other notes");
    } if (note) {
        console.log(note.color,color)
        
        note.title = title || note.title;
        note.content = content || note.content;
        note.category = category || note.category;
        console.log("archived",archived);
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