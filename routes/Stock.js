const express = require("express");
const { stockProtect } = require("../middleware/protect");
const router = express.Router();
const allData = require("./data");

const { NseIndia } = require("stock-nse-india");

const symbolQuantityObject = {
    "ARVIND": 20,
    "DREAMFOLKS": 21,
    "EXIDEIND": 40,
    "FEDERALBNK": 41,
    "INDHOTEL": 17,
    "ITC": 40,
    "JIOFIN": 250,
    "KCP": 25,
    "MOTHERSON": 115,
    "NHPC": 59,
    "PARKHOTELS": 21,
    "PNB": 160,
    "POWERGRID": 20,
    "RECLTD": 65,
    "SBIN": 34,
    "SUZLON": 421,
    "TATAMOTORS": 10,
    "TATAPOWER": 100,
    "TITAGARH": 48,
    "UJJIVANSFB": 285,
    "VBL": 10,
    "SHRIRAMFIN": 0,
    "BEL": 10,
    "BHEL": 20,
    "KOTAKBANK": 10,
    "HDFCBANK":10
};

const getData = async (symbol) => {
    const nseIndia = new NseIndia();
    const data = await nseIndia.getEquityDetails(symbol);
    return data;
}

const tradeData = async (symbol) => {
    const nseIndia = new NseIndia();
    const data = await nseIndia.getEquityTradeInfo(symbol);
    return data;
}

router.route("/summary").get(stockProtect, async (req, res) => {
    let total = 0;
    let worth = 0;
    let payload = [];

    try {
        const symbols = Object.keys(symbolQuantityObject);

        // Fetch all equity details and trade info concurrently
        const dataPromises = symbols.map(async (symbol) => {
            try {
                const [equityDetails, tradeInfo] = await Promise.all([
                    getData(symbol),
                    tradeData(symbol)
                ]);

                return { symbol, equityDetails, tradeInfo };
            } catch (error) {
                console.error(`Error fetching data for symbol ${symbol}: ${error}`);
                return null;
            }
        });

        // Wait for all promises to resolve
        const results = await Promise.all(dataPromises);

        // Process the results
        results.forEach((result) => {
            if (result) {
                const { symbol, equityDetails, tradeInfo } = result;
                const quantity = symbolQuantityObject[symbol];

                const currentPrice = parseFloat(equityDetails.priceInfo.lastPrice);
                const change = parseFloat(equityDetails.priceInfo.change);
                const pChange = parseFloat(equityDetails.priceInfo.pChange);
                const deliveryToTradedQuantity = parseFloat(tradeInfo.securityWiseDP.deliveryToTradedQuantity);
                const date = equityDetails.metadata.lastUpdateTime;
                const pdSectorPe = parseFloat(equityDetails.metadata.pdSectorPe);
                const pdSymbolPe = parseFloat(equityDetails.metadata.pdSymbolPe);

                payload.push({
                    currentPrice,
                    daypnl: change * quantity,
                    symbol,
                    pChange,
                    change,
                    deliveryToTradedQuantity,
                    date,
                    pdSectorPe,
                    pdSymbolPe,
                    currentValue:currentPrice * quantity
                });

                total += change * quantity;
                worth += currentPrice * quantity;
            }
        });

        res.json({ payload, total, worth });
    } catch (e) {
        console.error(`Error processing data: ${e}`);
        res.status(500).json({ error: 'Error processing data' });
    }
});



router.route("/all").get(stockProtect,async (req, res) => {
    const nseIndia = new NseIndia();
    let data = "";
    try {
        data = await nseIndia.getDataByEndpoint("/api/fiidiiTradeReact");
    } catch (e) {
        res.json({e});
        console.log(JSON.stringify(e));
   }
    res.json(data );
})

module.exports = router;
