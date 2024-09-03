const cheerio = require('cheerio');
const axios = require("axios");
var fs = require('fs');

const fetchHtml = async (url) => {
   
    const response = await axios.get(url);
    return response.data;
};


const fetchData = async (symbol) => {
    
    try {
   
        let url = `https://www.screener.in/company/${symbol}/consolidated/`;
        let html = await fetchHtml(url);

        const $ = cheerio.load(html);

        const topBar = $("#top");
        const name = topBar.find("h1.show-from-tablet-landscape").text().trim();
        const currentPrice = topBar.find("div.flex.flex-align-center span").first().text().trim();
        const priceChange = topBar.find("div.flex.flex-align-center span").eq(1).text().trim();
        const stockPEValue = topBar.find("li:contains('Stock P/E')").find(".number").text();

        const prosSection = $("#analysis .pros ul li");
        const consSection = $("#analysis .cons ul li");
        const pros = prosSection.map(function () {
            return $(this).text();
        }).get();

        const cons = consSection.map(function () {
            return $(this).text();
        }).get();

        const resultsTable = $("#quarters table.data-table");

        const results = {
            headers: [],
            data: []
        };

        resultsTable.find("thead th").each(function () {
            const headerText = $(this).text().trim();
            if (headerText) {
                results.headers.push(headerText);
            }
        });

        resultsTable.find("tbody tr").each(function () {
            const row = [];
            $(this).find("td").each(function () {
                row.push($(this).text().trim());
            });
            results.data.push(row);
        });

        const pandlTable = $("#profit-loss table.data-table");

        const pandl = {
            headers: [],
            data: []
        };

        pandlTable.find("thead th").each(function () {
            const headerText = $(this).text().trim();
            if (headerText) {
                pandl.headers.push(headerText);
            }
        });

        pandlTable.find("tbody tr").each(function () {
            const row = [];
            $(this).find("td").each(function () {
                row.push($(this).text().trim());
            });
            pandl.data.push(row);
        });


        const shareholdingTable = $("#quarterly-shp table.data-table");

        const shareHoldingPattern = {
            headers: [],
            data: []
        };

        shareholdingTable.find("thead th").each(function () {
            const headerText = $(this).text().trim();
            if (headerText) {
                shareHoldingPattern.headers.push(headerText);
            }
        });

        shareholdingTable.find("tbody tr").each(function () {
            const row = [];
            $(this).find("td").each(function () {
                row.push($(this).text().trim());
            });
            shareHoldingPattern.data.push(row);
        });


        return {
            name, currentPrice, priceChange, stockPEValue, cons, pros, resultsQuarterly: results, resultsYearly: pandl, shareHoldingPattern
        }

    } catch (e) {
        console.log(`error in scraping ${symbol}`);
    }
}


const scrapGlobalIndices = async() => {
    try {
        let url = `https://www.5paisa.com/share-market-today/global-indices`;
        let html = await fetchHtml(url);

        const $ = cheerio.load(html);

        let indicesData = [];

        $('table tbody tr').each((index, element) => {
            const indicesName = $(element).find('td a').eq(0).text().trim();
            const lastUpdated = $(element).find('td span').eq(0).text().trim();
            const price = $(element).find('td').eq(1).text().trim();
            const priceChange = $(element).find('td').eq(2).text().trim();
            indicesData.push({
                indicesName,
                price,
                priceChange,
                lastUpdated
            });
        });
        return indicesData;
    } catch (e) {
        throw new Error("Failed to fetch Gift Nifty data in scrapper");
        console.log(e);
   }
}

module.exports = { fetchData, scrapGlobalIndices };