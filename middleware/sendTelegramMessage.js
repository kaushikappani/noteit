const TelegramBot = require("node-telegram-bot-api");
const util = require("util");
const { sendTweetSafely } = require("../functions/xService");
const client = require('./redis');


const redisGet = util.promisify(client.get).bind(client);
const redisSet = util.promisify(client.set).bind(client);

const COOLDOWN_HOURS = 49;
const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: false });

async function shouldSend(redisKey) {
  const exists = await redisGet(redisKey);
  return !exists;
}

async function markSent(redisKey) {
  await redisSet(redisKey, "sent", "EX", COOLDOWN_HOURS * 3600);
}


async function sendTelegramMessage(
  chatId,
  text,
  sendAsImage = false,
  textForImage = ""
) {
  const tgKey = `telegram:${chatId}:${text}`.toLowerCase();

  let imageBuffer = null;
  let telegramAttempted = false;

  try {
    // Telegram is best-effort
    if (await shouldSend(tgKey)) {
      telegramAttempted = true;

      if (sendAsImage) {
        const { textToImageBuffer } = require("../functions/textToImage");
        imageBuffer = await textToImageBuffer(text);

        await bot.sendPhoto(chatId, imageBuffer, {
          caption: textForImage,
        });
      } else {
        await bot.sendMessage(chatId, text);
      }

      await markSent(tgKey);
      console.log("Telegram sent");
    } else {
      console.log("Telegram cooldown active, skipping Telegram send");
    }

    // Tweet is independent of Telegram cooldown
  } catch (err) {
    console.error("Telegram flow failed:", err);
  }
  await sendTweetSafely(text, imageBuffer);

}


async function sendTelegramPhoto(chatId, imagePath, caption = "") {
  const tgKey = `tg:photo:${chatId}:${caption || imagePath}`.toLowerCase();

  if (!(await shouldSend(tgKey))) {
    console.log(" Telegram photo cooldown active");
    return;
  }

  try {
    await bot.sendPhoto(chatId, imagePath, { caption });
    await markSent(tgKey);
    console.log(" Telegram photo sent");
  } catch (err) {
    console.error(" Telegram photo failed:", err);
  }
}

async function sendTelegramDocument(chatId, filePath, caption = "") {
  const tgKey = `tg:doc:${chatId}:${caption || filePath}`.toLowerCase();

  if (!(await shouldSend(tgKey))) {
    console.log(" Telegram doc cooldown active");
    return;
  }

  try {
    await bot.sendDocument(chatId, filePath, { caption });
    await markSent(tgKey);
    console.log(" Telegram document sent");
  } catch (err) {
    console.error(" Telegram document failed:", err);
  }
}

module.exports = {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  bot,
};
