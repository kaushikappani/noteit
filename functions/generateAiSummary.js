const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Note } = require("../config/models");

const generateAiSummary = async (id, noteId) => {
    console.log("generative AI Processing Start ");
    const notes = await Note.find({
        user: id,
        archived: false,

    }).sort({ createdAt: -1 }).limit(10);

    let history = notes.map(note => ({
        role: 'user',
        parts: [{
            text: `Title: ${note.content}, Content: ${note.content}, Category: ${note.category}`
        }]
    }))

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: "You have to generate a small summary covering all important information into a small summary in a notes app named NOTEIT you should generate detailed summary output ONLY on HTML",
    });


    const generationConfig = {
        temperature: 0.9,
        topP: 0.9,
        topK: 64,
        maxOutputTokens: 5000,
        responseMimeType: "text/plain",
    };


    async function run() {
        console.log("generative AI Run Function Start ");

        const chatSession = model.startChat({
            generationConfig,
            // safetySettings: Adjust safety settings
            // See https://ai.google.dev/gemini-api/docs/safety-settings
            history: history,
        });
        // console.log(notes);
        const result = await chatSession.sendMessage("Generate Summary form the above data");

        let content = result.response.text().replace('```html', "").replace('```', "");
        let note = await Note.find({ _id: noteId });
        if (!note) {
            note = new Note({ pinned: true, user: req.user._id, title: "AI - Summary", category: "AI - Summary", content });
        } else {
            note.content = content;
        }
        
        await note.save();
        console.log("generative AI Run Function Start ");

    }

    await run();
    console.log("generative AI Processing End ");




}
module.exports = { generateAiSummary };