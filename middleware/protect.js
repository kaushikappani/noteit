const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const asyncHandler = require("express-async-handler");
const redis = require("redis");
const client = require("./redis");

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        try {
            token = req.cookies.token;
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decode.id).select("-password");

            // Check if the token in Redis matches the one in the request
            await client.get(decode.id+"_login", (err, result) => {
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


const stockProtect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        try {
            token = req.cookies.token;
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decode.id).select("-password");

            // Check if the token in Redis matches the one in the request
            await client.get(decode.id+"_login", (err, result) => {
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

                if (req.user.email === 'kaushikappani@gmail.com') {
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
