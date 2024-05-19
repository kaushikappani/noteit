const redis = require("redis");

const client = redis.createClient({
    url: process.env.REDIS_URL,
    legacyMode: true
});
client.on("ready", () => console.log("redis connected"))

client.on('error', (err) => {
    console.error(`Redis Error: ${err}`);
});

client.connect();

module.exports = client;