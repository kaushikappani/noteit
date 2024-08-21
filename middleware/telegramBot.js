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

const getData = async (symbol) => {
    const nseIndia = new NseIndia();
    const data = await nseIndia.getEquityDetails(symbol);
    return data;
}


bot.onText(/^\/global/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId === 1375808164) {  // Change to your chat ID if needed
        const data = await scrapGlobalIndices();

        const imageWidth = 1300;
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
            data.forEach(async (item, index) => {
                const y = 150 + index * 50;
                const isPositive = !item.priceChange.startsWith('-');
                if (isPositive) {
                    image.scan(0, y, 1500, 300, function (x, y, idx) {
                        this.setPixelColor(Jimp.rgbaToInt(76, 187, 23, 150), x, y);
                    });
                } else {
                    image.scan(0, y, 1500, 500, function (x, y, idx) {
                        this.setPixelColor(Jimp.rgbaToInt(255, 68, 51, 150), x, y);
                    });
                }

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

            const image2 = await Jimp.create(450, 200, '#ffffff');

            const isPositive2 = nifty50Price - giftNiftyPrice;
            const y = 0;
            if (isPositive2) {
                image2.scan(0, y, 1500, 300, function (x, y, idx) {
                    this.setPixelColor(Jimp.rgbaToInt(76, 187, 23, 150), x, y);
                });
            } else {
                image2.scan(0, y, 1500, 500, function (x, y, idx) {
                    this.setPixelColor(Jimp.rgbaToInt(255, 68, 51, 150), x, y);
                });
            }

            image2
                .print(font, 10, 10, `Gift Nifty Price: ${giftNiftyPrice}`)
                .print(font, 10, 40, `Day Change: ${giftNiftyDayChange} (${giftNiftyDayChangeP}%)`)
                .print(font, 10, 60, "-------------------------------")
                .print(font, 10, 80, `Nifty 50 Price: ${nifty50Price}`)
                .print(font, 10, 115, `Day Change: ${nifty50DayChange} (${nifty50DayChangeP}%)`);

            await image2.writeAsync('./gift-nifty.png');
            await bot.sendPhoto(chatId, "./gift-nifty.png", { caption: 'Gift Nifty.' });
            fs.unlinkSync("./gift-nifty.png");

        } catch (error) {
            console.error('Error generating image:', error);
        }
    }
});


bot.onText(/^\/portfolio/, async (msg) => {
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

        results.forEach((result, index) => {
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

        const imageWidth = 1300;
        const imageHeight = 1000;
        const image = await Jimp.create(imageWidth, imageHeight, '#ffffff');
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
        const fontBig = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

        image.print(fontBig, 50, 20, `Day P&L :${total.toFixed(2)}`)
            .print(fontBig, 50, 80, `Worth: ${worth.toFixed(2)}`)

        gainers.forEach((g, index) => {
            const y = 150 + index * 50;

            image.scan(50, y, 550, 50, function (x, y, idx) {
                this.setPixelColor(Jimp.rgbaToInt(52, 89, 32, 150), x, y); // Red with some transparency
            });
            image.print(font, 50, y, {
                text: g.symbol, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                alignmentY: Jimp.VERTICAL_ALIGN_TOP,
            }, imageWidth, imageHeight);
            image.print(font, 400, y, {
                text: g.portfolioChange.toFixed(2),
                alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                alignmentY: Jimp.VERTICAL_ALIGN_TOP,
            }, imageWidth, imageHeight)
        })

        losers.forEach((g, index) => {
            const y = 150 + index * 50;

            image.scan(650, y, 550, 50, function (x, y, idx) {
                this.setPixelColor(Jimp.rgbaToInt(250, 0, 0, 150), x, y); // Green with some transparency
            });

            image.print(font, 650, y, {
                text: g.symbol, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                alignmentY: Jimp.VERTICAL_ALIGN_TOP,
            }, imageWidth, imageHeight);
            image.print(font, 1000, y, {
                text: g.portfolioChange.toFixed(2),
                alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                alignmentY: Jimp.VERTICAL_ALIGN_TOP,
            }, imageWidth, imageHeight)
        })


        const topGainers = gainers;
        const topLosers = losers;

        await image.writeAsync('./summary.png');
        await bot.sendPhoto(chatId, "./summary.png", { caption: 'Portfolio' });
        fs.unlinkSync("./summary.png");

    }
});

module.exports = bot;
