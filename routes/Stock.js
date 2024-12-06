const express = require("express");
const { stockProtect, protect } = require("../middleware/protect");
const router = express.Router();
const path = require("path");
const { symbolQuantityObject, allData } = require("./data");
const { fetchData } = require("../middleware/Scrapper");
const fetchStockData = require("../functions/StockData");
const { getTopIndices } = require("../functions/TopIndices");
const { Portfolio } = require("../config/models");

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

router.route("/all").get(protect,async (req, res) => {
    res.json(allData);
})

router.route("/v2/portfolio/add").post(protect, async (req, res) => {
    const { comments, price, purchaseDate, quantity, symbol } = req.body;

    const portfolio = new Portfolio({
        comments, price, purchaseDate, quantity, symbol, user: req.user
    })
    portfolio.save();

    res.json({"message":"Transaction Added"})
})

router.route("/v2/portfolio").get(protect, async (req, res) => {
    try {
        const portfolios = await Portfolio.find({ user: req.user._id });

        if (!portfolios || portfolios.length === 0) {
            return res.status(404).json({ message: "No portfolio data found." });
        }

        const symbols = [...new Set(portfolios.map(p => p.symbol))];

        const stockData = await yahooFinance.quote(
            symbols.map(symbol => `${symbol}.NS`)
        );

        const groupedPortfolio = portfolios.reduce((acc, curr) => {
            const symbol = curr.symbol;

            if (!acc[symbol]) {
                const stockInfo = stockData.find(r => r.symbol === `${symbol}.NS`);
                acc[symbol] = {
                    symbol,
                    transactions: [],
                    totalQuantity: 0,
                    totalCost: 0,
                    averagePrice: 0,
                    currentPrice: stockInfo ? parseFloat(stockInfo.regularMarketPrice) : null,
                    change: stockInfo ? parseFloat(stockInfo.regularMarketChange) : null,
                    pChange: stockInfo ? parseFloat(stockInfo.regularMarketChangePercent) : null,
                    date: stockInfo ? stockInfo.regularMarketTime : null,
                    pdSymbolPe: stockInfo ? parseFloat(stockInfo.trailingPE) : null,
                    rating: stockInfo ? stockInfo.averageAnalystRating : null,
                    daypandl: 0,
                    profitAndLoss: 0,
                    netChangePercent: 0,
                };
            }

            acc[symbol].transactions.push({
                quantity: curr.quantity,
                price: curr.price,
                purchaseDate: curr.purchaseDate,
                comments: curr.comments,
                createdAt: curr.createdAt,
                updatedAt: curr.updatedAt,
                pandl: (acc[symbol].currentPrice - curr.price) * curr.quantity
            });

            acc[symbol].totalQuantity += curr.quantity;
            acc[symbol].totalCost += curr.quantity * curr.price;
            acc[symbol].daypandl += curr.quantity * (acc[symbol].change);
            acc[symbol].averagePrice = acc[symbol].totalCost / acc[symbol].totalQuantity;

            if (acc[symbol].currentPrice !== null) {
                acc[symbol].profitAndLoss = (acc[symbol].currentPrice - acc[symbol].averagePrice) * acc[symbol].totalQuantity;
                acc[symbol].netChangePercent = ((acc[symbol].currentPrice - acc[symbol].averagePrice) / acc[symbol].averagePrice) * 100;
            }

            return acc;
        }, {});

        // Calculate overall values
        const overall = {
            currentValue: 0,
            totalDayPAndL: 0,
            topGainer: null,
            topLoser: null,
        };

        Object.values(groupedPortfolio).forEach(stock => {
            if (stock.currentPrice !== null) {
                overall.currentValue += stock.currentPrice * stock.totalQuantity;
                overall.totalDayPAndL += stock.daypandl;
            }

            if (overall.topGainer === null || (stock.pChange && stock.pChange > (overall.topGainer?.pChange || -Infinity))) {
                overall.topGainer = { symbol: stock.symbol, pChange: stock.pChange };
            }

            if (overall.topLoser === null || (stock.pChange && stock.pChange < (overall.topLoser?.pChange || Infinity))) {
                overall.topLoser = { symbol: stock.symbol, pChange: stock.pChange };
            }
        });

        res.json({
            groupedPortfolio,
            overall: {
                ...overall,
                topGainer: overall.topGainer
                    ? { name: overall.topGainer.symbol, percentage: overall.topGainer.pChange }
                    : null,
                topLoser: overall.topLoser
                    ? { name: overall.topLoser.symbol, percentage: overall.topLoser.pChange }
                    : null,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

router.route("/v2/portfolio/summary").get(protect, async (req, res) => {
    try {
        const portfolios = await Portfolio.find({ user: req.user._id });

        if (!portfolios || portfolios.length === 0) {
            return res.status(404).json({ message: "No portfolio data found." });
        }

        const symbols = [...new Set(portfolios.map(p => p.symbol))];

        const stockData = await yahooFinance.quote(
            symbols.map(symbol => `${symbol}.NS`)
        );

        const currentPrices = stockData.reduce((acc, stock) => {
            acc[stock.symbol.replace(".NS", "")] = parseFloat(stock.regularMarketPrice);
            return acc;
        }, {});

        const dailySummary = [];
        const monthlySummary = [];

        portfolios.forEach(curr => {
            const date = new Date(curr.purchaseDate);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0"); // Convert to "MM"
            const day = String(date.getDate()).padStart(2, "0"); // Convert to "DD"
            const dayKey = `${year}-${month}-${day}`;
            const monthKey = `${year}-${month}`;
            const currentPrice = currentPrices[curr.symbol] || 0;

            // Calculate transaction profit and invested amount
            const transactionProfit = (currentPrice - curr.price) * curr.quantity;
            const investedAmount = curr.price * curr.quantity;

            // Daily summary
            const existingDaySummary = dailySummary.find(d => d.dayKey === dayKey);
            if (existingDaySummary) {
                existingDaySummary.transactions.push({
                    symbol: curr.symbol,
                    quantity: curr.quantity,
                    price: curr.price,
                    purchaseDate: curr.purchaseDate,
                    comments: curr.comments,
                    createdAt: curr.createdAt,
                    updatedAt: curr.updatedAt,
                    investedAmount: investedAmount,
                    profit: transactionProfit,
                });
                existingDaySummary.totalInvested += investedAmount;
                existingDaySummary.totalProfit += transactionProfit;
            } else {
                dailySummary.push({
                    dayKey,
                    transactions: [{
                        symbol: curr.symbol,
                        quantity: curr.quantity,
                        price: curr.price,
                        purchaseDate: curr.purchaseDate,
                        comments: curr.comments,
                        createdAt: curr.createdAt,
                        updatedAt: curr.updatedAt,
                        investedAmount: investedAmount,
                        profit: transactionProfit,
                    }],
                    totalInvested: investedAmount,
                    totalProfit: transactionProfit,
                });
            }

            // Monthly summary
            const existingMonthSummary = monthlySummary.find(m => m.monthKey === monthKey);
            if (existingMonthSummary) {
                existingMonthSummary.transactions.push({
                    symbol: curr.symbol,
                    quantity: curr.quantity,
                    price: curr.price,
                    purchaseDate: curr.purchaseDate,
                    comments: curr.comments,
                    createdAt: curr.createdAt,
                    updatedAt: curr.updatedAt,
                    investedAmount: investedAmount,
                    profit: transactionProfit,
                });
                existingMonthSummary.totalInvested += investedAmount;
                existingMonthSummary.totalProfit += transactionProfit;
            } else {
                monthlySummary.push({
                    monthKey,
                    transactions: [{
                        symbol: curr.symbol,
                        quantity: curr.quantity,
                        price: curr.price,
                        purchaseDate: curr.purchaseDate,
                        comments: curr.comments,
                        createdAt: curr.createdAt,
                        updatedAt: curr.updatedAt,
                        investedAmount: investedAmount,
                        profit: transactionProfit,
                    }],
                    totalInvested: investedAmount,
                    totalProfit: transactionProfit,
                });
            }
        });

        res.json({
            dailySummary,
            monthlySummary,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});







module.exports = router;
