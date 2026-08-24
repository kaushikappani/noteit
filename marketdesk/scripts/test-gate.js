/**
 * Self-check for the admin gate. Needs no Mongo and no Redis: it mounts the
 * router into a bare Express app and confirms every route refuses a caller with
 * no session, which is the one property that must never regress.
 *
 *   node marketdesk/scripts/test-gate.js
 */

require("./_bootstrap");

const express = require("express");
const cookieParser = require("cookie-parser");
const http = require("http");
const { mountMarketDesk } = require("..");

const app = express();
app.use(express.json());
app.use(cookieParser());
mountMarketDesk(app, { scheduler: false });

const server = app.listen(0, async () => {
    const { port } = server.address();

    const hit = (path, opts = {}) => new Promise((resolve) => {
        const req = http.request(
            { port, path, method: opts.method || "GET", headers: opts.headers || {} },
            (res) => {
                let body = "";
                res.on("data", (d) => (body += d));
                res.on("end", () => resolve({ status: res.statusCode, body: body.slice(0, 90) }));
            }
        );
        req.on("error", (e) => resolve({ status: 0, body: e.message }));
        if (opts.body) req.write(JSON.stringify(opts.body));
        req.end();
    });

    const cases = [
        ["GET  /status           no cookie", await hit("/api/marketdesk/status")],
        ["GET  /editions/latest  no cookie", await hit("/api/marketdesk/editions/latest")],
        ["GET  /companies/INFY   no cookie", await hit("/api/marketdesk/companies/INFY")],
        ["GET  /runs             no cookie", await hit("/api/marketdesk/runs")],
        ["PUT  /config           no cookie", await hit("/api/marketdesk/config", { method: "PUT", body: {} })],
        ["POST /editions/build   no cookie", await hit("/api/marketdesk/editions/build", { method: "POST", body: {} })],
        ["POST /cron/run         no token ", await hit("/api/marketdesk/cron/run", { method: "POST" })],
        ["POST /cron/run         bad token", await hit("/api/marketdesk/cron/run", {
            method: "POST", headers: { "x-marketdesk-token": "wrong" },
        })],
    ];

    console.log("");
    let pass = true;
    for (const [label, res] of cases) {
        // 401 unauthenticated, 403 not an admin, 404 cron trigger not enabled.
        const denied = [401, 403, 404].includes(res.status);
        if (!denied) pass = false;
        console.log(`${denied ? "PASS" : "FAIL"}  ${label} -> ${res.status} ${res.body}`);
    }

    console.log(pass
        ? "\nAll routes refuse an unauthenticated caller."
        : "\nSOME ROUTES LEAK — fix before deploying.");

    server.close();
    process.exit(pass ? 0 : 1);
});
