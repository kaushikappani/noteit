const { TwitterApi } = require("twitter-api-v2");
const util = require("util");
const client = require("../middleware/redis");

const redisGet = util.promisify(client.get).bind(client);
const redisSet = util.promisify(client.set).bind(client);

const COOLDOWN_HOURS = 49;


const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = xClient.readWrite;


const FIXED_HASHTAGS = ["#StockMarket", "#Investing"];


async function shouldSend(redisKey) {
  const exists = await redisGet(redisKey);
  return !exists;
}

async function markSent(redisKey) {
  await redisSet(redisKey, "sent", "EX", COOLDOWN_HOURS * 3600);
}



async function sendTweetSafely(text, imageBuffer = null) {
  const xKey = `tweet:${text}`.toLowerCase();

  if (!(await shouldSend(xKey))) {
    console.log("X cooldown active");
    return;
  }

  try {
  await sendTweet(text, imageBuffer);
   await markSent(xKey);
    console.log("X tweet sent & cached");
  } catch (err) {
    console.error("X tweet failed:", err);
  }
}


async function sendTweet(text, imageBuffer = null) {
  console.log("Sending tweet:", text.substring(0, 50));

  const tweetText = formatTweetText(text, !!imageBuffer);

  if (!imageBuffer) {
    await rwClient.v2.tweet(tweetText);
    return;
  }

  const mediaId = await rwClient.v1.uploadMedia(imageBuffer, {
    mimeType: "image/png",
  });

  await rwClient.v2.tweet({
    text: tweetText,
    media: { media_ids: [mediaId] },
  });
}

function formatTweetText(text, hasImage, limit = 280) {
  const suffix = hasImage ? " (full text in image)" : "";
  const autoTags = extractHashtags(text, 1);
  const hashtags = [...FIXED_HASHTAGS, ...autoTags].join(" ");

  const reserved =
    suffix.length + (hashtags ? hashtags.length + 1 : 0) + 3;

  if (text.length + suffix.length + (hashtags ? hashtags.length + 1 : 0) <= limit) {
    return [text + suffix, hashtags].filter(Boolean).join(" ");
  }

  const allowedLength = limit - reserved;
  let trimmed = text.slice(0, allowedLength).replace(/\s+\S*$/, "");

  return `${trimmed}...${suffix}${hashtags ? " " + hashtags : ""}`;
}


function extractHashtags(text, maxWords = 1) {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "of", "to", "for", "in", "on", "with", "and",
  ]);

  return text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()))
    .slice(0, maxWords)
    .map(w => "#" + w[0].toUpperCase() + w.slice(1).toLowerCase());
}

module.exports = {
  sendTweetSafely,
};
