const yahooFinance = require('yahoo-finance2').default; 

const getTopIndices =  async() => {
    let usIndices = ['^GSPC', '^DJI', '^IXIC', '^RUT']
    let indianIndices = ['^NSEI', '^BSESN', '^NSEBANK', '^NSEMDCP50', '^CNXIT']
    
    let usResponse = await yahooFinance.quote(usIndices);
    let indianResponses =await yahooFinance.quote(indianIndices);

    return { us: usResponse, indian: indianResponses };
}

module.exports = { getTopIndices };