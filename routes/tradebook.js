const express = require("express");
const { protect } = require("../middleware/protect");
const { TradeBook } = require("../config/models");
const multer = require("multer");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

router.post("/upload", protect, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload a file" });
  }

  try {
    // Send immediate response
    res.status(202).json({ message: "File uploaded successfully. Processing in the background." });

    // Process asynchronously
    (async () => {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.csv.readFile(req.file.path);

        const worksheet = workbook.worksheets[0];
        const rows = [];
        
        // Skip header row
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            // Values in ExcelJS are 1-indexed array-like objects
            const rowValues = row.values;
            // Depending on parsing, values might start at index 1
            rows.push({
              user: req.user._id,
              symbol: rowValues[1],
              isin: rowValues[2],
              trade_date: new Date(rowValues[3]),
              exchange: rowValues[4],
              segment: rowValues[5],
              series: rowValues[6],
              trade_type: rowValues[7],
              auction: rowValues[8] === "true" || rowValues[8] === true,
              quantity: parseFloat(rowValues[9]),
              price: parseFloat(rowValues[10]),
              trade_id: rowValues[11] ? rowValues[11].toString() : null,
              order_id: rowValues[12] ? rowValues[12].toString() : null,
              order_execution_time: rowValues[13] ? new Date(rowValues[13]) : null,
            });
          }
        });

        let inserted = 0;
        let duplicates = 0;

        for (const rowData of rows) {
          if (!rowData.trade_id || !rowData.order_id) continue;
          try {
            const trade = new TradeBook(rowData);
            await trade.save();
            inserted++;
          } catch (err) {
            if (err.code === 11000) {
              // Duplicate key error
              duplicates++;
            } else {
              console.error("Error saving trade:", err);
            }
          }
        }

        // Delete the file after processing
        fs.unlinkSync(req.file.path);
        console.log(`Upload complete. Inserted: ${inserted}, Duplicates: ${duplicates}`);
      } catch (error) {
        console.error("Error processing upload in background:", error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
      }
    })();

  } catch (error) {
    console.error("Error accepting upload:", error);
    res.status(500).json({ message: "Error initiating file processing" });
  }
});

router.get("/analysis", protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { user: req.user._id };
    if (startDate || endDate) {
      query.trade_date = {};
      if (startDate) query.trade_date.$gte = new Date(startDate);
      if (endDate) query.trade_date.$lte = new Date(endDate);
    }

    const trades = await TradeBook.find(query);

    const stockWise = {};
    const monthly = {};
    const yearly = {};
    const daily = {};

    trades.forEach(trade => {
      // 1. Stock wise
      if (!stockWise[trade.symbol]) {
        stockWise[trade.symbol] = {
          symbol: trade.symbol,
          buyQty: 0,
          buyTotal: 0,
          sellQty: 0,
          sellTotal: 0
        };
      }
      
      const isBuy = trade.trade_type.toLowerCase() === 'buy';
      if (isBuy) {
        stockWise[trade.symbol].buyQty += trade.quantity;
        stockWise[trade.symbol].buyTotal += (trade.quantity * trade.price);
      } else {
        stockWise[trade.symbol].sellQty += trade.quantity;
        stockWise[trade.symbol].sellTotal += (trade.quantity * trade.price);
      }

      // Date keys
      const date = new Date(trade.trade_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      
      const yearKey = `${year}`;
      const monthKey = `${year}-${month}`;
      const dayKey = `${year}-${month}-${day}`;

      // 2. Yearly
      if (!yearly[yearKey]) yearly[yearKey] = { year: yearKey, buyAmount: 0, sellAmount: 0, stocks: {} };
      if (!yearly[yearKey].stocks[trade.symbol]) yearly[yearKey].stocks[trade.symbol] = { buyQty: 0, sellQty: 0, buyTotal: 0, sellTotal: 0 };
      
      if (isBuy) {
        yearly[yearKey].buyAmount += (trade.quantity * trade.price);
        yearly[yearKey].stocks[trade.symbol].buyQty += trade.quantity;
        yearly[yearKey].stocks[trade.symbol].buyTotal += (trade.quantity * trade.price);
      } else {
        yearly[yearKey].sellAmount += (trade.quantity * trade.price);
        yearly[yearKey].stocks[trade.symbol].sellQty += trade.quantity;
        yearly[yearKey].stocks[trade.symbol].sellTotal += (trade.quantity * trade.price);
      }

      // 3. Monthly
      if (!monthly[monthKey]) monthly[monthKey] = { month: monthKey, buyAmount: 0, sellAmount: 0, stocks: {} };
      if (!monthly[monthKey].stocks[trade.symbol]) monthly[monthKey].stocks[trade.symbol] = { buyQty: 0, sellQty: 0, buyTotal: 0, sellTotal: 0 };
      
      if (isBuy) {
        monthly[monthKey].buyAmount += (trade.quantity * trade.price);
        monthly[monthKey].stocks[trade.symbol].buyQty += trade.quantity;
        monthly[monthKey].stocks[trade.symbol].buyTotal += (trade.quantity * trade.price);
      } else {
        monthly[monthKey].sellAmount += (trade.quantity * trade.price);
        monthly[monthKey].stocks[trade.symbol].sellQty += trade.quantity;
        monthly[monthKey].stocks[trade.symbol].sellTotal += (trade.quantity * trade.price);
      }

      // 4. Daily
      if (!daily[dayKey]) daily[dayKey] = { day: dayKey, buyAmount: 0, sellAmount: 0, stocks: {} };
      if (!daily[dayKey].stocks[trade.symbol]) daily[dayKey].stocks[trade.symbol] = { buyQty: 0, sellQty: 0, buyTotal: 0, sellTotal: 0 };
      
      if (isBuy) {
        daily[dayKey].buyAmount += (trade.quantity * trade.price);
        daily[dayKey].stocks[trade.symbol].buyQty += trade.quantity;
        daily[dayKey].stocks[trade.symbol].buyTotal += (trade.quantity * trade.price);
      } else {
        daily[dayKey].sellAmount += (trade.quantity * trade.price);
        daily[dayKey].stocks[trade.symbol].sellQty += trade.quantity;
        daily[dayKey].stocks[trade.symbol].sellTotal += (trade.quantity * trade.price);
      }
    });

    // Calculate averages for stockWise
    const stockWiseArr = Object.values(stockWise).map(sw => ({
      ...sw,
      averageBuyPrice: sw.buyQty > 0 ? sw.buyTotal / sw.buyQty : 0,
      averageSellPrice: sw.sellQty > 0 ? sw.sellTotal / sw.sellQty : 0,
    }));

    const calculateStockAverages = (periodObj) => {
      Object.keys(periodObj.stocks).forEach(sym => {
        const s = periodObj.stocks[sym];
        s.averageBuyPrice = s.buyQty > 0 ? s.buyTotal / s.buyQty : 0;
        s.averageSellPrice = s.sellQty > 0 ? s.sellTotal / s.sellQty : 0;
      });
      return periodObj;
    };

    // Convert others to arrays for easier mapping on frontend
    const yearlyArr = Object.values(yearly).map(calculateStockAverages).sort((a,b) => b.year.localeCompare(a.year));
    const monthlyArr = Object.values(monthly).map(calculateStockAverages).sort((a,b) => b.month.localeCompare(a.month));
    const dailyArr = Object.values(daily).map(calculateStockAverages).sort((a,b) => b.day.localeCompare(a.day));

    res.status(200).json({
      stockWise: stockWiseArr,
      yearly: yearlyArr,
      monthly: monthlyArr,
      daily: dailyArr,
      allTrades: trades
    });

  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
