const { mailer, readFile } = require("./mailer");
const { NseIndia } = require("stock-nse-india");
const { allData, symbolQuantityObject } = require("../routes/data");
const client = require("./redis");
const util = require("util");
const moment = require("moment-timezone");
const { Note, User } = require("../config/models");
const axios = require("axios");
const { scrapGlobalIndices } = require("./Scrapper");
const {sendNotification} = require("../config/webPush")
const tradeData = async (symbol, nseIndia) => {
  const data = await nseIndia.getEquityTradeInfo(symbol);
  return data;
};
const scheduleTask = async () => {
  const symbols = allData;

  let batchData = [];
  let batchCount = 0;

  await client.set("deliveryreport", "", (err, data) => {
    if (err) {
      console.log(err);
    }
  });

  for (let i = 0; i < symbols.length; i++) {
    try {
      const nseIndia = new NseIndia();
      const symbol = symbols[i];
      const data = await tradeData(symbol, nseIndia);

      if (symbol in await symbolQuantityObject()) {
        const redisKey = `delivery:${symbol}`;

        // Fetch the existing data from Redis
        const existingData = await client.get(redisKey);
        let symbolData = existingData ? JSON.parse(existingData) : {};

        // Append the new day's data without overwriting previous entries
          const user =  await User.findOne({ email: "kaushikappani@gmail.com" })

        if (data.securityWiseDP.deliveryToTradedQuantity > process.env.DELIVERY_QUANTITY_THRESHOLD) {
          let notiReq = {
            title: `Delivery Report`,
            body: `Delivery for Symbol :${symbol} is ${data.securityWiseDP.deliveryToTradedQuantity}`,
            data: {
              url: "/stock/screener",
            }
          }
          triggerNotifications(notiReq, user);
        }
          

        symbolData[data.securityWiseDP.secWiseDelPosDate] = {
          delivery: data.securityWiseDP.deliveryToTradedQuantity,
          date: data.securityWiseDP.secWiseDelPosDate
        };

        // Filter to keep only the last 3 days
        const filteredData = filterLast3DaysData(symbolData);

        // Save the filtered data back to Redis
        await client.set(redisKey, JSON.stringify(filteredData));

        console.log(`Saved/Updated data for ${symbol} on ${data.securityWiseDP.secWiseDelPosDate}`);
      }


      if (data.securityWiseDP && data.securityWiseDP.deliveryToTradedQuantity > process.env.DELIVERY_QUANTITY_THRESHOLD) {
        batchData.push({
          symbol,
          delivery: data.securityWiseDP.deliveryToTradedQuantity,
          date: data.securityWiseDP.secWiseDelPosDate
        });
        // console.log("pushed to batch " + JSON.stringify(data.securityWiseDP));
        batchCount++;
      }
      if (batchCount === 2 || (i === symbols.length - 1 && batchCount > 0)) {
        try {
          const mailTemplate = await readFile("../templates/stock_email.txt");
          let tableRows = "";
          batchData.forEach((stock) => {
            tableRows += `
                    <tr>
                        <td>${stock.date}</td>
                        <td>${stock.symbol}</td>
                        <td>${stock.delivery}%</td>
                    </tr>
                `;
          });

          const getAsync = util.promisify(client.get).bind(client);

          const cacheData = await getAsync("deliveryreport");
          const catchDate = moment.tz(process.env.TIME_ZONE);

          await client.set(
            "deliveryreport",
            cacheData + tableRows,
            (err, data) => {
              if (err) {
                console.log(err);
              } else {
                // console.log("delivery report pushed to cache");
              }
            }
          );
          await client.set(
            "deliveryreportlastupdated",
            catchDate.toString(),
            (err, data) => {
              if (err) {
                console.log(err);
              }
            }
          );

          console.log("pushed to chache");
          const mailHtml = mailTemplate.replace(
            "<!-- Repeat rows as needed -->",
            tableRows
          );
          const recipient = {
            name: "kaushik",
            email: "kaushikappani@gmail.com",
          };

          const mailBody = {
            subject: "Scheduler - Stock Delivery Report",
            text: "Mail Sent By Scheduler",
            html: mailHtml,
          };

          // mailer(recipient, mailBody);
          batchData = [];
          batchCount = 0;
        } catch (e) {
          console.error(`Error while report making`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1));
    } catch (e) {
      console.error(
        `Error while fetching data for symbol =  ${symbols[i]} `,
        e
      );
    }


  }
  pickDataFromCacheToDb();
};


function filterLast3DaysData(data) {
  const dates = Object.keys(data).sort().reverse();

  const recentDates = dates.slice(0, 3);

  const filteredData = recentDates.reduce((acc, date) => {
    acc[date] = data[date];
    return acc;
  }, {});

  return filteredData;
}


const scheduleFiiDiiReport = async () => {
  const nseIndia = new NseIndia();

  try {
    let data = await nseIndia.getDataByEndpoint("/api/fiidiiTradeReact");

    console.log(data);
    const mailTemplate = await readFile("../templates/stock_fii_dii_report.txt");
    let tableRows = "";
    const catchDate = moment.tz(process.env.TIME_ZONE);

    const note = await Note.findById("664ca1d9ac1930ca8b3f5945");
    const user = await User.findOne({ email:"kaushikappani@gmail.com" })

    data.forEach((item) => {
      let notiReq = {
        title: `${item.category} ${item.date} Report`,
        body: `Net Value = ${item.netValue}`,
      }
      triggerNotifications(notiReq, user);
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


    const mailHtml = mailTemplate.replace(
      "<!-- Repeat rows as needed -->",
      tableRows
    );
    note.content = mailHtml + note.content;
    note.title = "FII/ DII Report - " + catchDate.toString();
    note.save();
    // const note = new Note({ user: user._id, title: "FII/ DII Report - " + catchDate.toString(), category: "Scheduler", content: mailHtml });

    const recipient = {
      name: "kaushik",
      email: "kaushikappani@gmail.com",
    };

    const mailBody = {
      subject: "FII/ DII Report ",
      text: "Mail Sent By Scheduler",
      html: mailHtml,
    };

 

  } catch (e) {
    console.error("Error in scheduleFiiDiiReport ", e);
  }

  // mailer(recipient, mailBody);
};


const scheduleCoorporateAnnouncments = async () => {
  const nseIndia = new NseIndia();

  try {
    const toDate = moment().tz(process.env.TIME_ZONE);
    const fromDate = toDate.clone().subtract(1, "days");
    const toDateString = toDate.format("DD-MM-YYYY");
    const fromDateString = fromDate.format("DD-MM-YYYY");
    const dateString = `from_date=${fromDateString}&to_date=${toDateString}`;
    let data = await nseIndia.getDataByEndpoint(
      `/api/corporate-announcements?index=equities&${dateString}`
    );
    // console.log(data);
    const mailTemplate = await readFile(
      "../templates/stock_coorporate_annoucements.txt"
    );
    let tableRows = "";
    const catchDate = moment.tz(process.env.TIME_ZONE);

    let matchedRows = "";
    let otherRows = "";
    const user = await User.findOne({ email: "kaushikappani@gmail.com" })

    data.forEach(async(item) => {
      let rowStyle = "";
      if (item.symbol in await symbolQuantityObject()) {
        let notiReq = {
          title: item.symbol + " " + item.desc,
          body: item.attchmntText,
          data: {
            url: item.attchmntFile,
          },
        }
        triggerNotifications(notiReq, user);
        rowStyle = 'style="background-color: green;"';

        matchedRows += `
            <tr>
            <td><div><span ${rowStyle}>${item.symbol}</span></div></td>
            <td>${item.desc}</td>
            <td>${item.an_dt}</td>
            <td><a href="${item.attchmntFile
          }" target="_blank">View Attachment</a></td>
            <td>${item.sm_name}</td>
            <td>${item.attchmntText}</td>
        </tr>
        `;
      } else {
        otherRows += `
            <tr>
            <td><div><span ${rowStyle}>${item.symbol}</span></div></td>
            <td>${item.desc}</td>
            <td>${item.an_dt}</td>
            <td><a href="${item.attchmntFile
          }" target="_blank">View Attachment</a></td>
            <td>${item.sm_name}</td>
            <td>${item.attchmntText}</td>
        </tr>
        `;
      }
    });

    tableRows = matchedRows + otherRows;

    const note = await Note.findById("664d66b9ac1930ca8b3f59ce");

    const mailHtml = mailTemplate.replace(
      "<!-- Repeat rows as needed -->",
      tableRows
    );
    note.content = mailHtml;
    note.title = "Corporate Announcements - " + catchDate.toString();
    note.save();

    // const note = new Note({ user: user._id, title: "Corporate Announcements - " + catchDate.toString(), category: "Scheduler", content: mailHtml });

    const recipient = {
      name: "kaushik",
      email: "kaushikappani@gmail.com",
    };

    const mailBody = {
      subject: "Corporate Announcements",
      text: "Corporate Announcements",
      html: mailHtml,
    };
    // mailer(recipient, mailBody);

  } catch (e) {
    console.error("Error in scheduleCoorporateAnnouncments ", e);
  }
};



const scheduleCoorporateActions = async () => {
  try {
    const nseIndia = new NseIndia();

    const toDate = moment().tz(process.env.TIME_ZONE);
    const fromDate = toDate.clone().add(1, "weeks");
    const today = toDate.format("DD-MM-YYYY");
    const nextweek = fromDate.format("DD-MM-YYYY");
    const dateString = `from_date=${today}&to_date=${nextweek}`;

    let data = await nseIndia.getDataByEndpoint(
      `/api/corporates-corporateActions?index=equities&${dateString}`
    );
    const mailTemplate = await readFile(
      "../templates/stock_coorporate_actions.txt"
    );
    let tableRows = "";
    const catchDate = moment.tz(process.env.TIME_ZONE);

    let matchedRows = "";
    let otherRows = "";
    const user = await User.findOne({ email: "kaushikappani@gmail.com" })

    data.forEach(async(item) => {
      let rowStyle = "";
      if (item.symbol in await symbolQuantityObject()) {
        let notiReq = {
          title: item.symbol,
          body: item.subject,
          
        }
        triggerNotifications(notiReq, user);
        rowStyle = 'style="background-color: green;"';

        matchedRows += `
            <tr>
            <td><div><span ${rowStyle}>${item.symbol}</span></div></td>
            <td>${item.faceVal}</td>
            <td>${item.subject}</td>
            <td>${item.exDate}</td>
            <td>${item.comp}</td>
        </tr>
        `;
      } else {
        otherRows += `
            <tr>
            <td><div><span ${rowStyle}>${item.symbol}</span></div></td>
            <td>${item.faceVal}</td>
            <td>${item.subject}</td>
            <td>${item.exDate}</td>
            <td>${item.comp}</td>
        </tr>
        `;
      }
    });

    tableRows = matchedRows + otherRows;

    const mailHtml = mailTemplate.replace(
      "<!-- Repeat rows as needed -->",
      tableRows
    );

    const note = await Note.findById("664d66b9ac1930ca8b3f59d1");
    note.content = mailHtml;
    note.title = "Corporate Actions - " + catchDate.toString();
    note.save();

    const recipient = {
      name: "kaushik",
      email: "kaushikappani@gmail.com",
    };

    const mailBody = {
      subject: "Corporate Actions",
      text: "Corporate Actions",
      html: mailHtml,
    };
    // mailer(recipient, mailBody);

  } catch (e) {
    console.error("Error in scheduleCoorporateActions ", e);

  }
};



const giftNifty = async (globalIndices) => {
  try {
    const nseIndia = new NseIndia();

    let data;
    try {

      data = globalIndices.find(item => item.indicesName === 'Gift Nifty');


    } catch (axiosError) {
      console.error("Error fetching Gift Nifty data:", axiosError.message);
    }

    let dataNifty = { last: "", variation: "", percentChange: "" };
    try {
      let dataIndices = await nseIndia.getDataByEndpoint(`/api/allIndices`);
      dataNifty = dataIndices.data[0] || dataNifty;
    } catch (niftyError) {
      console.error("Nifty 50 fetch error:", niftyError.message);
    }

    const noteId = "6696a424d0450dec09316cbf";
    const date = moment.tz(process.env.TIME_ZONE);
    const content = `<h2>Gift Nifty : ${data.price}, ${data.priceChange} </h2><br><h2>Nifty 50 : ${dataNifty.last} , ${dataNifty.variation} ${dataNifty.percentChange}%</h2>`;
    const title = "Gift Nifty As of " + date.toString();
    const color = (parseFloat(data.priceChange.split(' ')[0]) > 0) ? "#345920" : "#5c2b29";

    try {
      await Note.findByIdAndUpdate(noteId, { content, title, color });
    } catch (dbError) {
      console.error("Error updating note:", dbError.message);
    }

    return { giftNifty: data, dataNifty };
  } catch (e) {
    console.error("Gift Nifty process failed:", e.message);
  }
};



const pickDataFromCacheToDb = async () => {
  const getAsync = util.promisify(client.get).bind(client);

  const result = await getAsync("deliveryreport");
  const resultDate = await getAsync("deliveryreportlastupdated");

  const mailTemplate = await readFile("../templates/stock_email.txt");



  if (result) {
    const note = await Note.findById("66a25d1d34d7c9f59b2e4fd1");

    note.title = "Delivery Report - " + resultDate;
    note.content = mailTemplate.replace("<!-- Repeat rows as needed -->", result) + note.content;
    note.createdAt = new Date(),
      note.updatedAt = new Date(),
      note.category = "Scheduler"
    note.save();
  }

}


const getGlobalIndices = async () => {
  try {
    const data = await scrapGlobalIndices();
    giftNifty(data);
    let htmlContent = `
    <table border="1">
        <thead>
            <tr>
                <th><span style="color: rgb(0, 0, 0)">Index</span></th>
                <th><span style="color: rgb(0, 0, 0)">Price</span></th>
                <th><span style="color: rgb(0, 0, 0)">Price Change</span></th>
                <th><span style="color: rgb(0, 0, 0)">Last Updated</span></th>
            </tr>
        </thead>
        <tbody>
    `;

    data.forEach(item => {
      const isPositiveChange = !item.priceChange.startsWith('-');
      htmlContent += `
            <tr>
                <td><span style="color: ${isPositiveChange ? 'green' : 'red'}">${item.indicesName}</span></td>
                <td><span style="color: ${isPositiveChange ? 'green' : 'red'}">${item.price}</span></td>
                <td><span style="color: ${isPositiveChange ? 'green' : 'red'}">${item.priceChange}</span></td>
                <td><span style="color: ${isPositiveChange ? 'green' : 'red'}">${item.lastUpdated}</span></td>
            </tr>
        `;
    });

    htmlContent += `
        </tbody>
    </table>
    `;
    // const noteId = "66c08f5b8e14b9427c397442";
    // const date = moment.tz(process.env.TIME_ZONE);
    // const title = `Global Indices ${date.toString()}`;
    // const content = htmlContent;

    // await Note.findByIdAndUpdate(noteId, {
    //   title: title,
    //   content: content
    // });

    return htmlContent;
  } catch (e) {
    console.log(e);
  }
}


async function triggerNotifications(req, user) {
  console.log("Triggering notifications...");

  const { title, body, data } = req;

  const msgReq = {
    title,
    body,
    data: {
      url: data ? data.url : "/"
    },
    actions: [
      { action: 'accept', title: 'Accept' },
      { action: 'decline', title: 'Decline' }
    ]
  };
  

  const jsonData = JSON.stringify(msgReq); 

  try {
    const { web, mobile } = user.subscriptions;

    if (web.endpoint) {
      sendNotification(web, jsonData);
    }

    if (mobile.endpoint) {
      sendNotification(mobile, jsonData);
    }
  } catch (error) {
    console.error("Error retrieving or sending notifications:", error);
  }
}


// const testFunc = async() => { 
//   const user =  await User.findOne({ email: "kaushikappani@gmail.com" })

//   let notiReq = {
//     title: "Test notificaion",
//     body: "Test Content " + new Date(),
//     data: {
//       url: "/test",
//     }
//   }
//   triggerNotifications(notiReq, user);
// }

// testFunc();

module.exports = {
  scheduleTask,
  scheduleFiiDiiReport,
  scheduleCoorporateAnnouncments,
  scheduleCoorporateActions,
  giftNifty,
  getGlobalIndices,
  triggerNotifications
}
