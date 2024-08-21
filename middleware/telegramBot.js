const TelegramBot = require('node-telegram-bot-api');
const { giftNifty } = require('./StockScheduler');
const { scrapGlobalIndices } = require('./Scrapper');
const { symbolQuantityObject } = require('../routes/data');
const { NseIndia } = require('stock-nse-india');
const fs = require('fs');
const Jimp = require('jimp');
const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

    // bot.onText(/^\/global/, async(msg) => {
    //     const chatId = msg.chat.id;
    //     console.log(typeof chatId);
    //     if (chatId === 1375808164) {
    //         const data = await scrapGlobalIndices();
    //         const html = data.map(item => {
    //             const isPositive = !item.priceChange.startsWith("-");
    //             const emoji = isPositive ? "🟢" : "🔴";
    //             return `
    //         <b>${item.indicesName}</b> ${emoji}
    //         Price: ${item.price}
    //         Price Change: ${item.priceChange}
    //         Last Updated: ${item.lastUpdated}`;
    //         }).join('\n\n');

    //         bot.sendMessage(chatId, html, { parse_mode: "HTML" });

    //         const giftn = await giftNifty();

    //         const giftNiftyPrice = giftn.giftNifty.currentPrice;
    //         const giftNiftyDayChange = giftn.giftNifty.dayChange;
    //         const giftNiftyDayChangeP = giftn.giftNifty.dayChangeP;

    //         const nifty50Price = giftn.dataNifty.last;
    //         const nifty50DayChange = giftn.dataNifty.variation;
    //         const nifty50DayChangeP = giftn.dataNifty.percentChange;

    //         // Format the message content
    //         const emoji = giftNiftyPrice - nifty50Price > 0 ? "🟢" : "🔴";
    //         const messageContent = `
    //         <b>Gift Nifty</b> ${emoji}
    //         Price: ${giftNiftyPrice}
    //         Change: ${giftNiftyDayChange} (${giftNiftyDayChangeP}%)

    //         <b>Nifty 50</b>
    //         Price: ${nifty50Price}
    //         Change: ${nifty50DayChange} (${nifty50DayChangeP}%)`;

    //         // Send the message via Telegram bot
    //         bot.sendMessage(chatId, messageContent, { parse_mode: "HTML" });
    //     }

    // });

    const getData = async (symbol) => {
        const nseIndia = new NseIndia();
        const data = await nseIndia.getEquityDetails(symbol);
        return data;
    }


bot.onText(/^\/global/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId === 1375808164) {  // Change to your chat ID if needed
        const data = await scrapGlobalIndices();

        const imageWidth = 1500;
        const imageHeight = 800;

        try {
            // Create a new image with white background
            const image = await Jimp.create(imageWidth, imageHeight, '#ffffff');
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
 
            // Add header
            image.print(font, 50, 20, 'Global Indices')
                .print(font, 50, 100, 'Index')
                .print(font, 400, 100, 'Price')
                .print(font, 650, 100, 'Change')
                .print(font, 950, 100, 'Last Updated');

            // Add data rows
            data.forEach(async(item, index) => {
                const y = 150 + index * 50;
                const isPositive = !item.priceChange.startsWith('-');
                const emoji = isPositive ? "🟢" : "🔴";

                image.print(font, 50, y, item.indicesName)
                    .print(font, 400, y, item.price)
                    .print(font, 650, y, item.priceChange)
                    .print(font, 950, y, item.lastUpdated);
            });

            // Save the image to a file
            const imagePath = './global-indices.png';
            await image.writeAsync(imagePath);

            // Send the image via Telegram bot
            await bot.sendPhoto(chatId, imagePath, { caption: 'Here are the latest global indices.' });

            // Clean up the image file if necessary
            fs.unlinkSync(imagePath);
            const giftn = await giftNifty();
            const giftNiftyPrice = giftn.giftNifty.currentPrice;
            const giftNiftyDayChange = giftn.giftNifty.dayChange;
            const giftNiftyDayChangeP = giftn.giftNifty.dayChangeP;

            const nifty50Price = giftn.dataNifty.last;
            const nifty50DayChange = giftn.dataNifty.variation;
            const nifty50DayChangeP = giftn.dataNifty.percentChange;

            const image2 = await Jimp.create(imageWidth, imageHeight, '#ffffff');
            function printCell(image2, text, x, y, width) {
                // Draw a rectangle for the cell
                image2.scan(x, y, width, 30, function (x, y, idx) {
                    this.setPixelColor(Jimp.rgbaToInt(220, 220, 220, 255), x, y);
                });
                // Print the text centered in the cell
                const textWidth = Jimp.measureText(font, text);
                image2.print(font, x + (width - textWidth) / 2, y + 5, text);
            }

            // Add table headers
            const headers = ["Item", "Price", "Day Change", "Day Change %"];
            const headerWidth = imageWidth / headers.length;
            headers.forEach((header, index) => {
                printCell(image2, header, index * headerWidth, 0, headerWidth);
            });

            // Add table rows
            const rows = [
                ["Gift Nifty", giftNiftyPrice, giftNiftyDayChange, giftNiftyDayChangeP],
                ["Nifty 50", nifty50Price, nifty50DayChange, nifty50DayChangeP]
            ];

            rows.forEach((row, rowIndex) => {
                row.forEach((cell, cellIndex) => {
                    printCell(image2, cell, cellIndex * headerWidth, 50 + rowIndex * 30, headerWidth);
                });
            });
            
            await image2.writeAsync("./gift-nifty.png");
            await bot.sendPhoto(chatId, "./gift-nifty.png", { caption: 'Gift Nifty' });


        } catch (error) {
            console.error('Error generating image:', error);
        }
    }
});


    bot.onText(/^\/portfolio/,async (msg) => {
        const chatId = msg.chat.id;
        if (chatId === 1375808164) {
            const symbols = Object.keys(symbolQuantityObject);
            const dataPromises = symbols.map(async (symbol) => {
                try {
                    const equityDetails = await getData(symbol)

                    return { symbol, equityDetails };
                } catch (error) {
                    console.error(`Error fetching data for symbol ${symbol}: ${error}`);
                    return null;
                }
            });
            const results = await Promise.all(dataPromises);
            let total = 0;
            let worth = 0;
            let gainers = [];
            let losers = [];

            results.forEach((result) => {
                if (result) {
                    const { symbol, equityDetails } = result;
                    const quantity = symbolQuantityObject[symbol];
                    const currentPrice = parseFloat(equityDetails.priceInfo.lastPrice);
                    const change = parseFloat(equityDetails.priceInfo.change);

                    total += change * quantity;
                    worth += currentPrice * quantity;

                    const portfolioChange = change * quantity;
                    if (portfolioChange > 0) {
                        gainers.push({ symbol, portfolioChange });
                    } else if (portfolioChange < 0) {
                        losers.push({ symbol, portfolioChange });
                    }
                }
            })

            gainers.sort((a, b) => b.portfolioChange - a.portfolioChange); // Descending order
            losers.sort((a, b) => a.portfolioChange - b.portfolioChange); // Ascending order

            const topGainers = gainers;
            const topLosers = losers;

            let messageContent = `<b>Day P&L:</b> ${total.toFixed(2)}
        <b>Worth:</b> ${worth.toFixed(2)}
        <b>Top Gainers (Value) </b>:
        ${topGainers.map(g => `${g.symbol}: ${g.portfolioChange.toFixed(2)}`).join('\n')}

        <b>Top Losers (Value): </b>
        ${topLosers.map(l => `${l.symbol}: ${l.portfolioChange.toFixed(2)}`).join('\n')}`;


            bot.sendMessage(chatId, messageContent, { parse_mode: "HTML" });
        }
    });

    module.exports = bot;
