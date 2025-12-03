const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const client = require("../middleware/redis");
const util = require("util");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const REDIS_TTL_HOURS = process.env.DOCUMENT_SUMMARY_CACHE_HOURS || 12;

// Convert get/set to async
const redisGet = util.promisify(client.get).bind(client);
const redisSet = util.promisify(client.set).bind(client);

/**
 *  Cache key = docSummary:<url>
 */
const makeCacheKey = (url) => `docSummary:${url}`.toLowerCase();

/**
 *  Summarize corporate document URL
 * - Cache result
 * - Return cached if exists
 */
async function analyzeCorporateDocument(url) {
  try {
    const cacheKey = makeCacheKey(url);

    // 1️ Check cache
    const cachedSummary = await redisGet(cacheKey);
    if (cachedSummary) {
      console.log("📦 Using cached summary for:", url);
      return cachedSummary;
    }

    // 2️ Ask Gemini
    const prompt = `
You are a professional financial analyst.
Read the following corporate filing and provide:

1. A 4–5 bullet point summary in clear investor-friendly language.
2. ONE overall sentiment indicator (Positive 🟢 / Negative 🔴 / Neutral 🟡)
based strictly on the contents.

Rules:
- No disclaimers
- Can give buy sell recommendations based on the content

Reference:
${url}
`;

    const generationConfig = {
      temperature: 0.6,
      topP: 0.95,
      topK: 32,
      maxOutputTokens: 800,
      responseMimeType: "text/plain",
    };


    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      generationConfig,
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ]
    }); const summary = result.response.text().trim();

    // 3️ Cache it
    await redisSet(cacheKey, summary, "EX", REDIS_TTL_HOURS * 3600);

    return summary;

  } catch (error) {
    console.error(" analysis error ", error?.message || error);
    return "⚪ Could not analyze document.";
  }
}

module.exports = { analyzeCorporateDocument };
