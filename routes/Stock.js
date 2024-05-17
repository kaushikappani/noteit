const express = require("express");
const { stockProtect } = require("../middleware/protect");
const router = express.Router();

const { NseIndia } = require("stock-nse-india");

const symbolQuantityObject = {
    "ARVIND": 20,
    "DREAMFOLKS": 21,
    "EXIDEIND": 40,
    "FEDERALBNK": 16,
    "INDHOTEL": 17,
    "ITC": 40,
    "JIOFIN": 240,
    "KCP": 25,
    "MOTHERSON": 110,
    "NHPC": 59,
    "PARKHOTELS": 9,
    "PNB": 160,
    "POWERGRID": 20,
    "RECLTD": 62,
    "SBIN": 25,
    "SUZLON": 418,
    "TATAMOTORS": 10,
    "TATAPOWER": 85,
    "TITAGARH": 48,
    // "UJJIVAN": 20,
    "UJJIVANSFB": 506,
    "VBL": 10,
    "SHRIRAMFIN": 0,
};

const getData = async (symbol, nseIndia) => {

    const data = await nseIndia.getEquityDetails(symbol);
    return data;
}

const tradeData = async (symbol, nseIndia) => {

    const data = await nseIndia.getEquityTradeInfo(symbol);
    return data;
}

router.route("/summary").get(stockProtect, async (req, res) => {
    const nseIndia = new NseIndia();

    let total = 0;
    let payload = [];

    try {
        const symbols = Object.keys(symbolQuantityObject);

        // Fetch all equity details and trade info concurrently
        const equityDetailsPromises = symbols.map(symbol => getData(symbol, nseIndia));
        const tradeInfoPromises = symbols.map(symbol => tradeData(symbol, nseIndia));

        // Wait for all promises to resolve
        const equityDetailsResults = await Promise.all(equityDetailsPromises);
        const tradeInfoResults = await Promise.all(tradeInfoPromises);

        // Process the results
        symbols.forEach((symbol, index) => {
            const data = equityDetailsResults[index];
            const tradeInfo = tradeInfoResults[index];
            const quantity = symbolQuantityObject[symbol];

            let stockData = {
                currentPrice: data.priceInfo.lastPrice.toFixed(2),
                daypnl: (parseFloat(data.priceInfo.change) * quantity).toFixed(2),
                symbol: symbol,
                pChange: data.priceInfo.pChange.toFixed(2),
                change: data.priceInfo.change.toFixed(2),
                deliveryToTradedQuantity: tradeInfo.securityWiseDP.deliveryToTradedQuantity,
                date: data.metadata.lastUpdateTime
            }
            payload.push(stockData);
            total += parseFloat(data.priceInfo.change) * quantity;
        });
        total = total.toFixed(2);
        res.json({ payload, total });
    } catch (e) {
        console.error(`Error fetching data: ${e}`);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

module.exports = router;
