const TelegramBot = require('node-telegram-bot-api');
const { giftNifty } = require('./StockScheduler');
const { scrapGlobalIndices } = require('./Scrapper');
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



module.exports = bot;
