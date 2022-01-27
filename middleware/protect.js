const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const asyncHandler = require("express-async-handler");

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.cookies && req.cookies.token) {
        try {
            token = req.cookies.token;
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decode.id).select("-password");
            next();
        } catch (err) {
            console.log('err')
            res.clearCookie("token").status(401);
            throw new Error("Not authorizes, token failed");
        }
    } else {
        res.status(401);
        console.log("err")
        throw new Error("Not authorizes, No token");
    }
})

module.exports = { protect }