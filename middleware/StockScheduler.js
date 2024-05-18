const { model } = require("mongoose");
const { mailer, readFile } = require("./mailer");
const { NseIndia } = require("stock-nse-india");
const allData = require("../routes/data");

const tradeData = async (symbol, nseIndia) => {

    const data = await nseIndia.getEquityTradeInfo(symbol);
    return data;
}

const scheduleTask = async () => {
    const symbols = allData;

    for (let i = 0; i < symbols.length; i++) {
        const nseIndia = new NseIndia();
        const symbol = symbols[i];
        const data = await tradeData(symbol, nseIndia);

        if (data.securityWiseDP.deliveryToTradedQuantity > 60) {
            const mailTemplate = await readFile("../templates/stock_email.txt");
            const mailHtml = mailTemplate.replace("#{symbol}", symbol).replace("#{delivery}", data.securityWiseDP.deliveryToTradedQuantity);

            const recipent = {
                name: "kaushik", email: "kaushikappani@gmail.com"
            }

            const mailBody = {
                subject: "Scheduler - " + symbol,
                text: "Mail Sent By Scheduler",
                html: mailHtml,
            }

            mailer(recipent, mailBody)
        }

        // Wait for 2 minutes before processing the next symbol
        await new Promise(resolve => setTimeout(resolve, 20000));
    }

};


module.exports = { scheduleTask };
