const { mailer, readFile } = require("./mailer");
const { NseIndia } = require("stock-nse-india");
const { allData, symbolQuantityObject } = require("../routes/data");
const client = require("./redis");
const util = require("util");
const moment = require("moment-timezone");
const { Note, User } = require("../config/models");
const axios = require("axios");
const { scrapGlobalIndices } = require("./Scrapper");
const {sendNotification} = require("../config/webPush");
const { analyzeCorporateDocument } = require("../functions/analyzeDocument");
const { sendTelegramMessage } = require("./sendTelegramMessage.js");
const { fetchDocumentText } = require("../functions/documentToText.js");
const { sendTweetSafely } = require("../functions/xService.js");
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
      const user = await User.findOne({ email: "kaushikappani@gmail.com" })

      let pf = await symbolQuantityObject(user._id);
      if (symbol in pf) {
        const redisKey = `delivery:${symbol}`;

        // Fetch the existing data from Redis
        const existingData = await client.get(redisKey);
        let symbolData = existingData ? JSON.parse(existingData) : {};

        // Append the new day's data without overwriting previous entries

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

      await new Promise((resolve) => setTimeout(resolve, 1000));
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

   mailer(recipient, mailBody);
};

const scheduleCoorporateAnnouncments = async () => {
  console.log("Starting Corporate Announcements Scheduler...");
  const nseIndia = new NseIndia();

  try {
    const toDate = moment().tz(process.env.TIME_ZONE);
    const fromDate = toDate.clone().subtract(1, "days");

    const dateRange =
      `from_date=${fromDate.format("DD-MM-YYYY")}` +
      `&to_date=${toDate.format("DD-MM-YYYY")}`;

      console.log(`Fetching corporate announcements from ${fromDate.format("DD-MM-YYYY")} to ${toDate.format("DD-MM-YYYY")}`);

    const data = await nseIndia.getDataByEndpoint(
      `/api/corporate-announcements?index=equities&${dateRange}&reqXbrl=false`
    );

    console.log(`Fetched ${data.length} corporate announcements.`);

    const mailTemplate = await readFile(
      "../templates/stock_coorporate_annoucements.txt"
    );

    notificationUsers = require("../config/notificationUsers.json");

    console.log(notificationUsers)
    //  Iterate over each user from JSON config
    for (const usr of notificationUsers) {
      const userEmail = usr.email;
      const telegramId = usr.telegramId;
      const noteId = usr.noteId;

      console.log(` Processing: ${userEmail}`);
      const user = await User.findOne({ email: userEmail })

      // Fetch only this user's portfolio symbols
      const symbolObj = await symbolQuantityObject(user._id);
      const symbols = Object.keys(symbolObj);


      let matchedRows = "";
      let otherRows = "";

      for (const item of data) {
        if (symbols.includes(item.symbol)) {
          // Try AI analysis, but continue if it fails
          let summary = "";
          let aiAnalysisSuccess = false;

          try {
            summary = await analyzeCorporateDocument(item.attchmntFile);
            // Check if analysis returned error message
            if (!summary.includes("Could not analyze document")) {
              aiAnalysisSuccess = true;
            } else {
              console.log(`AI analysis failed for ${item.symbol}, skipping notifications`);
            }
          } catch (error) {
            console.error(`Error analyzing document for ${item.symbol}:`, error);
            summary = "";
          }

          // Only send notifications if AI analysis succeeded
          if (aiAnalysisSuccess && summary) {
            // Send push notification
            try {
              let notiReq = { title: item.symbol + "-" + item.desc, body: summary, data: { url: item.attchmntFile, }, }
              triggerNotifications(notiReq, user);
              console.log(` Notification triggered for ${item.symbol} - ${userEmail}`);
            } catch (error) {
              console.error(`Error sending push notification for ${item.symbol}:`, error);
            }

            // Send Telegram notification
            if (telegramId) {
              try {
                await sendTelegramMessage(
                  telegramId,
                  `*${item.symbol}* - ${item.desc}\n\n${summary}`,
                  true,
                  `*${item.symbol}* - ${item.desc}\n\n[View Attachment](${item.attchmntFile})`
                );
              } catch (error) {
                console.error(`Error sending Telegram message for ${item.symbol}:`, error);
              }
            }

            // Send Tweet directly
            try {
              const { textToImageBuffer } = require("../functions/textToImage");
              const tweetText = `*${item.symbol}* - ${item.desc}\n\n${summary}`;
              const imageBuffer = await textToImageBuffer(tweetText);
              await sendTweetSafely(tweetText, imageBuffer);
            } catch (error) {
              console.error(`Error sending tweet for ${item.symbol}:`, error);
            }
          }

          matchedRows += `
            <tr>
              <td><span style="background: green">${item.symbol}</span></td>
              <td>${item.an_dt}</td>
              <td><a href="${item.attchmntFile}" target="_blank">View</a></td>
              <td>${item.desc} - ${item.attchmntText} ${summary}</td>
            </tr>`;
        } else {
          otherRows += `
            <tr>
              <td>${item.symbol}</td>
              <td>${item.an_dt}</td>
              <td><a href="${item.attchmntFile}" target="_blank">View</a></td>
              <td>${item.desc} - ${item.attchmntText}</td>
            </tr>`;
        }
      }

      const tableRows = matchedRows + otherRows;
      const html = mailTemplate.replace("<!-- Repeat rows as needed -->", tableRows);
          const catchDate = moment().tz(process.env.TIME_ZONE);

      // Corporate announcements no longer overwrite a note. They are ingested,
      // summarised and scored by the MarketDesk module, which keeps every filing
      // as its own record instead of squashing them into one HTML blob that the
      // next run destroyed. See marketdesk/jobs/ingestFilings.js.
    }

  } catch (e) {
    console.error("Error in scheduleCoorporateAnnouncments ", e);
  }
};

// Previously this ran on import, meaning every boot and every deploy triggered a
// full NSE fetch plus an LLM pass before the server had even finished starting.
// MarketDesk's scheduler owns this cadence now.
// scheduleCoorporateAnnouncments();

//analyzeCorporateDocument("https://nsearchives.nseindia.com/corporate/FEDERALBNK_28122025202138_ESOS_210_212_281225_SE_S.pdf");

// sendTelegramMessage("1375808164",` analysts/institutional investor meet/con. call updates**notification:** mrs. bectors food specialities (bectorfood) presented a compelling growth trajectory and strategic expansion plans at its recent investor meet.1.  **dual segment dominance:** the company maintains a strong market position in both premium biscuits (cremica) and bakery products (english oven), serving as a critical supplier to major quick service restaurants (qsrs) across india.2.  **robust financial performance:** bectorfood has consistently delivered strong revenue growth and improving profitability, driven by premiumization in biscuits and expanding client relationships in the high-growth qsr bakery segment.3.  **strategic growth & capacity expansion:** future growth is underpinned by aggressive distribution expansion into new geographies and rural markets, continuous new product development, and significant capacity enhancements across both biscuit and bakery divisions.4.  **entrenched competitive advantages:** key strengths include powerful brand equity, an extensive distribution network, long-standing relationships with leading qsrs, and integrated manufacturing facilities, providing a sustainable competitive edge.5.  **positive outlook & market capture:** management projects continued market share gains, leveraging operational efficiencies and new capacities to capitalize on increasing demand in both urban and rural india, signaling a confident future outlook.**overall sentiment:** positive 🟢**recommendation:** based on the robust performance, clear growth strategies, and positive outlook presented, we recommend a **buy** on mrs. bectors food specialities.`,true)

const scheduleCoorporateActions = async () => {
  try {
    const nseIndia = new NseIndia();

    const toDate = moment().tz(process.env.TIME_ZONE);
    const fromDate = toDate.clone().add(1, "weeks");
//
    const dateString = `from_date=${toDate.format("DD-MM-YYYY")}&to_date=${fromDate.format("DD-MM-YYYY")}`;

    // Fetch data from NSE
    const data = await nseIndia.getDataByEndpoint(
      `/api/corporates-corporateActions?index=equities&${dateString}`
    );

    const mailTemplate = await readFile(
      "../templates/stock_coorporate_actions.txt"
    );

    const catchDate = moment().tz(process.env.TIME_ZONE);

    let matchedRows = "";
    let otherRows = "";

    const user = await User.findOne({ email: "kaushikappani@gmail.com" });

    //  Pre-fetch symbols once
    const symbolObj = await symbolQuantityObject(user._id);

    for (const item of data) {
      let rowStyle = "";

      const htmlRow = `
        <tr>
          <td><div><span ${rowStyle}>${item.symbol}</span></div></td>
          <td>${item.faceVal}</td>
          <td>${item.subject}</td>
          <td>${item.exDate}</td>
          <td>${item.comp}</td>
        </tr>
      `;

      if (item.symbol in symbolObj) {
        rowStyle = 'style="background-color: green;"';

        // Optional — only if you want push notifications
        const notiReq = {
          title: item.symbol,
          body: item.subject,
        };
        // triggerNotifications(notiReq, user);

        matchedRows += htmlRow.replace("<span >", `<span ${rowStyle}>`);
      } else {
        otherRows += htmlRow;
      }
    }

    const tableRows = matchedRows + otherRows;

    const mailHtml = mailTemplate.replace(
      "<!-- Repeat rows as needed -->",
      tableRows
    );

    // No longer saved to a note - corporate actions are stored per action in
    // md_corporate_actions and shown as the calendar panel.
    // See marketdesk/jobs/ingestCorporateActions.js.

    // Send email if needed
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
