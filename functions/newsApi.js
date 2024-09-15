const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

const getTopHeadLines = async (country, category) => {
    
    newsapi.v2.sources({
        language: 'en',
        country: 'in'
    }).then(response => {
        /*
          {
            status: "ok",
            sources: [...]
          }
        */
    });
    
    return 'data';
}

module.exports = { getTopHeadLines };



