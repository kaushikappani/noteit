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

    let batchData = [];
    let batchCount = 0;

    for (let i = 0; i < symbols.length; i++) {
        const nseIndia = new NseIndia();
        const symbol = symbols[i];
        const data = await tradeData(symbol, nseIndia);

        if (data.securityWiseDP.deliveryToTradedQuantity > 60) {
            batchData.push({ symbol, delivery: data.securityWiseDP.deliveryToTradedQuantity });
            batchCount++;
        }

        if (batchCount === 20 || (i === symbols.length - 1 && batchCount > 0)) {
            const mailTemplate = await readFile("../templates/stock_email.html");
            let tableRows = "";

            batchData.forEach(stock => {
                tableRows += `
                    <tr>
                        <td>${stock.symbol}</td>
                        <td>${stock.delivery}%</td>
                    </tr>
                `;
            });

            const mailHtml = mailTemplate.replace("<!-- Repeat rows as needed -->", tableRows);

            const recipient = {
                name: "kaushik",
                email: "kaushikappani@gmail.com"
            }

            const mailBody = {
                subject: "Scheduler - Stock Delivery Report",
                text: "Mail Sent By Scheduler",
                html: mailHtml,
            }

            await mailer(recipient, mailBody);

            // Reset batch data and count
            batchData = [];
            batchCount = 0;
        }

        await new Promise(resolve => setTimeout(resolve, 20000));
    }
};


module.exports = { scheduleTask };
