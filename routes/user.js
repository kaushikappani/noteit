const express = require("express");
const bcrypt = require("bcryptjs")
const router = express.Router();
const asyncHandler = require("express-async-Handler");
const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const { protect } = require("../middleware/protect");
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d"
    })
}
//   /api/users
router.route("/").post(asyncHandler(async (req, res) => {
    const { name, email, password, pic } = req.body;
    const userExists = await User.findOne({ email });
    const salt = await bcrypt.genSalt(11);
    hashPassword = await bcrypt.hash(password, salt);
    if (userExists) {
        res.status(400);
        throw new Error("User already exist")
    }
    const newUser = new User({
        name, email, password: hashPassword, pic
    })
    newUser.save().then((u) => {
        res.status(200).json({
            _id: u.id, name: u.name, email: u.email, token: generateToken(u._id)
        })
    }).catch((e) => {
        res.status(400);
        throw new Error("Error Occured try later")
    })
}))
router.route("/login").post(asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email })
    if (user) {
        bcrypt.compare(password, user.password, (err, data) => {
            if (data) {
                res.json({
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    pic: user.pic,
                    token: generateToken(user._id)
                })
            } if (!data) {
                res.status(400)
                res.json({ message: "invalid crendientials" })
            }
        })
    } else {
        res.status(400)
        throw new Error("User not found")
    }
}))
router.route("/").get((req, res) => {
    res.send("jello ")
})
router.route("/info").get(protect, asyncHandler(async (req, res) => {
    res.send(req.user);
}))

router.route("/info").put(protect, asyncHandler(async (req, res) => {
    console.log("put request")
    const { email, password, name, conformPassword } = req.body;
    const user = await User.findById(req.user._id);
    console.log(req.user)
    if (user) {
        console.log("put request found")
        user.name = name || user.name;
        user.email = email || user.email;
        if (password && password === conformPassword) {
            console.log("pas block sier")
            const salt = await bcrypt.genSalt(11);
            const hashPassword = await bcrypt.hash(password, salt);
            user.password = hashPassword;
        }
        const updatedUser = await user.save();
        res.json({ message: "Profile Updated" })
    } else {
        res.status(404);
        throw new Error("User Not Found");
    }
}))

module.exports = router