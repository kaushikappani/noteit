// services/xService.js
import { TwitterApi } from "twitter-api-v2";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = xClient.readWrite;

/* =======================
   HASHTAGS CONFIG
   ======================= */

const FIXED_HASHTAGS = [
  "#StockMarket",
  "#Investing"
];

/**
 * Send tweet (text or image)
 */
export async function sendTweet(text, imageBuffer = null) {
  try {
    console.log("Sending tweet:", text.substring(0, 50));

    const tweetText = formatTweetText(text, !!imageBuffer);

    if (!imageBuffer) {
      await rwClient.v2.tweet(tweetText);
      console.log("Tweet sent");
      return;
    }

    const mediaId = await rwClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/png",
    });

    await rwClient.v2.tweet({
      text: tweetText,
      media: {
        media_ids: [mediaId],
      },
    });

    console.log("Tweet with image sent");
  } catch (err) {
    console.error("X tweet error:", err);
  }
}

/**
 * Format tweet safely
 */
function formatTweetText(text, hasImage, limit = 280) {
  const suffix = hasImage ? " (full text in image)" : "";

  const autoTags = extractHashtags(text, 1); // keep minimal
  const hashtags = [...FIXED_HASHTAGS, ...autoTags].join(" ");

  const reserved =
    suffix.length +
    (hashtags ? hashtags.length + 1 : 0) +
    3; // "..."

  // Fits completely
  if (text.length + suffix.length + (hashtags ? hashtags.length + 1 : 0) <= limit) {
    return [text + suffix, hashtags].filter(Boolean).join(" ");
  }

  const allowedLength = limit - reserved;

  let trimmed = text.slice(0, allowedLength);
  trimmed = trimmed.replace(/\s+\S*$/, "");

  return `${trimmed}...${suffix}${hashtags ? " " + hashtags : ""}`;
}

/**
 * Auto-generate hashtags from text (SAFE)
 */
function extractHashtags(text, maxWords = 1) {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "of", "to", "for", "in", "on", "with", "and"
  ]);

  const words = text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));

  return words
    .slice(0, maxWords)
    .map(w => "#" + w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
