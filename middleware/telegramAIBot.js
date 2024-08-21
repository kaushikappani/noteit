const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN_AI;
const {
    GoogleGenerativeAI,
} = require("@google/generative-ai");
const aibot = new TelegramBot(token, { polling: true });

let chatHistory = [];

aibot.onText(/^\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    chatHistory = [];
    await aibot.sendMessage(chatId, "Chat History Cleared!");
})
aibot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    await aibot.sendChatAction(chatId, 'typing');

    console.log(msg.chat.id)
    if (chatId === 1375808164) {
       
        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "",
        });

        const generationConfig = {
            temperature: 0.9,
            topP: 0.9,
            topK: 64,
            maxOutputTokens: 5000,
            responseMimeType: "text/plain",
        };

        async function run() {
            const chatSession = model.startChat({
                generationConfig,
                // safetySettings: Adjust safety settings
                // See https://ai.google.dev/gemini-api/docs/safety-settings
                history: [...chatHistory
                ],
            });

            
            const result = await chatSession.sendMessage(text);

            chatHistory.push({
                role: "user",
                parts: [
                    { text: text + "\n" },
                ],
            });
            let output = result.response.text()
            chatHistory.push({
                role: "model",
                parts: [
                    { text: output + "\n" },
                ],
            });

            await aibot.sendMessage(chatId, output, { parse_mode: "markdown" });

        }
        await run();
    }
});

module.exports = aibot
