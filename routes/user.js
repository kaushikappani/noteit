const express = require("express");
const bcrypt = require("bcryptjs")
const router = express.Router();
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { User, NoteAccess, Note } = require("../config/models");
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
    const { name, email, password, pic, platform } = req.body;
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

        await client.set(key, value, 'PX', ttlMilliseconds365Days, (err, data) => {
            if (err) {
                console.log(err)
            }
        })

        const verificationToken = jwt.sign({ id }, process.env.JWT_SECRET_VERIFICATION, {
            expiresIn: "1h"
        });

        const ttlMilliseconds1Hr = 1 * 60 * 60 * 1000; // 3600000 milliseconds for 1 hour
        const verificaitonKey = email + "_verification";
        const verificationTokenValue = verificationToken + "";
        await client.set(verificaitonKey, verificationTokenValue, 'PX', ttlMilliseconds1Hr, (err, data) => {
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
    const { email, password, platform } = req.body;
    const user = await User.findOne({ email })
    if (user) {
        bcrypt.compare(password, user.password, async (err, data) => {
            if (data) {
                const ttlMilliseconds365Days = 365 * 24 * 60 * 60 * 1000;

                const options = {
                    httpOnly: true,
                    secure: true,
                    expires: new Date(Date.now() + ttlMilliseconds365Days),
                };
                const token = generateToken(user._id);

                // For mcp platform, store under "web" key so protect middleware finds it
                let platformKey = "web";
                if (platform === "mobile") {
                    platformKey = "mobile";
                }

                const key = `login:${platformKey}:${user._id}`;
                const value = token + "";
                await client.set(key, value, 'PX', ttlMilliseconds365Days, (err) => {
                    if (err) console.log("error while saving", err);
                });

                const responseBody = {
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    pic: user.pic,
                };

                // The MCP login page used to ask for the raw token here, so it
                // could hand it to /mcp/exchange. That put a 365-day bearer of
                // the whole account into a JSON body readable by any script on
                // the page — the exact thing httpOnly on the cookie is for, undone
                // for one caller. It doesn't need it: the cookie this response
                // sets is enough for /mcp/auto-exchange to deposit the token
                // server-side, where it never passes through the browser at all.

                res.cookie("token", token, options).json(responseBody);
            }
            if (!data) {
                res.status(400).json({ message: "invalid credentials" });
            }
        });
    } else {
        res.status(400);
        throw new Error("User not found");
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
        await client.get(user.email + "_verification", (err, result) => {
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
            const mailHtml = mailTemplate.replace("#{link}", `${process.env.DOMAIN}/passwordreset/${token}`);
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

    const noteAccess = await NoteAccess.find({ note: note.id, isActive: true });
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
    await NoteAccess.findOneAndUpdate({ note: note.id, user: user._id, isActive: true }, { isActive: false });
    res.status(200).json({ message: "Access revoked to " + user.email });


}))

router.route("/logout").get(asyncHandler(async (req, res) => {
    // Clearing the cookie only stops *this* browser from sending the token.
    // The token itself stays valid for the rest of its 365 days, and `protect`
    // keeps honouring it as long as the matching login:<platform>:<id> key is
    // in Redis — so a copy taken before logout kept working for a year. Drop
    // the Redis entry that this exact token was issued under, which is what
    // actually ends the session.
    const token = req.cookies && req.cookies.token;
    if (token) {
        try {
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            // Only the key holding *this* token: signing out of the browser
            // should not knock the user's phone or AI client offline as well.
            for (const platform of ["web", "mobile", "mcp"]) {
                const key = `login:${platform}:${decode.id}`;
                await new Promise((resolve) => {
                    client.get(key, (err, stored) => {
                        if (!err && stored === token) client.del(key);
                        resolve();
                    });
                });
            }
            client.del(`user:${decode.id}`);
        } catch (_) {
            // Already expired or tampered with — nothing to revoke, and the
            // cookie still gets cleared below.
        }
    }

    res.clearCookie("token").status(202).send("logout");
}))

router.route("/verification/link").post(protect, asyncHandler(async (req, res) => {

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
    res.json({ message: "Profile Uploaded" });

}))

// ─── MCP OAuth-style Device Code Flow ────────────────────────────────────────
const crypto = require("crypto");

const MCP_AUTH_TTL_SEC = 5 * 60;

/**
 * A pending MCP login is two secrets, not one.
 *
 * The `code` travels in the login URL, and that URL is returned by an MCP tool
 * — so it lands in the AI's prompt, in the chat transcript, and in whatever the
 * model provider logs. It cannot be kept quiet; the user has to click it.
 *
 * `secret` is generated at the same time, never leaves the MCP server, and is
 * required to redeem the token. So the identifier that unavoidably passes
 * through the model is not the one that can be traded for a 365-day account
 * JWT. Before this split, anything that could read the prompt — a prompt
 * injection on a summarised page, a leaked provider log — could redeem it.
 *
 * Only the hash of the secret is stored, so a look at Redis mid-flow is not
 * enough either.
 */
function mcpAuthKey(code) {
    return `mcp_auth:${code}`;
}

/** Codes are UUIDs we minted; anything else never becomes a Redis key. */
function isMcpCode(code) {
    return typeof code === "string" && /^[0-9a-f-]{36}$/i.test(code);
}

function sha256(value) {
    return crypto.createHash("sha256").update(String(value)).digest();
}

function readMcpAuth(code) {
    return new Promise((resolve, reject) => {
        client.get(mcpAuthKey(code), (err, raw) => {
            if (err) return reject(err);
            if (!raw) return resolve(null);
            try {
                resolve(JSON.parse(raw));
            } catch (_) {
                // A record written by the previous release. It has no secret, so
                // it cannot be redeemed under the new rules — let it expire.
                resolve(null);
            }
        });
    });
}

function writeMcpAuth(code, record) {
    return new Promise((resolve, reject) => {
        client.set(mcpAuthKey(code), JSON.stringify(record), "EX", MCP_AUTH_TTL_SEC, (err) =>
            err ? reject(err) : resolve()
        );
    });
}

function secretMatches(record, provided) {
    if (!record || !record.secretHash || typeof provided !== "string" || !provided) return false;
    const expected = Buffer.from(record.secretHash, "hex");
    const actual = sha256(provided);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Park a freshly minted MCP token against a pending code. Shared by both deposit routes. */
async function depositMcpToken(req, res) {
    const { code } = req.body;
    if (!isMcpCode(code)) {
        res.status(400).json({ message: "A valid code is required" });
        return;
    }

    const record = await readMcpAuth(code);
    if (!record) {
        res.status(400).json({ message: "Invalid or expired auth code" });
        return;
    }

    // A token of its own, in a slot of its own, rather than a copy of the
    // browser's cookie. There is exactly one login:web slot per user, so
    // handing the AI client the web token meant the next ordinary sign-in on
    // the website overwrote it and every MCP call started failing — which is
    // most of what "I have to log in again" turned out to be. `protect` now
    // accepts login:mcp too, so the two live side by side and neither logging
    // out of the browser nor logging back into it disturbs the AI client.
    //
    // It is also a fresh 365 days. Depositing the existing cookie could hand
    // over a token with a month left while the grant wrapping it claimed a
    // year.
    // The `platform` claim is not read anywhere — every consumer only wants
    // `id`. It is here to make the payload differ from the web token's, because
    // JWT timestamps are second-granular and this route runs immediately after
    // /login on the MCP login page. Without it the two tokens come out byte
    // identical, both slots hold the same string, and logging out of the
    // browser deletes the AI client's slot as well — reintroducing exactly the
    // coupling the separate slot exists to remove.
    const id = req.user._id;
    const ttlMilliseconds365Days = 365 * 24 * 60 * 60 * 1000;
    const token = jwt.sign({ id, platform: "mcp" }, process.env.JWT_SECRET, { expiresIn: "365d" });

    await new Promise((resolve, reject) => {
        client.set(`login:mcp:${id}`, token, "PX", ttlMilliseconds365Days, (err) =>
            err ? reject(err) : resolve()
        );
    });

    // `protect` has already verified the caller, so this is minted for them and
    // nobody else — the request body has no say in it.
    await writeMcpAuth(code, { ...record, token });

    res.status(200).json({
        message: "Authorized — the AI assistant is now connected.",
        name: req.user.name,
        email: req.user.email,
    });
}

// Step 1 — MCP server calls this to get an auth code + login URL
// GET /api/users/mcp/auth  ->  { code, secret, loginUrl }
router.route("/mcp/auth").get(asyncHandler(async (req, res) => {
    const code = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("base64url");

    await writeMcpAuth(code, { secretHash: sha256(secret).toString("hex"), token: null });

    // Only the code goes in the URL. The secret goes back to the MCP server,
    // which keeps it in session memory and hands it over at redemption time.
    const loginUrl = `${process.env.DOMAIN}/mcp-login?code=${code}`;
    res.status(200).json({ code, secret, loginUrl });
}));

// Step 2 — the MCP login page calls this once the user has signed in.
// POST /api/users/mcp/exchange  body: { code }
//
// Kept as an alias of /mcp/auto-exchange so an older deployed frontend build
// keeps working. It used to be unauthenticated and to trust a token straight
// out of the request body, which meant anyone holding a pending code could
// deposit a JWT of their choosing and point someone's AI at their account. Any
// token in the body is now ignored.
router.route("/mcp/exchange").post(protect, asyncHandler(depositMcpToken));

// Same thing, for the page's silent attempt on load when a cookie is already there.
// POST /api/users/mcp/auto-exchange  body: { code }
router.route("/mcp/auto-exchange").post(protect, asyncHandler(depositMcpToken));

// Step 3 — MCP server polls this to collect the token once it is ready.
// GET /api/users/mcp/token?code=<uuid>&secret=<secret>
router.route("/mcp/token").get(asyncHandler(async (req, res) => {
    const { code, secret } = req.query;
    if (!isMcpCode(code)) {
        res.status(400).json({ message: "code query param is required" });
        return;
    }

    const record = await readMcpAuth(code);
    if (!record) {
        res.status(404).json({ message: "Auth code not found or expired" });
        return;
    }

    if (!secretMatches(record, secret)) {
        // Deliberately identical to the not-found answer: whoever is asking
        // without the secret does not get to learn that the code is real.
        res.status(404).json({ message: "Auth code not found or expired" });
        return;
    }

    if (!record.token) {
        // User hasn't logged in yet — tell the MCP server to keep checking.
        res.status(200).json({ status: "pending", message: "Waiting for user to login..." });
        return;
    }

    // Token is ready — hand it over and burn the code (one-time use).
    client.del(mcpAuthKey(code));
    res.status(200).json({ token: record.token });
}));
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router
