const cheerio = require('cheerio');
const axios = require("axios");
var fs = require('fs');

const fetchHtml = async (url) => {
    console.log(url);
    const response = await axios.get(url);
    return response.data;
};


const fetchData = async (symbol) => {
    console.log(symbol);
    try {
   
        let url = `https://www.screener.in/company/${symbol}/consolidated/`;
        let html = await fetchHtml(url);
        // fs.writeFile('stockreports/'+symbol+".html", html, function (err) {
        //     if (err) throw err;
        //     console.log('Saved!');
        // });
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

        // console.log("shareHoldingPattern",shareHoldingPattern)
        // console.log("results",results);
        // console.log("pandl",pandl);

        // console.log("Pros: ", pros);
        // console.log("Cons: ", cons)

        // console.log("name", name)
        // console.log("currentPrice", currentPrice)
        // console.log("priceChange", priceChange)
        // console.log("stockPEValue", stockPEValue)



    } catch (e) {
        console.log(e);
    }
}

module.exports = { fetchData };