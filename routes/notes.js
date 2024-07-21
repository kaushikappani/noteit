const express = require("express");
const { Note, User, NoteHistory, NoteAccess } = require("../config/models");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { protect, stockProtect } = require("../middleware/protect");
const client = require("../middleware/redis");
const util = require('util');
const { readFile } = require("../middleware/mailer");
const { giftNifty } = require("../middleware/StockScheduler");
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const { content } = require("googleapis/build/src/apis/content");



// const { map } = require("draft-js/lib/DefaultDraftBlockRenderMap");

const router = express.Router();

router.route("/").get(
    protect,
    asyncHandler(async (req, res) => {
        try {
            // Fetch notes from the database
            if (req.user.email === "kaushikappani@gmail.com") {
                await giftNifty();
            }
            const notes = await Note.find({
                user: req.user._id,
                archived: false,
            }).sort({ createdAt: -1 }).select("-user");

            // Modify notes by adding view and edit properties
            const modifiedNotes = notes.map(note => ({
                ...note.toObject(),
                view: true,
                edit: true,
            }));

            if (req.user.email === "kaushikappani@gmail.com") {
                const getAsync = util.promisify(client.get).bind(client);

                const result = await getAsync("deliveryreport");
                const resultDate = await getAsync("deliveryreportlastupdated");

                const mailTemplate = await readFile("../templates/stock_email.txt");

                if (result) {
                    const deliveryreport = {
                        _id: "deliveryreport",
                        title: "Delivery Report - " + resultDate,
                        content: mailTemplate.replace("<!-- Repeat rows as needed -->", result),
                        pinned: true,
                        archived: false,
                        color: "#202124",
                        view: true,
                        edit: false,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        category : "Scheduler"
                    };
                    modifiedNotes.push(deliveryreport);
                }
            }

            
            const user = {
                email: req.user.email,
                name: req.user.name,
            };

            // Send the response
            res.json({ modifiedNotes, user });
        } catch (err) {
            console.error(err);
            res.clearCookie("token");
            res.status(500).json({ message: "Internal Server Error" });
        }
    })
);
router.route("/archived").get(
    protect,
    asyncHandler(async (req, res) => {
        const notes = await Note.find({ user: req.user._id, archived: true }).sort({
            updatedAt: -1,
        }).select("-user");
        user = req.user;
        user._id = null;
        const modifiedNotes = notes.map((note) => ({
            ...note.toObject(),
            view: true,
            edit: true,
        }));
        res.json({ notes: modifiedNotes, user });
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
                createdNote.user = null;
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
        if (req.user.email === "kaushikappani@gmail.com" && req.params.id === "deliveryreport") {
            const getAsync = util.promisify(client.get).bind(client);

            const result = await getAsync("deliveryreport");
            const resultDate = await getAsync("deliveryreportlastupdated");

            const mailTemplate = await readFile("../templates/stock_email.txt");

            if (result) {
                const deliveryreport = {
                    _id: "deliveryreport",
                    title: "Delivery Report - " + resultDate,
                    content: mailTemplate.replace("<!-- Repeat rows as needed -->", result),
                    pinned: true,
                    archived: false,
                    color: "#202124",
                    view: true,
                    edit: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    category : "Scheduler"
                };
                let user = {
                    "name": "Scheduler",
                    "email": "Scheduler"
                }

                res.json({ note: deliveryreport,user})
            }
        }


        const note = await Note.findById(req.params.id)
            .select("-color")
            .select("-archived")
            .select("-pinned");
        const owner = await User.findById(note.user).select("name email -_id");
        const noteAccess = await NoteAccess.findOne({ note: note.id, user: req.user._id, isActive: true })
        if (note.user.toString() !== req.user._id.toString() && noteAccess == null) {
            res.status(401);
            throw new Error("Oops! No Access to View");
        }
        const noteHistory = await NoteHistory.findOne({ note: note.id });

        switch (req.params.history) {
            case "h0":
                break;
            case "h1":
                note.content = noteHistory != null ? noteHistory.h1 : note.content;
                break;
            case "h2":
                note.content = noteHistory != null ? noteHistory.h2 : note.content;
                break;
            case "h3":
                note.content = noteHistory != null ? noteHistory.h3 : note.content;
                break;
        }
        const edit = note.user.toString() === req.user._id.toString();
        const modifiedNote = { ...note.toObject(), view: true, edit ,user:null};

       

        if (note) {
            res.json({ note: modifiedNote, user: owner });
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
    const noteAccess = await NoteAccess.find({ user: req.user._id, isActive: true });
    const notes = [];

    for (const access of noteAccess) {
        const note = await Note.findById(access.note).select("-user");
        if (note != null) {
            notes.push(note);
        }

    }

    const modifiedNotes = notes.map((note) => ({
        ...note.toObject(),
        view: true,
        edit: false,
    }));

    res.json({ notes: modifiedNotes });
}))

router.route("/:id").put(
    protect,
    asyncHandler(async (req, res) => {
        const { title, content, category, color, pinned, archived } = req.body;
        const note = await Note.findById(req.params.id);
        const noteHistory = await NoteHistory.findOne({ note: note.id });



        if (note) {
            if (note.content === content && note.title === title && note.category == category) {
                res.status(304);
                throw new Error("No Changes in note");
            } else if (note.content != content) {
                if (noteHistory == null) {
                    const newNotehistory = new NoteHistory({ note: note.id, h1: note.content, h2: "", h3: "" });
                    const res = await newNotehistory.save();
    
                } else {
                    noteHistory.h3 = noteHistory.h2;
                    noteHistory.h2 = noteHistory.h1;
                    noteHistory.h1 = note.content;
                    const res = await noteHistory.save();
                }
            }
            if (note.user.toString() !== req.user._id.toString()) {
                res.status(401);
                throw new Error("You cannot edit other notes");
            }
            note.title = title || note.title;
            note.content = content || note.content;
            note.category = category || note.category;
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
            updatedNote.user = null;
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
        const noteHistory = await NoteHistory.findOne({ note: req.params.id });
        const noteAccess = await NoteAccess.find({ note: req.params.id });

        noteAccess.forEach(element => {
            element.remove();
        });

        if (note.user.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error("You cannot edit other notes");
        }
        if (noteHistory) {
            await noteHistory.remove();
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

router.route("/:id/genai/summary").get(stockProtect,asyncHandler(async (req, res) => {
        console.log("triggered");
        const note = await Note.findById(req.params.id);
        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
        });

        const generationConfig = {
            temperature: 0.9,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        };

        async function run() {
            const chatSession = model.startChat({
                generationConfig,
                // safetySettings: Adjust safety settings
                // See https://ai.google.dev/gemini-api/docs/safety-settings
                history: [
                ],
            });

            const result = await chatSession.sendMessage(note.content + " give summary in html fragments based on the above data");

            let content = "======= AI Generated =======​" + result.response.text() + " ======= AI Generated =======​"+ note.content
            note.content = content;
            await note.save();
        }
        await run();

        res.status(200).json({ message: "AI Summary Generated"});
    })
);


module.exports = router;


