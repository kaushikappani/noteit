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
    console.log(req.body.message);
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
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

    console.log(chatSession);

    res.flushHeaders();
    try {
        console.log(req.body.message);
        const result = await chatSession.sendMessageStream(req.body.message + "give the response on");
        console.log(result);


        const aiMessage = {
            role: "model",
            parts: [],
        };

        for await (const chunk of result.stream) {
            const chunkText = chunk.text().replace(/^```[a-z]*\n?/i, "")
                .replace(/```$/, "");
            console.log(chunkText);
            res.write(
                chunkText
                    .replace(/^```[a-z]*\n?/i, "") 
                    .replace(/```$/, "")
            );

            aiMessage.parts.push({ text: chunkText });
        }

        const userMessage = {
            role: "user",
            parts: [{ text: req.body.message }],
        };
        await client.rpush(`chatHistory:ai:${req.user._id}`, JSON.stringify(userMessage));

      
        await client.rpush(`chatHistory:ai:${req.user._id}`, JSON.stringify(aiMessage));

        res.end();
    } catch (error) {
        console.error("Error generating AI response:", error);
        res.status(500).json({ error: "Failed to generate response" });
    }
});


module.exports = router;