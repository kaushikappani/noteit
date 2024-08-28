const express = require("express");
const { stockProtect } = require("../middleware/protect");
const router = express.Router();
const allData = require("./data");
const path = require("path");
const { symbolQuantityObject } = require("./data");

const { NseIndia } = require("stock-nse-india");
const { fetchData, scrapGlobalIndices } = require("../middleware/Scrapper");

const yahooFinance = require('yahoo-finance2').default;



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

// router.route("/summary").get(stockProtect, async (req, res) => {
//     let total = 0;
//     let worth = 0;
//     let payload = [];

//     try {
//         const symbols = Object.keys(symbolQuantityObject);

//         // Fetch all equity details and trade info concurrently
//         const dataPromises = symbols.map(async (symbol) => {
//             try {
//                 const [equityDetails, tradeInfo] = await Promise.all([
//                     getData(symbol),
//                     tradeData(symbol)
//                 ]);

//                 return { symbol, equityDetails, tradeInfo };
//             } catch (error) {
//                 console.error(`Error fetching data for symbol ${symbol}: ${error}`);
//                 return null;
//             }
//         });

//         // Wait for all promises to resolve
//         const results = await Promise.all(dataPromises);

//         // Process the results
//         results.forEach((result) => {
//             if (result) {
//                 const { symbol, equityDetails, tradeInfo } = result;
//                 const quantity = symbolQuantityObject[symbol];

//                 const currentPrice = parseFloat(equityDetails.priceInfo.lastPrice);
//                 const change = parseFloat(equityDetails.priceInfo.change);
//                 const pChange = parseFloat(equityDetails.priceInfo.pChange);
//                 const deliveryToTradedQuantity = parseFloat(tradeInfo.securityWiseDP.deliveryToTradedQuantity);
//                 const date = equityDetails.metadata.lastUpdateTime;
//                 const pdSectorPe = parseFloat(equityDetails.metadata.pdSectorPe);
//                 const pdSymbolPe = parseFloat(equityDetails.metadata.pdSymbolPe);

//                 payload.push({
//                     currentPrice,
//                     daypnl: change * quantity,
//                     symbol,
//                     pChange,
//                     change,
//                     deliveryToTradedQuantity,
//                     date,
//                     pdSectorPe,
//                     pdSymbolPe,
//                     currentValue:currentPrice * quantity
//                 });

//                 total += change * quantity;
//                 worth += currentPrice * quantity;
//             }
//         });

//         res.json({ payload, total, worth });
//     } catch (e) {
//         console.error(`Error processing data: ${e}`);
//         res.status(500).json({ error: 'Error processing data' });
//     }
// });


router.route("/summary").get(stockProtect, async (req, res) => {
    let total = 0;
    let worth = 0;
    let payload = [];

    try {
        const symbols = Object.keys(allData.symbolQuantityObjectBO);
        try {
            const stockData = await yahooFinance.quote(symbols)
            stockData.forEach((r) => {
                const quantity = allData.symbolQuantityObjectBO[r.symbol];
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
                    symbol: r.symbol,
                    pChange,
                    change,
                    date,
                    pdSymbolPe,
                    pdSectorPe: 0,
                    deliveryToTradedQuantity: 0,
                    rating,
                    currentValue:currentPrice * quantity
                });
                total += change * quantity;
                worth += currentPrice * quantity;
         })
            
            res.json({ payload, total, worth });
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
    const nseIndia = new NseIndia();
    let data = "";
    let da = await scrapGlobalIndices();
    try {
        data = await nseIndia.getDataByEndpoint("/api/fiidiiTradeReact");
    } catch (e) {
        res.json({e});
        console.log(JSON.stringify(e));
   }
    res.json(da );
})

module.exports = router;
