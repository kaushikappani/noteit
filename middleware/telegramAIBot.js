// const TelegramBot = require('node-telegram-bot-api');
// const token = process.env.TELEGRAM_BOT_TOKEN_AI;
// const {
//     GoogleGenerativeAI, HarmBlockThreshold, HarmCategory
// } = require("@google/generative-ai");
// const client = require('./redis');
// const aibot = new TelegramBot(token, { polling: true });
// const util = require("util");
// const { Note } = require('../config/models');
// const { GoogleAIFileManager } = require("@google/generative-ai/server");
// const request = require('request');
// const path = require('path');
// const fs = require('fs');
// const telegramifyMarkdown = require('telegramify-markdown');



// const apiKey = process.env.GEMINI_API_KEY;
// const genAI = new GoogleGenerativeAI(apiKey);
// const fileManager = new GoogleAIFileManager(apiKey);

// const safetySettings = [
//     {
//         category: HarmCategory.HARM_CATEGORY_HARASSMENT,
//         threshold: HarmBlockThreshold.BLOCK_NONE,
//     },
//     {
//         category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
//         threshold: HarmBlockThreshold.BLOCK_NONE,
//     },
//     {
//         category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
//         threshold: HarmBlockThreshold.BLOCK_NONE,
//     },
//     {
//         category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
//         threshold: HarmBlockThreshold.BLOCK_NONE,
//     }
// ];

// aibot.on('message', async (msg) => {
//     const chatId = msg.chat.id;
//     const text = msg.text || "";

//     await aibot.sendChatAction(chatId, 'typing');

//     try {
//         if (chatId === 1375808164) {
//             if (msg.photo) {
//                 // Download the photo
//                 const fileId = msg.photo[msg.photo.length - 1].file_id;
//                 const fileLink = await aibot.getFileLink(fileId);
//                 const filePath = path.join(__dirname, `downloaded_${fileId}.jpg`);

//                 request.get(fileLink).pipe(fs.createWriteStream(filePath)).on('finish', async () => {
//                     console.log(`Downloaded photo to ${filePath}`);

//                     // Upload to Gemini
//                     async function uploadToGemini(path, mimeType) {
//                         const uploadResult = await fileManager.uploadFile(path, {
//                             mimeType,
//                             displayName: path,
//                         });
//                         const file = uploadResult.file;
//                         console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
//                         return file;
//                     }

//                     const uploadedFile = await uploadToGemini(filePath, 'image/jpeg');

//                     // Start chat session with Gemini
//                     const model = genAI.getGenerativeModel({
//                         model: "gemini-1.5-flash",
//                         safetySettings,
//                         systemInstruction: "You are personal AI telegram chat bot, learn from the chat history about the person and respond.",
//                     });

//                     const generationConfig = {
//                         temperature: 0.9,
//                         topP: 0.9,
//                         topK: 64,
//                         maxOutputTokens: 5000,
//                         responseMimeType: "text/plain",
//                     };

//                     const getAsync = util.promisify(client.lRange).bind(client);
//                     let redisChatHistory = await getAsync(`chatHistory:${chatId}`, 0, -1);
//                     redisChatHistory = redisChatHistory || [];
//                     const chatHistory = redisChatHistory.map((entry) => JSON.parse(entry));
//                     const fileData = {
//                         role: "user",
//                         parts: [
//                             {
//                                 fileData: {
//                                     mimeType: uploadedFile.mimeType,
//                                     fileUri: uploadedFile.uri,
//                                 },
//                             },
//                         ],
//                     }
//                     const chatSession = model.startChat({
//                         generationConfig,
//                         history: [
//                             ...chatHistory,
//                             fileData
//                         ],
//                     });

//                     const result = await chatSession.sendMessage(text);

//                     // Save chat history
//                     const userMessage = {
//                         role: "user",
//                         parts: [{ text: text }],
//                     };
//                     await client.rpush(`chatHistory:${chatId}`, JSON.stringify(fileData));
//                     await client.rpush(`chatHistory:${chatId}`, JSON.stringify(userMessage));

//                     const aiMessage = {
//                         role: "model",
//                         parts: [{ text: result.response.text() }],
//                     };
//                     await client.rpush(`chatHistory:${chatId}`, JSON.stringify(aiMessage));

//                     // Send response back to Telegram
//                     await aibot.sendMessage(chatId, telegramifyMarkdown(result.response.text()), { parse_mode: 'MarkdownV2' });

//                     // Clean up the downloaded file
//                     fs.unlinkSync(filePath);
//                 });
//             } else {
//                 // Handle text messages
//                 const model = genAI.getGenerativeModel({
//                     model: "gemini-1.5-flash",
//                     safetySettings,
//                     systemInstruction: "You are personal AI telegram chat bot, learn from the chat history about the person and respond.",
//                 });

//                 const generationConfig = {
//                     temperature: 0.9,
//                     topP: 0.9,
//                     topK: 64,
//                     maxOutputTokens: 5000,
//                     responseMimeType: "text/plain",
//                 };

//                 const getAsync = util.promisify(client.lRange).bind(client);
//                 let redisChatHistory = await getAsync(`chatHistory:${chatId}`, 0, -1);
//                 redisChatHistory = redisChatHistory || [];
//                 const chatHistory = redisChatHistory.map((entry) => JSON.parse(entry));

//                 const chatSession = model.startChat({
//                     generationConfig,
//                     history: [...chatHistory],
//                 });

//                 const result = await chatSession.sendMessage(text);

//                 const userMessage = {
//                     role: "user",
//                     parts: [{ text: text }],
//                 };
//                 await client.rpush(`chatHistory:${chatId}`, JSON.stringify(userMessage));

//                 const aiMessage = {
//                     role: "model",
//                     parts: [{ text: result.response.text() }],
//                 };
//                 await client.rpush(`chatHistory:${chatId}`, JSON.stringify(aiMessage));
//                 console.log(result.response.text());
//                 await aibot.sendMessage(chatId, telegramifyMarkdown(result.response.text(), 'remove'), { parse_mode: 'MarkdownV2' });
//             }
//         }
//     } catch (e) {
//         console.error(`Error in telegram AI bot ${e}`);
//         await aibot.sendMessage(chatId, "Unable to process your message");
//     }
// });





// aibot.onText(/^\/clear/, async (msg) => {
//     const chatId = msg.chat.id;
//     await client.del(`chatHistory:${chatId}`);
//     await aibot.sendMessage(chatId, "Chat History Cleared!");
// })

// module.exports = aibot
