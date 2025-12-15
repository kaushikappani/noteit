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
    const tweetText = text.slice(0, 280);

    // Text-only tweet
    if (!imageBuffer) {
      await rwClient.v2.tweet(tweetText);
      console.log("Tweet sent");
      return;
    }

    // Upload image
    const mediaId = await rwClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/png",
    });

    // Tweet with image
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
