const express = require("express");
const bcrypt = require("bcryptjs")
const router = express.Router();
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { User } = require("../config/models");
const { protect } = require("../middleware/protect");
const mail = require("nodemailer");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// google 


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "360d"
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
    const options = {
        httpOnly: true,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    
    newUser.save().then((u) => {
        const token = generateToken(u._id);
        const id = u._id;
        const verificationToken = jwt.sign({ id }, process.env.JWT_SECRET_VERIFICATION);
        res.cookie("token", token, options).status(200).json({
            name: u.name,
            email: u.email,
        });
        const msg = {
          to: email,
          from: "kaushikappani@gmail.com", // Use the email address or domain you verified above
          subject: "NoteIt - Account Verification",
          text: "Click the following link to verify your link",
          html: `<strong><a href="https://noteit1.herokuapp.com/confirm/${verificationToken}">https://noteit1.herokuapp.com/confirm/${verificationToken}</a></strong>`,
        };
        sgMail.send(msg).then(
            () => { },
            (error) => {
                console.error(error);

                if (error.response) {
                    console.error(error.response.body);
                }
            }
        );

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
                const options = {
                    httpOnly: true,
                    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                };
                const token = generateToken(user._id, process.env.JWT_SECRET);
                res.cookie("token", token, options).json({
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    pic: user.pic,
                });
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

router.route("/info").get(protect, asyncHandler(async (req, res) => {
    res.send(req.user).select("-_id");
}))

router.route("/info").put(protect, asyncHandler(async (req, res) => {
    console.log("put request")
    const { email, password, name, conformPassword } = req.body;
    const user = await User.findById(req.user._id);
    console.log(req.user)
    if (user) {
        console.log("put request found")
        user.name = name || user.name;
        user.email = user.email;
        if (password && password === conformPassword) {
            const salt = await bcrypt.genSalt(11);
            const hashPassword = await bcrypt.hash(password, salt);
            user.password = hashPassword;
            res.json({ message: "Password Updated" });
        }
        const updatedUser = await user.save();
        if (email != user.email) {
            res.json({ message: "Profile Updated - Email Cant be updated" });
        }
        res.json({ message: "Profile Updated" })
    } else {
        res.status(404);
        throw new Error("User Not Found");
    }
}))

router.route("/confirm/:id").get(asyncHandler(async (req, res) => {
    console.log("------------------confirm-------------------------")
    console.log("token", req.params.id);
    console.log("secret",process.env.JWT_SECRET_VERIFICATION)
    try {
        token = req.params.id;
        console.log("token",token)
        const decode = jwt.verify(token, process.env.JWT_SECRET_VERIFICATION);
        console.log("decode",decode);
        
        user = await User.findById(decode.id).select("-password");
        user.verified = true;
        user.save();
        res.json({ message: "Verified" })
    } catch (err) {
        console.log(err)
        res.status(401);
        throw new Error("Token failed")
    }
}))
router.route("/verifytoken").get(protect, asyncHandler(async (req, res) => {
    res.status(202).send("protected");
}))

router.route("/forgotpassword").post(
  asyncHandler(async (req, res) => {
    const generateToken = (id) => {
      return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
    };
    const { email } = req.body;
    const user = await User.findOne({ email });
      if (user) {
          console.log(user);
          const token = generateToken(
              user._id,
              process.env.JWT_SECRET_FORGOTPASSWORD
          );
          console.log(token);
          const msg = {
            to: email,
            from: "kaushikappani@gmail.com", // Use the email address or domain you verified above
            subject: "NoteIt - Password Reset Link",
            text: "Click the following link to verify your link",
            html: `<strong><a href="https://noteit1.herokuapp.com/passwordreset/${token}">https://noteit1.herokuapp.com/passwordreset/${token}</a></strong>`,
          };
          sgMail.send(msg).then(
            () => {},
            (error) => {
              console.error(error);

              if (error.response) {
                console.error(error.response.body);
              }
            }
          );
          res.status(200);
          res.json({message:"email sent"})
      } else {
          res.status(400);
          res.json({message:"User not found"})
      }

  })
);
router.route("/resetpassword/:id").post(asyncHandler(async (req, res) => {
    const id = req.params.id;
    console.log("id", id);
    const { password, conformpassword } = req.body;
    console.log(password, conformpassword);
    if (password === conformpassword) {
        const decode = jwt.verify(id, process.env.JWT_SECRET);
        const salt = await bcrypt.genSalt(11);
        hashPassword = await bcrypt.hash(password, salt);
        let user = await User.findOneAndUpdate({_id:decode.id},{password:hashPassword});
        res.status(200);
        res.json({ message: "Password changed" });
    } else {
        res.status(400);
        throw new Error("New passwod and conform password match");
    }

}))
router.route("/logout").get(asyncHandler(async (req, res) => {

    res.clearCookie("token").status(202).send("logout");
}))

router.route("/googleauth").post(asyncHandler(async (req, res) => {
    
    res.json({ success: true });
}))
module.exports = router