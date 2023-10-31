const express = require("express");
const { Note, User, NoteHistory, NoteAccess } = require("../config/models");
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

router.route("/:id/:history").get(
    protect,
    asyncHandler(async (req, res) => {
        const note = await Note.findById(req.params.id)
            .select("-color")
            .select("-archived")
            .select("-pinned");
        console.log(note.id)
        const noteAccess = await NoteAccess.findOne({ note: note.id, user: req.user._id, isActive: true })
        console.log(noteAccess)
        if (note.user.toString() !== req.user._id.toString() && noteAccess == null ) {
            res.status(401);
            throw new Error("Oops! No Access to View");
        }
        const noteHistory = await NoteHistory.findOne({ note: note.id });
  
        switch (req.params.history) {
            case "h0":
                break;
            case "h1":
                console.log("h1")         
                note.content = noteHistory!=null ?  noteHistory.h1 : note.content;
                break;
            case "h2":
                console.log("h2")           
                note.content = noteHistory != null ? noteHistory.h2 : note.content;
                break;
            case "h3":
                console.log("h3")           
                console.log(noteHistory)
                note.content = noteHistory != null ? noteHistory.h3 : note.content;
                break; 
        }
        const modifiedNote = { ...note.toObject(), view: true };
        if (note) {
            res.json({ note: modifiedNote, user: req.user });
        } else {
            res.status(400).json({ message: "Note not found" });
        }
    })
);

router.route("/share/:id/:userEmail").post(protect, asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    const user = await User.findOne({ email: req.params.userEmail })
    
    if (!user) {
        res.status(404);
        throw new Error("Oops! User Not Found");
    }
   
    
    if (note.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error("Oops! You cannot share others notes");
    }
    
    const noteAccess = await NoteAccess.findOne({ note: note._id, user: user._id, isActive: true })

    if (noteAccess) {
        res.status(401);
        throw new Error("Access Already Given");
    }
    if (note) {
        const newNoteAccess = new NoteAccess({ note: req.params.id, user: user._id, isActive: true })
        await newNoteAccess.save();
        res.status(200).json({ message: "Access given to " + req.params.userEmail })
    } else {
        res.status(404);
        throw new Error("Note! User Not Found"); 
    }
}))

router.route("/shared").get(protect, asyncHandler(async (req, res) => {
    const noteAccess = await NoteAccess.find({ user: req.user._id });
    const notes = [];

    for (const access of noteAccess) {
        const note = await Note.findById(access.note);
        console.log(note);
        notes.push(note);
    }

    res.json({ notes });
}))

router.route("/:id").put(
    protect,
    asyncHandler(async (req, res) => {
        const { title, content, category, color, pinned, archived } = req.body;
        const note = await Note.findById(req.params.id);
        const noteHistory = await NoteHistory.findOne({ note: note.id });
        console.log("---------")
        console.log(typeof noteHistory)
       

        if (note) {
            console.log(note.color, color);
            if (note.content === content && note.title === title && note.category == category) {
                res.status(304);
                console.log("no changes");
                throw new Error("No Changes in note");
            } else if (note.content != content) {
                if (noteHistory == null) {
                    const newNotehistory = new NoteHistory({ note: note.id, h1: note.content, h2: "", h3: "" });
                    const res = await newNotehistory.save();
                    console.log("res1");
                    console.log(res)
                } else {
                    console.log(noteHistory);
                    noteHistory.h3 = noteHistory.h2;
                    noteHistory.h2 = noteHistory.h1;
                    noteHistory.h1 = note.content;
                    const res = await noteHistory.save();
                    console.log("res", res);
                }
            }
            if (note.user.toString() !== req.user._id.toString()) {
                res.status(401);
                throw new Error("You cannot edit other notes");
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
