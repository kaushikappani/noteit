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

// Main + fallback models
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

// Simple delay to avoid hammering immediately after fallback trigger
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 *  Cache key = docSummary:<url>
 */
const makeCacheKey = (url) => `docSummary:${url}`.toLowerCase();

/**
 * Try generating using the given model
 */
async function generateSummaryUsingModel(modelName, prompt, generationConfig) {
  const model = genAI.getGenerativeModel({ model: modelName });

  return await model.generateContent({
    generationConfig,
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
}

/**
 *  Summarize corporate document URL
 * - Cache result
 * - Return cached if exists
 * - Auto-switch to fallback model when rate limit exceeded
 */
async function analyzeCorporateDocument(url) {
  try {
    const cacheKey = makeCacheKey(url);

    // 1) Check cache
    const cachedSummary = await redisGet(cacheKey);
    if (cachedSummary) {
      console.log(" Using cached summary for:", url);
      return cachedSummary;
    }

    // 2) Build prompt
    const prompt = `
You are a professional financial analyst.
Read the following corporate filing and provide:

1. A 4-5 bullet point summary in clear investor-friendly language.
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

    let summary;

    // 3) Try PRIMARY_MODEL first
    try {
      console.log(` Using primary model: ${PRIMARY_MODEL}`);
      const result = await generateSummaryUsingModel(PRIMARY_MODEL, prompt, generationConfig);
      summary = result.response.text().trim();
    } catch (err) {
      const errMsg = err?.message || "";

      // Check rate limit errors
      const isRateLimited =
        errMsg.includes("exceeded") ||
        errMsg.includes("Rate limit") ||
        errMsg.includes("quota") ||
        errMsg.includes("429");

      if (isRateLimited) {
        console.log(" Primary model rate-limited. Switching to fallback model...");

        // Short delay before retry
        await sleep(800);

        const result = await generateSummaryUsingModel(FALLBACK_MODEL, prompt, generationConfig);
        summary = result.response.text().trim();

        console.log(` Fallback model used: ${FALLBACK_MODEL}`);
      } else {
        throw err; // Other errors → bubble up
      }
    }

    // 4) Cache result for next time
    await redisSet(cacheKey, summary, "EX", REDIS_TTL_HOURS * 3600);

    return summary;

  } catch (error) {
    console.error(" analysis error", error?.message || error);
    return "⚪ Could not analyze document.";
  }
}

module.exports = { analyzeCorporateDocument };
