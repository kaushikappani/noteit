const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN_AI;
const {
    GoogleGenerativeAI,
} = require("@google/generative-ai");
const client = require('./redis');
const aibot = new TelegramBot(token, { polling: true });
const util = require("util");
const { telegramProtect } = require('./protect');





aibot.on('message',async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    await aibot.sendChatAction(chatId, 'typing');
    try {
        if (chatId === 1375808164) {

            const apiKey = process.env.GEMINI_API_KEY;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: "you are personal AI chat bot learn form the chat history about the person and respond",
            });

            const generationConfig = {
                temperature: 0.9,
                topP: 0.9,
                topK: 64,
                maxOutputTokens: 5000,
                responseMimeType: "text/plain",
            };
            const getAsync = util.promisify(client.lRange).bind(client);
            let redisChatHistory = await getAsync(`chatHistory:${chatId}`, 0, -1);
            async function run() {
                redisChatHistory = redisChatHistory || [];
                const chatHistory = redisChatHistory.map((entry) => JSON.parse(entry));
                const chatSession = model.startChat({
                    generationConfig,
                    // safetySettings: Adjust safety settings
                    // See https://ai.google.dev/gemini-api/docs/safety-settings
                    history: [...chatHistory
                    ],
                });
                const result = await chatSession.sendMessage(text);

                const userMessage = {
                    role: "user",
                    parts: [{ text: text  }],
                };
                await client.rpush(`chatHistory:${chatId}`, JSON.stringify(userMessage));
                let output = result.response.text()
                
                const aiMessage = {
                    role: "model",
                    parts: [{ text: output  }],
                };
                await client.rpush(`chatHistory:${chatId}`, JSON.stringify(aiMessage));

                await aibot.sendMessage(chatId, output);

            }
            await run();
        }
    } catch (e) {
        console.error(`Error in telegram AI bot ${e}`)
        aibot.sendMessage(chatId, "Unable to process your message");
    }
});


aibot.onText(/^\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    await client.del(`chatHistory:${chatId}`);
    await aibot.sendMessage(chatId, "Chat History Cleared!");
})

module.exports = aibot
