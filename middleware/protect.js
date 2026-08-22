const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const asyncHandler = require("express-async-handler");
const redis = require("redis");
const client = require("./redis");
const util = require('util');
const notificationUsers = require("../config/notificationUsers.json");


const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        try {
            token = req.cookies.token;
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            const getAsync = util.promisify(client.get).bind(client);
            let result = await getAsync(`user:${decode.id}`);
            if (result == null) {
                req.user = await User.findById(decode.id).select("-password");
                client.set(`user:${decode.id}`, JSON.stringify(req.user), 'EX', 3600 * 24); 
            } else {
                req.user = JSON.parse(result);
            }
            // Check if the token in Redis matches the one in the request.
            //
            // "mcp" is its own slot on purpose. It used to be issued into the
            // web slot, which holds exactly one token — so the next ordinary
            // web login overwrote it and every MCP call started failing here
            // with a token mismatch. Signing in on the website should not sign
            // you out of your AI client.
            await client.mget([ "login:web:"+ decode.id, "login:mobile:"+decode.id, "login:mcp:"+decode.id ], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }

                const [loginWebToken, loginMobileToken, loginMcpToken] = result;
                if (loginWebToken !== token && loginMobileToken !== token && loginMcpToken !== token) {
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


const stockProtect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        try {
            token = req.cookies.token;
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            const getAsync = util.promisify(client.get).bind(client);
            let result = await getAsync(`user:${decode.id}`);
            if (result == null) {
                req.user = await User.findById(decode.id).select("-password");
                client.set(`user:${decode.id}`, JSON.stringify(req.user), 'EX', 3600 * 24);
            } else {
                req.user = JSON.parse(result);
            }

            // Check if the token in Redis matches the one in the request.
            // "mcp" is its own slot — see the note in protect above.
            await client.mget(["login:web:" + decode.id, "login:mobile:" + decode.id, "login:mcp:" + decode.id], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }
                const [loginWebToken, loginMobileToken, loginMcpToken] = result;

                if (loginWebToken !== token && loginMobileToken !== token && loginMcpToken !== token) {
                    console.log('Token mismatch');
                    res.clearCookie("token").status(401).json({ message: "Authorization failed: Token mismatch" });
                    return;
                }

                if(notificationUsers.some(user => user.email === req.user.email)) {
                    next();
                    
                }else {
                    res.status(401).json({ message: "Access Denied" });
                }
               
            });
        } catch (err) {
            console.error(err);
            res.clearCookie("token").status(401).json({ message: "Authorization failed: Invalid token" });
        }
    } else {
        res.status(401).json({ message: "Authorization failed: No token provided" });
    }
});

module.exports = { protect, stockProtect };
