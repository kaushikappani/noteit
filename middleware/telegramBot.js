const TelegramBot = require('node-telegram-bot-api');
const { giftNifty } = require('./StockScheduler');
const { scrapGlobalIndices } = require('./Scrapper');
const { symbolQuantityObject } = require('../routes/data');
const { NseIndia } = require('stock-nse-india');
const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

bot.onText(/^\/global/, async(msg) => {
    const chatId = msg.chat.id;
    console.log(typeof chatId);
    if (chatId === 1375808164) {
        const data = await scrapGlobalIndices();
        const html = data.map(item => {
            const isPositive = !item.priceChange.startsWith("-");
            const emoji = isPositive ? "🟢" : "🔴";
            return `
        <b>${item.indicesName}</b> ${emoji}
        Price: ${item.price}
        Price Change: ${item.priceChange}
        Last Updated: ${item.lastUpdated}`;
        }).join('\n\n');

        bot.sendMessage(chatId, html, { parse_mode: "HTML" });

        const giftn = await giftNifty();

        const giftNiftyPrice = giftn.giftNifty.currentPrice;
        const giftNiftyDayChange = giftn.giftNifty.dayChange;
        const giftNiftyDayChangeP = giftn.giftNifty.dayChangeP;

        const nifty50Price = giftn.dataNifty.last;
        const nifty50DayChange = giftn.dataNifty.variation;
        const nifty50DayChangeP = giftn.dataNifty.percentChange;

        // Format the message content
        const emoji = giftNiftyPrice - nifty50Price > 0 ? "🟢" : "🔴";
        const messageContent = `
        <b>Gift Nifty</b> ${emoji}
        Price: ${giftNiftyPrice}
        Change: ${giftNiftyDayChange} (${giftNiftyDayChangeP}%)

        <b>Nifty 50</b>
        Price: ${nifty50Price}
        Change: ${nifty50DayChange} (${nifty50DayChangeP}%)`;

        // Send the message via Telegram bot
        bot.sendMessage(chatId, messageContent, { parse_mode: "HTML" });
    }

});

const getData = async (symbol) => {
    const nseIndia = new NseIndia();
    const data = await nseIndia.getEquityDetails(symbol);
    return data;
}

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
