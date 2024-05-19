const { model } = require("mongoose");
const { mailer, readFile } = require("./mailer");
const { NseIndia } = require("stock-nse-india");
const allData = require("../routes/data");
const client = require("./redis");
const util = require('util');
const moment = require('moment-timezone');


const tradeData = async (symbol, nseIndia) => {

    const data = await nseIndia.getEquityTradeInfo(symbol);
    return data;
}

const scheduleTask = async () => {
    const symbols = allData;

    let batchData = [];
    let batchCount = 0;

    await client.set("deliveryreport", "", (err, data) => {
        if (err) {
            console.log(err)
        }
    })

    for (let i = 0; i < symbols.length; i++) {
        try {
            const nseIndia = new NseIndia();
            const symbol = symbols[i];
            const data = await tradeData(symbol, nseIndia);

            if (data.securityWiseDP.deliveryToTradedQuantity > 60) {
                batchData.push({ symbol, delivery: data.securityWiseDP.deliveryToTradedQuantity });
                console.log("pushed to batch", symbol)
                batchCount++;
            } else {
                console.log("not pushed ", symbol)
            }

            if (batchCount === 50 || (i === symbols.length - 1 && batchCount > 0)) {
                const mailTemplate = await readFile("../templates/stock_email.txt");
                let tableRows = "";
                batchData.forEach(stock => {
                    tableRows += `
                    <tr>
                        <td>${stock.symbol}</td>
                        <td>${stock.delivery}%</td>
                    </tr>
                `;
                });

                const getAsync = util.promisify(client.get).bind(client);
            
                const cacheData = await getAsync("deliveryreport");
                const catchDate = moment.tz('Asia/Kolkata');
        
                await client.set("deliveryreport", cacheData + tableRows, (err, data) => {
                    if (err) {
                        console.log(err)
                    } else {
                        console.log("delivery report pushed to cache");
                    }
                })
                await client.set("deliveryreportlastupdated", catchDate.toString(), (err, data) => {
                    if (err) {
                        console.log(err)
                    }
                })

                const mailHtml = mailTemplate.replace("<!-- Repeat rows as needed -->",tableRows);

                const recipient = {
                    name: "kaushik",
                    email: "kaushikappani@gmail.com"
                }

                const mailBody = {
                    subject: "Scheduler - Stock Delivery Report",
                    text: "Mail Sent By Scheduler",
                    html: mailHtml,
                }

                mailer(recipient, mailBody);

                batchData = [];
                batchCount = 0;
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
            console.error(`Error while fetching data for symbol =  ${symbols[i]} `, e);
        }
    }
};


module.exports = { scheduleTask };
