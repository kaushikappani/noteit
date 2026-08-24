/**
 * Seed the MarketDesk watchlist from the admin user's existing Portfolio.
 *
 *   node marketdesk/scripts/seed-watchlist.js
 *   node marketdesk/scripts/seed-watchlist.js --email=someone@example.com --replace
 *   node marketdesk/scripts/seed-watchlist.js --symbols=INFY,TCS,ITC --replace
 *
 * Additive by default: symbols already on the watchlist keep their name, sector
 * and active flag, so re-running after buying a new stock only adds the new one.
 */

const { run, connectMongo } = require("./_bootstrap");

run(async (argv) => {
    await connectMongo();

    const { env } = require("../config/settings");
    const { MdWatchlist } = require("../models");
    const { User } = require("../../config/models");
    const { symbolQuantityObject } = require("../../routes/data");

    const email = (argv.email || env.adminEmails[0]).toLowerCase();

    // An explicit list wins over the portfolio: holdings in the app can lag what
    // the broker actually shows, and the watchlist is the thing that decides what
    // gets analysed, so it needs to be settable directly.
    let symbols;
    let origin;
    if (argv.symbols) {
        symbols = String(argv.symbols)
            .split(/[\s,]+/)
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean);
        origin = "explicit list";
    } else {
        const user = await User.findOne({ email });
        if (!user) throw new Error(`no user with email ${email}`);
        const portfolio = await symbolQuantityObject(user._id);
        symbols = Object.keys(portfolio).map((x) => x.trim().toUpperCase());
        origin = `portfolio of ${email}`;
    }

    symbols = [...new Set(symbols)].sort();
    console.log(`${symbols.length} symbols from ${origin}`);
    if (!symbols.length) throw new Error("nothing to seed");

    const existing = await MdWatchlist.findOne({ key: "default" });
    const keep = argv.replace ? [] : (existing?.symbols || []);
    const known = new Map(keep.map((s) => [s.symbol.toUpperCase(), s]));

    let added = 0;
    for (const symbol of symbols) {
        if (known.has(symbol)) continue;
        known.set(symbol, { symbol, active: true, tags: [argv.symbols ? "manual" : "portfolio"] });
        added++;
    }

    const merged = [...known.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));

    await MdWatchlist.findOneAndUpdate(
        { key: "default" },
        { $set: { key: "default", symbols: merged, updatedBy: `seed:${email}` } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`watchlist now has ${merged.length} symbols (${added} added)`);
    console.log(merged.map((s) => s.symbol).join(", "));
});
