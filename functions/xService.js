// services/xService.js
import { TwitterApi } from "twitter-api-v2";

/**
 * X (Twitter) client configuration
 * Keep credentials in env variables
 */
const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = xClient.readWrite;

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



function formatTweetText(text, hasImage, limit = 280) {
  const suffix = hasImage ? " (full text in image)" : "";
  const hashtags = extractHashtags(text, 3).join(" ");

  const reserved =
    suffix.length +
    (hashtags ? hashtags.length + 1 : 0) + // space before hashtags
    3; // "..."

  // If everything fits
  if (text.length + suffix.length + (hashtags ? hashtags.length + 1 : 0) <= limit) {
    return [text + suffix, hashtags].filter(Boolean).join(" ");
  }

  const allowedLength = limit - reserved;

  let trimmed = text.slice(0, allowedLength);
  trimmed = trimmed.replace(/\s+\S*$/, ""); // avoid breaking words

  return `${trimmed}...${suffix}${hashtags ? " " + hashtags : ""}`;
}


function extractHashtags(text, maxWords = 3) {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "of", "to", "for", "in", "on", "with", "and"
  ]);

  const words = text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

  const selected = words.slice(0, maxWords);

  return selected.map(
    w => "#" + w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}
