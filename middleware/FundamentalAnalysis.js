const { allData, symbolQuantityObject } = require("../routes/data");
const { fetchData } = require("./Scrapper");
const fs = require("fs");
const ExcelJS = require('exceljs');
const util = require('util');

const {
    GoogleGenerativeAI,
} = require("@google/generative-ai");
const client = require("./redis");
const createPages = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    
    for (let i = 0; i < Object.keys(symbolQuantityObject).length; i++) {

        let symbol = Object.keys(symbolQuantityObject)[i];
        let data = await fetchData(symbol);
        
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "Based on the JSON data analyses the perticular stock data and give important information like profits all paramenters in last 3-4 quarter have grown and share holding pattern has incresed in latest 4 quarters give the proof with numbers and also give POSITIVE , neutral or NEGITIVE rating for each parameter Give the analysis in HTML page",
        });

        const generationConfig = {
            temperature: 1,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        };
        async function run() {
            const chatSession = model.startChat({
                generationConfig,

                history: [
                ],
            });
            const getAsync = util.promisify(client.get).bind(client);
            let cacheResult = await getAsync(`page_generated_${symbol}`);
            let result = "";
            let pageData = "";
            if (cacheResult == null) {
                await new Promise((resolve) => setTimeout(resolve, 50000));
                result = await chatSession.sendMessage(JSON.stringify(data));
                pageData = result.response.text().replace('```html', "").replace('```', "");
                client.set(`page_generated_${symbol}`, pageData, 'PX', 7*24 * 60 * 60 * 1000, (err, data) => {
                    if (err) {
                        console.log(err)
                    }
                })
            } else {
                console.log(symbol+" AI page from Cache");
                pageData = cacheResult;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }


            fs.writeFile(`stockreports/${symbol}.html`, pageData, function (err) {
                if (err) throw err;
                console.log(`AI page Saved! for ${symbol}`);
            });

           

        }
        try {
 
            await run();
        } catch(e){
            console.log(e);
        }
       
       
    }

}


async function generateReport() {
    let responseReport = [];
    for (i = 0; i < allData.length; i++){
        try {
            let symbol = allData[i];
            report = {};
            report[symbol] = {}
            const data = await fetchData(symbol);
            report[symbol].pe = data.stockPEValue;
            report[symbol].price = data.currentPrice;
            let results = data.resultsQuarterly.data;
            let shareHolding = data.shareHoldingPattern.data;
            const calculatePercentageChange = (current, prev) => {
                return ((current - prev) / prev) * 100;
            }
            const opmIndex = results.findIndex(d => d[0] === 'OPM %');
            if (opmIndex !== -1) {
                const currentOpm = parseFloat(results[opmIndex][results[opmIndex].length - 1]);
                const previousOpm = parseFloat(results[opmIndex][results[opmIndex].length - 2]);
                if (currentOpm > previousOpm) {
                    const opmChange = calculatePercentageChange(currentOpm, previousOpm);
                    report[symbol].OpmInc = {
                        proof: `${previousOpm} -> ${currentOpm}`,
                        changePercent: opmChange,
                    };
                }
            }

            // Analyze Operating Profit
            const operatingProfitIndex = results.findIndex(d => d[0] === 'Operating Profit');
            if (operatingProfitIndex !== -1) {
                const currentOperatingProfit = parseFloat(results[operatingProfitIndex][results[operatingProfitIndex].length - 1]);
                const previousOperatingProfit = parseFloat(results[operatingProfitIndex][results[operatingProfitIndex].length - 2]);
                if (currentOperatingProfit > previousOperatingProfit) {
                    const operatingProfitChange = calculatePercentageChange(currentOperatingProfit, previousOperatingProfit);
                    report[symbol].OperatingProfitInc = {
                        proof: `${previousOperatingProfit} -> ${currentOperatingProfit}`,
                        changePercent: operatingProfitChange,
                    };
                }
            }

            // Analyze Sales
            const salesIndex = results.findIndex(d => d[0] === 'Sales +' || d[0] === 'Revenue');
            if (salesIndex !== -1) {
                const currentSales = parseFloat(results[salesIndex][results[salesIndex].length - 1]);
                const previousSales = parseFloat(results[salesIndex][results[salesIndex].length - 2]);
                if (currentSales > previousSales) {
                    const salesChange = calculatePercentageChange(currentSales, previousSales);
                    report[symbol].SalesInc = {
                        proof: `${previousSales} -> ${currentSales}`,
                        changePercent: salesChange,
                    };
                }
            }

            // Analyze Net Profit
            const netProfitIndex = results.findIndex(d => d[0] === 'Net Profit +');
            if (netProfitIndex !== -1) {
                const currentNetProfit = parseFloat(results[netProfitIndex][results[netProfitIndex].length - 1]);
                const previousNetProfit = parseFloat(results[netProfitIndex][results[netProfitIndex].length - 2]);
                if (currentNetProfit > previousNetProfit) {
                    const netProfitChange = calculatePercentageChange(currentNetProfit, previousNetProfit);
                    report[symbol].netProfitInc = {
                        proof: `${previousNetProfit} -> ${currentNetProfit}`,
                        changePercent: netProfitChange,
                    };
                }
            }

            // Analyze Shareholding
            const promoterIndex = shareHolding.findIndex(d => d[0] === 'Promoters +');
            if (promoterIndex !== -1) {
                const currentPromoter = parseFloat(shareHolding[promoterIndex][shareHolding[promoterIndex].length - 1].replace('%', ''));
                const previousPromoter = parseFloat(shareHolding[promoterIndex][shareHolding[promoterIndex].length - 2].replace('%', ''));
                if (currentPromoter > previousPromoter) {
                    const promoterChange = calculatePercentageChange(currentPromoter, previousPromoter);
                    report[symbol].promoterInc = {
                        proof: `${previousPromoter} -> ${currentPromoter}`,
                        changePercent: promoterChange,
                    };
                }
            }

            const fiiIndex = shareHolding.findIndex(d => d[0] === 'FIIs +');
            if (fiiIndex !== -1) {
                const currentFii = parseFloat(shareHolding[fiiIndex][shareHolding[fiiIndex].length - 1].replace('%', ''));
                const previousFii = parseFloat(shareHolding[fiiIndex][shareHolding[fiiIndex].length - 2].replace('%', ''));
                if (currentFii > previousFii) {
                    const fiiChange = calculatePercentageChange(currentFii, previousFii);
                    report[symbol].fiiInc = {
                        proof: `${previousFii} -> ${currentFii}`,
                        changePercent: fiiChange,
                    };
                }
            }

            const diiIndex = shareHolding.findIndex(d => d[0] === 'DIIs +');
            if (diiIndex !== -1) {
                const currentDii = parseFloat(shareHolding[diiIndex][shareHolding[diiIndex].length - 1].replace('%', ''));
                const previousDii = parseFloat(shareHolding[diiIndex][shareHolding[diiIndex].length - 2].replace('%', ''));
                if (currentDii > previousDii) {
                    const diiChange = calculatePercentageChange(currentDii, previousDii);
                    report[symbol].diiInc = {
                        proof: `${previousDii} -> ${currentDii}`,
                        changePercent: diiChange,
                    };
                }
            }

            responseReport.push(report);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`error for symbol  ${allData[i]} =  ${error}`)
        }
    }
     return responseReport;
}



const generateHtmlPage = async () => {
    const headers = ["Current Price", "PE", "Sales +/ Revenue", "Operating Profit", "Net Profit +", "OPM %", "Promoters +", "FIIs +", "DIIs +"];
    const metrics = ["price", "pe", "SalesInc", "OperatingProfitInc", "netProfitInc", "OpmInc", "PromotersInc", "fiiInc", "diiInc"];

    const data = await generateReport();
    
    function generateHTMLTable(data) {
        let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Company Performance</title>
    <style>
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid black; padding: 8px; text-align: center; }
      th { background-color: #f2f2f2; }
    </style>
  </head>
  <body>
    <table>
      <thead>
        <tr>
          <th>Company Name</th>`;

        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });

        html += `</tr>
      </thead>
      <tbody>`;
        data.forEach(company => {
            const companyName = Object.keys(company)[0];
            const companyData = company[companyName];

            html += `<tr>
      <td>${companyName}</td>`;

            metrics.forEach(metric => {
                if (companyData[metric]) {
                    html += `<td>${companyData[metric].changePercent ? companyData[metric].changePercent : companyData[metric] }</td>`;
                } else {
                    html += `<td></td>`;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody>
    </table>
  </body>
  </html>`;

        return html;
    }

    const htmlContent = generateHTMLTable(data);
    generateExcelFile(data);

    fs.writeFileSync('stockreports/table.html', htmlContent, 'utf8');
    console.log('HTML page generated successfully!');
}


const generateExcelFile = async (data) => {
    const headers = [ "Symbols","Current Price", "PE", "Sales +/ Revenue", "Operating Profit", "Net Profit +", "OPM %", "Promoters +", "FIIs +", "DIIs +"];
    const metrics = ["price", "pe", "SalesInc", "OperatingProfitInc", "netProfitInc", "OpmInc", "PromotersInc", "fiiInc", "diiInc"];
    // const data = await generateReport(); // Assuming this function retrieves your data
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock Reports");

    // Add headers
    worksheet.addRow(headers);

    // Add data rows
    data.forEach((company) => {
        const companyName = Object.keys(company)[0];
        const companyData = company[companyName];

        const rowData = [companyName];
        metrics.forEach((metric) => {
            rowData.push(companyData[metric] ? companyData[metric].changePercent || companyData[metric] : "");
        });

        worksheet.addRow(rowData);
    });

    // Save the excel file
    await workbook.xlsx.writeFile("stockreports/report.xlsx");
    console.log("Excel file generated successfully!");
};




module.exports = { createPages, generateReport, generateHtmlPage, generateExcelFile };