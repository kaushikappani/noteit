// stockDataHelper.js
const yahooFinance = require('yahoo-finance2').default;  // Assuming you're using yahoo-finance2

// Assuming `symbolQuantityObject` is globally available or passed to the function
async function fetchStockData(symbolQuantityObject) {
    let total = 0;
    let worth = 0;
    let payload = [];

    try {
        const symbols = [...Object.keys(symbolQuantityObject).map(symbol => `${symbol}.NS`), "^NSEI", "^NSEBANK"];
        const stockData = await yahooFinance.quote(symbols);

        stockData.forEach((r) => {
            const quantity = symbolQuantityObject[r.symbol.replace('.NS', '')] || 0;
            const currentPrice = parseFloat(r.regularMarketPrice);
            const change = parseFloat(r.regularMarketChange);
            const pChange = parseFloat(r.regularMarketChangePercent);
            const date = r.regularMarketTime;
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
                currentValue: currentPrice * quantity
            });

            total += change * quantity;
            worth += currentPrice * quantity;
        });

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
