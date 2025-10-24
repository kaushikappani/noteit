const fs = require("fs");
const path = require("path");
const axios = require("axios"); // ensure: npm install axios

const mailer = async (recipent, body) => {
  try {
    const response = await axios.post(
      "https://serverless-mailer-kappa.vercel.app/api/sendMail",
      {
        recipent,
        body,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.MAILER_API_KEY, // must match your Vercel .env API_KEY
        },
        timeout: 15000, // optional 15s timeout
      }
    );

    console.log("✅ Email sent:", response.data.response || response.data);
  } catch (error) {
    if (error.response) {
      console.error("❌ Mail API error:", error.response.status, error.response.data);
    } else if (error.request) {
      console.error("⚠️ No response from mailer API:", error.message);
    } else {
      console.error("❌ Error creating mail request:", error.message);
    }
  }
};

const readFile = (relativePath) => {
  const filePath = path.join(__dirname, relativePath);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error("❌ Error while reading file:", err);
    throw new Error("Error while reading file");
  }
};

module.exports = { mailer, readFile };
