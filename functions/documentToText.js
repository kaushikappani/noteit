const axios = require("axios");
const cheerio = require("cheerio");
const { PDFParse } = require('pdf-parse');


async function fetchDocumentText(url) {
  const parser = new PDFParse({ url: url });
	const result = await parser.getText();
  return result.text;
}

module.exports = { fetchDocumentText };
