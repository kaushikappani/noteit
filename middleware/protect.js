const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const asyncHandler = require("express-async-handler");
const redis = require("redis");
const client = require("./redis");
const util = require('util');


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
            // Check if the token in Redis matches the one in the request
            await client.mget([ "login:web:"+ decode.id, "login:mobile:"+decode.id ], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }
                
                const [loginWebToken, loginMobileToken] = result;
                if (loginWebToken !== token && loginMobileToken!== token ) {
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

            // Check if the token in Redis matches the one in the request
            await client.mget(["login:web:" + decode.id, "login:mobile:" + decode.id], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: "Internal server error" });
                    return;
                }
                const [loginWebToken, loginMobileToken] = result;

                if (loginWebToken !== token && loginMobileToken !== token) {
                    console.log('Token mismatch');
                    res.clearCookie("token").status(401).json({ message: "Authorization failed: Token mismatch" });
                    return;
                }

                if (req.user.email === 'kaushikappani@gmail.com' || req.user.email === 'appani.kaushik@bajajtechnologyservices.com') {
                    next();
                } else {
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
