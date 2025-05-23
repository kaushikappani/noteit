const express = require("express");
const bcrypt = require("bcryptjs")
const router = express.Router();
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { User, NoteAccess,Note } = require("../config/models");
const { protect } = require("../middleware/protect");
const { mailer, readFile } = require("../middleware/mailer")
const cloudinary = require('cloudinary').v2;
const fs = require("fs")
const { upload } = require("../middleware/multer");
const client = require("../middleware/redis");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "365d"
    })
}
//   /api/users
router.route("/").post(asyncHandler(async (req, res) => {
    const { name, email, password, pic,platform } = req.body;
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
    newUser.pic = "https://res.cloudinary.com/dvg2fdn9e/image/upload/v1715348789/profilepic/pxp09vk4f5c1q01fipua.webp";
    const ttlMilliseconds365Days = 365 * 24 * 60 * 60 * 1000;
    const options = {
        httpOnly: true,
        secure: true,
        expires: new Date(Date.now() + ttlMilliseconds365Days),
    };

    newUser.save().then(async (u) => {
        const token = generateToken(u._id);
        const id = u._id;
        let platformKey = "web";
        if (platform === "mobile") {
            platformKey = "mobile"
        }
        const key = `login:${platformKey}:${id}`;
        value = token + "";

        await client.set(key, value, 'PX', ttlMilliseconds365Days,(err, data) => {
            if (err) {
                console.log(err)
            }
        })
       
        const verificationToken = jwt.sign({ id }, process.env.JWT_SECRET_VERIFICATION, {
            expiresIn: "1h"
        });

        const ttlMilliseconds1Hr = 1 * 60 * 60 * 1000; // 3600000 milliseconds for 1 hour
        const verificaitonKey = email + "_verification";
        const  verificationTokenValue = verificationToken + "";
        await client.set(verificaitonKey, verificationTokenValue, 'PX', ttlMilliseconds1Hr,(err, data) => {
            if (err) {
                console.log(err)
            }
        })
        const mailTemplate = await readFile("../templates/verify_account_email.txt");
        const mailHtml = mailTemplate.replace("#{link}", `${process.env.DOMAIN}/confirm/${verificationToken}`);

        const recipent = {
            name, email
        }
        const mailBody = {
            subject: "NoteIt - Account Verification",
            text: "Click the following link to verify your link",
            html: mailHtml,
        }

        mailer(recipent, mailBody)

        res.cookie("token ", token, options).status(200).json({
            name: u.name,
            email: u.email,
        });

    }).catch((e) => {
        res.status(400);
        throw new Error("Error Occured try later")
    })
}))
router.route("/login").post(asyncHandler(async (req, res) => {
    const { email, password ,platform} = req.body;
    const user = await User.findOne({ email })
    if (user) {
        bcrypt.compare(password, user.password, async (err, data) => {
            if (data) {
                const ttlMilliseconds365Days = 365 * 24 * 60 * 60 * 1000;

                const options = {
                    httpOnly: true,
                    secure: true ,
                    expires: new Date(Date.now() + ttlMilliseconds365Days),
                };
                const token = generateToken(user._id);
                
                let platformKey = "web";
                if (platform === "mobile") {
                    platformKey = "mobile"
                }

                const key = `login:${platformKey}:${user._id}`;
                value = token + "";
                await client.set(key, value, 'PX',ttlMilliseconds365Days,(err, data) => {
                    if (err) {
                        console.log("error while saving", err);
                    }
                })
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
    let response = req.user;
    response._id = null;
    res.send(response);
}))

router.route("/info").put(protect, asyncHandler(async (req, res) => {
    const { email, password, name, conformPassword } = req.body;
    client.del(`user:${req.user._id}`); 
    const user = await User.findById(req.user._id);
    if (user) {
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

    try {
        token = req.params.id;

        const decode = jwt.verify(token, process.env.JWT_SECRET_VERIFICATION);
        console.log("decode", decode);
        let user = await User.findById(decode.id).select("-password");
        console.log(user);
        await client.get(user.email +"_verification", (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).json({ message: "Link Expired please try again" });
                return;
            }
            if (token != result) {
                console.error(err);
                res.status(500).json({ message: "Link Expired please try again" });
                return;
            }
            user.verified = true;
            client.del(`user:${decode.id}`); 
            user.save();
            console.log(user);
            res.json({ message: "Profile Verified" })
        })
  
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
            return jwt.sign({ id }, process.env.JWT_SECRET_FORGOTPASSWORD, {
                expiresIn: "10m",
            });
        };
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            const token = generateToken(user._id);
            const recipent = {
                name: user.name,
                email: user.email
            }
            const mailTemplate = await readFile("../templates/reset_password_email.txt");
            const mailHtml =  mailTemplate.replace("#{link}", `${process.env.DOMAIN}/passwordreset/${token}`);
            const mailBody = {
                subject: "NoteIt - Password Reset Link",
                text: "Click the following link to change your password",
                html: mailHtml
            }
            
            try {
                mailer(recipent, mailBody);
            } catch (err) {
            }

            res.status(200);
            res.json({ message: "email sent" })
        } else {
            res.status(400);
            res.json({ message: "User not found" })
        }

    })
);
router.route("/resetpassword/:id").post(asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { password, conformpassword } = req.body;
    if (password === conformpassword) {
        const decode = jwt.verify(id, process.env.JWT_SECRET_FORGOTPASSWORD);
        const salt = await bcrypt.genSalt(11);
        hashPassword = await bcrypt.hash(password, salt);
        let user = await User.findOneAndUpdate({ _id: decode.id }, { password: hashPassword });
        res.status(200);
        res.json({ message: "Password changed" });
    } else {
        res.status(400);
        throw new Error("New passwod and conform password match");
    }

}))

router.route("/:id/access/users").get(protect, asyncHandler(async (req, res) => {
    
    const note = await Note.findById(req.params.id)
        .select("-color")
        .select("-archived")
        .select("-pinned");
    
    if (note.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error("Oops! No Access to View");
    }
    
    const noteAccess = await NoteAccess.find({ note: note.id,isActive:true });
    let users = [];
    for (const access of noteAccess) {
        const user = await User.findById(access.user).select("-password").select("-_id");
        const accessedUser = {
            email: user.email,
            name: user.name
        }
        users.push(accessedUser);
    }
    res.status(200).json(users);

}))

router.route("/:id/revoke/:user").put(protect, asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id)
        .select("-color")
        .select("-archived")
        .select("-pinned");

    if (note.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error("Oops! No Access");
    }
    const user = await User.findOne({ email: req.params.user }).select("-password");
    if (user == null) {
        res.status(401);
        throw new Error("User Not Found");
    }
    await NoteAccess.findOneAndUpdate({ note: note.id, user: user._id ,isActive:true},{ isActive:false});
    res.status(200).json({ message: "Access revoked to "+user.email });


}))

router.route("/logout").get(asyncHandler(async (req, res) => {

    res.clearCookie("token").status(202).send("logout");
}))

router.route("/verification/link").post(protect,asyncHandler(async (req, res) => {
    
    const id = req.user._id;
    const verificationToken = jwt.sign({ id }, process.env.JWT_SECRET_VERIFICATION);
    

    const mailTemplate = await readFile("../templates/verify_account_email.txt");
    const mailHtml = mailTemplate.replace("#{link}", `${process.env.DOMAIN}/confirm/${verificationToken}`);
    const mailBody = {
        subject: "NoteIt - Account Verification",
        text: "Click the following link to verify your link",
        html: mailHtml,
    }
    const verificaitonKey = req.user.email + "_verification";
    const verificationTokenValue = verificationToken + "";
    const ttlMilliseconds1Hr = 1 * 60 * 60 * 1000;

    await client.set(verificaitonKey, verificationTokenValue, 'PX', ttlMilliseconds1Hr, (err, data) => {
        if (err) {
            console.log(err)
        }
    })
    const recipent = {
        name: req.user.name,
        email: req.user.email
    }
    mailer(recipent, mailBody)

    res.status(200).json({ message: "Verification email sent to " + req.user.email });

}))

router.route("/upload/profile/pic").post(protect, upload.single('profilePicture'), asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    client.del(`user:${req.user._id}`); 
    let result = null;
    try {
        result = await cloudinary.uploader.upload(req.file.path, { public_id: `profilepic/${user._id}`, secure: true });
        
    } catch (e) {
        console.log("Error While Uploading pic " + e)
        throw new Error("Error While Uploading pic")

    }
    finally {
        if (req.file) {
            await fs.unlinkSync(req.file.path);
        }
    }
    if (user && result) {
        user.pic = result.url;
        await user.save();
    }
    console.log(result);
    res.json({message: "Profile Uploaded"});

}))

module.exports = router