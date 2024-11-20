const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const checkImportance = async (input) => {
    async function run() {
        const parts = [
            { text: "input: NHPC LIMITED has informed the Exchange about Change in Directors/ Key Managerial Personnel/ Auditor/ Compliance Officer/ Share Transfer Agent" },
            { text: "output: 0" },
            { text: "input: NHPC Limited has informed the Exchange regarding Cessation of Mrs Rashmi Sharma Rawal as Non- Executive Independent Director of the company w.e.f. November 09, 2024." },
            { text: "output: 0" },
            { text: "input: NHPC Limited has informed the Exchange regarding Cessation of Mr Amit Kansal as Non- Executive Independent Director of the company w.e.f. November 09, 2024." },
            { text: "output: 0" },
            { text: "input: Dreamfolks Services Limited has informed the Exchange about Copy of Newspaper Publication relating to extract of Un-Audited Financial Results of the Company for the quarter and half year ended on September 30, 2024 are attached herewith" },
            { text: "output: 1" },
            { text: "input: Tata Motors Limited has informed the Exchange about Copy of Newspaper Publication" },
            { text: "output: 0" },
            { text: "input: We wish to inform you that pursuant to Regulation 30 of the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015, representatives of the Company shall participate in the meeting of group of investors as per schedule given in the enclosed intimation. The above information is uploaded on website of the Company at www.varunbeverages.com" },
            { text: "output: 1" },
            { text: "input: Voting results of Postal Ballot and Scrutinizer Report" },
            { text: "output: 0" },
            { text: "input: Tata Motors Limited has informed the Exchange about Link of Recording" },
            { text: "output: 0" },
            { text: `input: ${input}` },
            { text: "output: " },
        ];

        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig,
        });
        console.log(result.response.text());
        return result.response.text();
    }

    run();
}

module.exports = checkImportance;

