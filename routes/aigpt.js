const express = require("express");
const { protect } = require("../middleware/protect");
const router = express.Router();
const util = require("util");
const { HarmCategory, HarmBlockThreshold, GoogleGenerativeAI } = require("@google/generative-ai");
const client = require("../middleware/redis");


const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    }
];


const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);


router.route("/ai/chat").post(protect, async (req, res) => {
    if (!req.body.message || typeof req.body.message !== 'string' || req.body.message.trim() === '') {
        return res.status(400).json({ error: "Message cannot be empty" });
    }

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-live-001",
        safetySettings,
        systemInstruction: "Give the response only in HTML components only",
    });

    const generationConfig = {
        temperature: 0.9,
        topP: 0.9,
        topK: 64,
        maxOutputTokens: 5000,
        responseMimeType: "text/plain",
    };

    const getAsync = util.promisify(client.lRange).bind(client);
    let redisChatHistory = await getAsync(`chatHistory:ai:${req.user._id}`, 0, -1);
    redisChatHistory = redisChatHistory || [];
    const chatHistory = redisChatHistory.map((entry) => JSON.parse(entry));

    const chatSession = model.startChat({
        generationConfig,
        history: [...chatHistory],
    });

    try {
        const result = await chatSession.sendMessage(req.body.message);

        const responseText = result.response.text()
            .replace('```html', "").replace('```', "");

        const aiMessage = {
            role: "model",
            parts: [{ text: responseText }],
        };

        const userMessage = {
            role: "user",
            parts: [{ text: req.body.message }],
        };

        // Save to Redis history
        await client.rpush(`chatHistory:ai:${req.user._id}`, JSON.stringify(userMessage));
        await client.rpush(`chatHistory:ai:${req.user._id}`, JSON.stringify(aiMessage));

        res.setHeader("Content-Type", "text/plain");
        res.send(responseText);
    } catch (error) {
        console.error("Error generating AI response:", error);
        res.status(500).json({ error: "Failed to generate response" });
    }
});



module.exports = router;
