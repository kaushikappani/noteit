const client = require('../middleware/redis');

// stockDataHelper.js
const yahooFinance = require('yahoo-finance2').default; 
const util = require("util");


async function fetchDeliveryData(symbol) {
    const redisKey = `delivery:${symbol}`;

    const getAsync = util.promisify(client.get).bind(client);
    const deliveryData = await getAsync(redisKey);
    if (deliveryData) {
        const parsedData = JSON.parse(deliveryData);

        return Object.keys(parsedData)
            .map(key => {
                const day = key.split('-')[0]; // Extract the day
                const delivery = parsedData[key].delivery;
                return `${delivery}`;
            })
            .join(', ');
    }
    return 0; // Return 0 if no data is found
}

async function fetchStockData(symbolQuantityObject) {
    let total = 0;
    let worth = 0;
    let payload = [];

    try {
        const symbols = [...Object.keys(symbolQuantityObject).map(symbol => `${symbol}.NS`), "^NSEI", "^NSEBANK"];
        const stockData = await yahooFinance.quote(symbols);

        console.log(stockData);

        // Step 1: Collect the main stock data
        stockData.forEach((r) => {
            const quantity = symbolQuantityObject[r.symbol.replace('.NS', '')] || 0;
            const currentPrice = parseFloat(r.regularMarketPrice);
            const change = parseFloat(r.regularMarketChange);
            const pChange = parseFloat(r.regularMarketChangePercent);
            const date = r.regularMarketTime;
            const pdSymbolPe = parseFloat(r.trailingPE);
            const rating = r.averageAnalystRating;

            // Pushing the basic data to payload
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
                deliveryData: null, // Placeholder for deliveryData
                currentValue: currentPrice * quantity
            });

            total += change * quantity;
            worth += currentPrice * quantity;
        });

        // Step 2: Now fetch the delivery data and update the payload
        await Promise.all(payload.map(async (item) => {
            const deliveryData = await fetchDeliveryData(item.symbol);
            item.deliveryData = deliveryData;
        }));

        // Returning the processed stock data
        return {
            payload: payload.slice(0, -2),
            total,
            worth,
            index: payload.slice(-2)
        };
    } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error; // Propagating the error for error handling
    }
}



module.exports = fetchStockData;
