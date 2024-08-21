if (req.user.email === "kaushikappani@gmail.com") {
    const getAsync = util.promisify(client.get).bind(client);

    const result = await getAsync("deliveryreport");
    const resultDate = await getAsync("deliveryreportlastupdated");

    const mailTemplate = await readFile("../templates/stock_email.txt");

    if (result) {
        const deliveryreport = {
            _id: "deliveryreport",
            title: "Delivery Report - " + resultDate,
            content: mailTemplate.replace("<!-- Repeat rows as needed -->", result),
            pinned: false,
            archived: false,
            color: "#202124",
            view: true,
            edit: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            category: "Scheduler"
        };
        modifiedNotes.push(deliveryreport);
    }
}

if (req.user.email === "kaushikappani@gmail.com" && req.params.id === "deliveryreport") {

    const result = await getAsync("deliveryreport");
    const resultDate = await getAsync("deliveryreportlastupdated");

    const mailTemplate = await readFile("../templates/stock_email.txt");

    if (result) {
        const deliveryreport = {
            _id: "deliveryreport",
            title: "Delivery Report - " + resultDate,
            content: mailTemplate.replace("<!-- Repeat rows as needed -->", result),
            pinned: true,
            archived: false,
            color: "#202124",
            view: true,
            edit: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            category: "Scheduler"
        };
        let user = {
            "name": "Scheduler",
            "email": "Scheduler"
        }

        res.json({ note: deliveryreport, user })
    }
}


// console.log("shareHoldingPattern",shareHoldingPattern)
// console.log("results",results);
// console.log("pandl",pandl);

// console.log("Pros: ", pros);
// console.log("Cons: ", cons)

// console.log("name", name)
// console.log("currentPrice", currentPrice)
// console.log("priceChange", priceChange)
// console.log("stockPEValue", stockPEValue)


// fs.writeFile('stockreports/'+symbol+".html", html, function (err) {
//     if (err) throw err;
//     console.log('Saved!');
// });


const getCogencisNews = async () => {
    const token = await getCogencisToken();
    console.log(token);
    let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "https://data.cogencis.com/api/v1/web/news/landingpage?pageSize=10",
        headers: {
            "sec-ch-ua":
                '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            Accept: "application/json, text/plain, */*",
            Referer: "",
            "sec-ch-ua-mobile": "?0",
            Authorization: `Bearer ${token}`,
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "sec-ch-ua-platform": '"macOS"',
        },
    };

    const { data } = await axios.request(config);

    let newsString = "";

    data.response.data.forEach((category) => {
        category.data.forEach((news) => {
            newsString += `
            <tr>
            <td>${category.header}</td>
            <td>${news.headline}</td>
            <td>${news.synopsis}</td>
            <td><a href="${news.sourceLink}" target="_blank">${news.sourceLink}</a></td>            
            <td>${news.sourceName}</td>
        </tr>
        `;
        });
    });
    const date = moment.tz("Asia/Kolkata");

    const note = await Note.findById("66927412fb8bb584f9e35e72");

    const mailTemplate = await readFile(
        "../templates/stock_news.txt"
    );

    const mailHtml = mailTemplate.replace(
        "<!-- Repeat rows as needed -->",
        newsString
    );

    note.content = mailHtml
    note.title = "News Updates as of " + date.toString();
    note.save();


};


const getCogencisToken = async () => {
    let data = JSON.stringify({
        username: "digitalsalt",
        password: "N&8YV#62Ou",
    });

    let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://data.cogencis.com/api/v1/login",
        headers: {
            accept: "application/json; charset=UTF-8",
            "accept-language": "*",
            "content-type": "application/json",
            origin: "https://iinvest.cogencis.com",

            "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",

        },
        data: data,
    };
    try {
        const response = await axios.request(config);
        return response.data.response.token;
    } catch (e) {
        console.log(e);
    }
};


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


let messageContent = `<b>Day P&L:</b> ${total.toFixed(2)}
        <b>Worth:</b> ${worth.toFixed(2)}
        <b>Top Gainers (Value) </b>:
        ${topGainers.map(g => `${g.symbol}: ${g.portfolioChange.toFixed(2)}`).join('\n')}

        <b>Top Losers (Value): </b>
        ${topLosers.map(l => `${l.symbol}: ${l.portfolioChange.toFixed(2)}`).join('\n')}`;

// bot.sendMessage(chatId, messageContent, { parse_mode: "HTML" });
