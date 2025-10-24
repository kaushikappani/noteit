const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // ensure you install this: npm install node-fetch

const mailer = async (recipent, body) => {
  try {
    const response = await fetch("https://serverless-mailer-kappa.vercel.app/api/sendMail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.MAILER_API_KEY // secure API key (same as on Vercel)
      },
      body: JSON.stringify({
        recipent,
        body
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Email sent:", result.response);
    } else {
      console.error("❌ Failed to send email:", result.error || result);
    }
  } catch (error) {
    console.error("❌ Error while calling mailer API:", error);
  }
};

const readFile = (relativePath) => {
  const filePath = path.join(__dirname, relativePath);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(err);
    throw new Error("Error while reading file");
  }
};

module.exports = { mailer, readFile };
