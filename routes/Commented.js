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