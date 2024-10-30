const yahooFinance = require('yahoo-finance2').default; 

const getTopIndices =  async() => {
    let usIndices = ['^GSPC', '^DJI', '^IXIC', '^RUT']
    let indianIndices = ['^NSEI', '^BSESN', '^NSEBANK', '^NSEMDCP50', '^CNXIT']
    let indianResponses = [];
    let usResponse = [];
    try {
         usResponse = await yahooFinance.quote(usIndices);
        indianResponses = await yahooFinance.quote(indianIndices);
    } catch (e) {
        console.log(e);
   }

    return { us: usResponse, indian: indianResponses };
}

module.exports = { getTopIndices };