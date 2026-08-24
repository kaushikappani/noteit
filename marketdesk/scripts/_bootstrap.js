/**
 * Shared CLI bootstrap. Loads the host app's .env from the repo root regardless
 * of the directory the script was invoked from, and optionally opens Mongo.
 */

const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");

require("dotenv").config({ path: path.join(ROOT, ".env") });

async function connectMongo() {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) return mongoose;
    await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log("[marketdesk] mongo connected");
    return mongoose;
}

async function closeMongo() {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/** Minimal --key=value / --flag parser, so the CLIs need no dependency. */
function args(argv = process.argv.slice(2)) {
    const out = { _: [] };
    for (const a of argv) {
        if (a.startsWith("--")) {
            const [k, v] = a.slice(2).split("=");
            out[k] = v === undefined ? true : v;
        } else out._.push(a);
    }
    return out;
}

/** Wrap a script body so it always exits with a sane code and closes Mongo. */
function run(main) {
    main(args())
        .then(async () => { await closeMongo(); process.exit(0); })
        .catch(async (err) => {
            console.error("\n[marketdesk] FAILED:", err?.stack || err);
            await closeMongo();
            process.exit(1);
        });
}

module.exports = { ROOT, connectMongo, closeMongo, args, run };
