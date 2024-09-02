const express = require("express");
const { stockProtect } = require("../middleware/protect");
const router = express.Router();
const allData = require("./data");
const path = require("path");
const { symbolQuantityObject } = require("./data");
const { fetchData, scrapGlobalIndices } = require("../middleware/Scrapper");

const yahooFinance = require('yahoo-finance2').default;


router.route("/summary").get(stockProtect, async (req, res) => {
    let total = 0;
    let worth = 0;
    let payload = [];

    try {
        const symbols = [...Object.keys(symbolQuantityObject).map(symbol => `${symbol}.NS`), "^NSEI", "^NSEBANK"];
        try {
            const stockData = await yahooFinance.quote(symbols);
            stockData.forEach((r) => {
                const quantity = symbolQuantityObject[r.symbol.replace('.NS', '')] || 0;
                const currentPrice = parseFloat(r.regularMarketPrice);
                const change = parseFloat(r.regularMarketChange);
                const pChange = parseFloat(r.regularMarketChangePercent);
                // const deliveryToTradedQuantity = parseFloat(tradeInfo.securityWiseDP.deliveryToTradedQuantity);
                const date = r.regularMarketTime;
                // const pdSectorPe = parseFloat(r.trailingPE);
                const pdSymbolPe = parseFloat(r.trailingPE);
                const rating = r.averageAnalystRating;
                payload.push({
                    currentPrice,
                    daypnl: change * quantity,
                    symbol: r.symbol.replace('.NS', ''),
                    pChange,
                    change,
                    date,
                    pdSymbolPe,
                    pdSectorPe: 0,
                    deliveryToTradedQuantity: 0,
                    rating,
                    quantity,
                    currentValue:currentPrice * quantity
                });
                total += change * quantity;
                worth += currentPrice * quantity;
         })
            
            res.json({ payload: payload.slice(0,-2), total, worth,index : payload.slice(-2) });
        } catch (error) {
            console.error('Error fetching stock data:', error);
        }

    } catch (e) {
        console.error(`Error processing data: ${e}`);
        res.status(500).json({ error: 'Error processing data' });
    }
});

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
