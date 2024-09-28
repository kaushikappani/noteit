const express = require("express");
const { stockProtect } = require("../middleware/protect");
const router = express.Router();
const path = require("path");
const { symbolQuantityObject } = require("./data");
const { fetchData } = require("../middleware/Scrapper");
const fetchStockData = require("../functions/StockData");
const { getTopIndices } = require("../functions/TopIndices");

const yahooFinance = require('yahoo-finance2').default;


router.route("/summary").get(stockProtect, async (req, res) => {
    try {
        const stockSummary = await fetchStockData(symbolQuantityObject);

        res.json(stockSummary);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching stock data' });
    }
});

router.route("/index").get(stockProtect,async(req, res) => {
    let data = await getTopIndices();
    res.status(200).json(data);
})

router.route("/data/:symbol").get(stockProtect,async (req, res) => {
    const data = await fetchData(req.params.symbol);
    res.json(data);

})

router.route("/data/excel/report").get(stockProtect,(req, res) => {
    __dirname = path.resolve();
    res.sendFile(path.resolve(__dirname, "stockreports", "report.xlsx"));
})

router.route("/data/page/report").get(stockProtect,(req, res) => {
    __dirname = path.resolve();
    res.sendFile(path.resolve(__dirname, "stockreports", "table.html"));
})

router.route("/data/ai/report/:symbol").get(stockProtect, (req, res) => {
    __dirname = path.resolve();
    res.sendFile(path.resolve(__dirname, "stockreports", `${req.params.symbol}.html`));
})


router.route("/all").get(stockProtect,async (req, res) => {

    let data = "";
    try {
        console.log(data);
    } catch (err) {
        console.error(err);
    }
    res.json(data );
})

module.exports = router;
