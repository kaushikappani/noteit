const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const asyncHandler = require("express-async-handler");
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

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        try {
            token = req.cookies.token;
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decode.id).select("-password");

            // Check if the token in Redis matches the one in the request
            await client.get(decode.id, (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }

                if (result !== token) {
                    console.log('Token mismatch');
                    res.clearCookie("token").status(401).json({ message: "Authorization failed: Token mismatch" });
                    return;
                }

                // Token is valid, proceed to the next middleware
                next();
            });
        } catch (err) {
            console.error(err);
            res.clearCookie("token").status(401).json({ message: "Authorization failed: Invalid token" });
        }
    } else {
        res.status(401).json({ message: "Authorization failed: No token provided" });
    }
});

module.exports = { protect };
