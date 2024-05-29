const { mailer, readFile } = require("./mailer");
const { NseIndia } = require("stock-nse-india");
const allData = require("../routes/data");
const client = require("./redis");
const util = require('util');
const moment = require('moment-timezone');
const { Note,User } = require("../config/models");


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

const scheduleFiiDiiReport = async () => {
    const nseIndia = new NseIndia();

    let data = await nseIndia.getDataByEndpoint("/api/fiidiiTradeReact"); 
    let user = await User.findOne({ email: "kaushikappani@gmail.com" });
    const mailTemplate = await readFile("../templates/stock_fii_dii_report.txt");
    let tableRows = "";
    const catchDate = moment.tz('Asia/Kolkata');

    const note = await Note.findById("664ca1d9ac1930ca8b3f5945");

    data.forEach(item => {
        tableRows += `
            <tr>
                <td>${item.category}</td>
                <td>${item.date}</td>
                <td>${item.buyValue}</td>
                <td>${item.sellValue}</td>
                <td>${item.netValue}</td>
            </tr>
        `;
    });

    const mailHtml = mailTemplate.replace("<!-- Repeat rows as needed -->", tableRows);
    note.content = mailHtml + note.content;
    note.title = "FII/ DII Report - " + catchDate.toString();
    note.save();
    // const note = new Note({ user: user._id, title: "FII/ DII Report - " + catchDate.toString(), category: "Scheduler", content: mailHtml });


    const recipient = {
        name: "kaushik",
        email: "kaushikappani@gmail.com"
    }

    const mailBody = {
        subject: "FII/ DII Report ",
        text: "Mail Sent By Scheduler",
        html: mailHtml,
    }

    mailer(recipient, mailBody);

}

const scheduleCoorporateAnnouncments = async () => {
    const nseIndia = new NseIndia();

    let data = await nseIndia.getDataByEndpoint("/api/corporate-announcements?index=equities");
    let user = await User.findOne({ email: "kaushikappani@gmail.com" });
    const mailTemplate = await readFile("../templates/stock_coorporate_annoucements.txt");
    let tableRows = "";
    const catchDate = moment.tz('Asia/Kolkata');

    data.forEach(item => {
        tableRows += `
            <tr>
            <td>${item.symbol}</td>
            <td>${item.desc}</td>
            <td>${item.an_dt}</td>
            <td><a href="${item.attchmntFile}" target="_blank">View Attachment</a></td>
            <td>${item.sm_name}</td>
            <td>${item.sm_isin}</td>
            <td>${item.smIndustry || 'N/A'}</td>
            <td>${item.attchmntText}</td>
        </tr>
        `;
    });

    const note = await Note.findById("664d66b9ac1930ca8b3f59ce");
 
    const mailHtml = mailTemplate.replace("<!-- Repeat rows as needed -->", tableRows);
    note.content = mailHtml;
    note.title = "Corporate Announcements - " + catchDate.toString();
    note.save();
    
    // const note = new Note({ user: user._id, title: "Corporate Announcements - " + catchDate.toString(), category: "Scheduler", content: mailHtml });

    const recipient = {
        name: "kaushik",
        email: "kaushikappani@gmail.com"
    }

    const mailBody = {
        subject: "Corporate Announcements",
        text: "Corporate Announcements",
        html: mailHtml,
    }

    mailer(recipient, mailBody);
}

const scheduleCoorporateActions = async () => {
    const nseIndia = new NseIndia();

    let data = await nseIndia.getDataByEndpoint("/api/corporates-corporateActions?index=equities");
    let user = await User.findOne({ email: "kaushikappani@gmail.com" });
    const mailTemplate = await readFile("../templates/stock_coorporate_actions.txt");
    let tableRows = "";
    const catchDate = moment.tz('Asia/Kolkata');

    data.forEach(item => {
        tableRows += `
            <tr>
            <td>${item.symbol}</td>
            <td>${item.faceVal}</td>
            <td>${item.subject}</td>
            <td>${item.exDate}</td>
            <td>${item.comp}</td>
        </tr>
        `;
    });

    const mailHtml = mailTemplate.replace("<!-- Repeat rows as needed -->", tableRows);

    const note = await Note.findById("664d66b9ac1930ca8b3f59d1");
    note.content = mailHtml;
    note.title = "Corporate Actions - " + catchDate.toString();
    note.save();

    const recipient = {
        name: "kaushik",
        email: "kaushikappani@gmail.com"
    }

    const mailBody = {
        subject: "Corporate Actions",
        text: "Corporate Actions",
        html: mailHtml,
    }

    mailer(recipient, mailBody);
}



module.exports = {
    scheduleTask, scheduleFiiDiiReport,
    scheduleCoorporateAnnouncments, scheduleCoorporateActions
};
