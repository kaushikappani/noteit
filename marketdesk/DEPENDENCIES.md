# What MarketDesk borrows from the host app

This folder is written to be lifted into its own project. Everything it touches
outside itself is listed here — that list is the work of extraction, and it is
deliberately short.

## Code imports (7 files)

| Host file | Used for | On extraction |
| --- | --- | --- |
| `middleware/protect.js` | `protect` — JWT + Redis session check, sets `req.user` | Keep. Auth is shared by design. |
| `config/models.js` | `User` (push subscriptions, admin lookup), `Portfolio` (watchlist seed) | Replace with an API call or a shared user service. |
| `routes/data.js` | `symbolQuantityObject()` for seeding the watchlist from holdings | Drop, or re-implement against `Portfolio`. |
| `functions/documentToText.js` | `fetchDocumentText()` — PDF to text | Copy in; it is 12 lines. |
| `middleware/mailer.js` | `mailer()` — outbound email | Copy in, or point at any transport. |
| `middleware/sendTelegramMessage.js` | `sendTelegramMessage()` | Copy in. |
| `config/webPush.js` | `sendNotification()` — VAPID web push | Copy in. |

Optional, only when `enabled.tweet` is on: `functions/xService.js`,
`functions/textToImage.js`.

**Not imported on purpose:** `middleware/StockScheduler.js`. Requiring it used to
execute a full NSE fetch plus an LLM pass as an import-time side effect
(`scheduleCoorporateAnnouncments()` at the bottom of the file). Web push goes
straight to `config/webPush.js` instead of through that file's
`triggerNotifications` wrapper.

## Host integration points

- `app.js` — two lines: the `require` and `mountMarketDesk(app)`.
- `noteitfrontend/src/App.js` — four `<Route>` lines.
- `noteitfrontend/src/components/Header.js` — one admin-only nav link.
- `noteitfrontend/src/marketdesk/` — the whole UI subtree, moves with this folder.

## Shared infrastructure

- **Mongo** — via whatever connection the host opened. All collections are
  prefixed `md_`, so nothing here collides with or touches host data.
- **Redis** — only indirectly, inside the borrowed telegram and push helpers.
- **npm dependencies** — installed at the repo root by choice. Everything used:
  `express`, `express-async-handler`, `mongoose`, `axios`, `moment-timezone`,
  `node-schedule`, `stock-nse-india`, `yahoo-finance2`, `pdf-parse`.
  Nothing new was added.

## Environment

Required: `GEMINI_API_KEYS` (or `GEMINI_API_KEY`), `MONGO_URI`, `TIME_ZONE`.
Optional: `LLM_PROVIDER`, `LLM_MODEL_FAST|BALANCED|DEEP`, `GEMINI_API_KEYS`,
`MARKETDESK_SEARCH_PROVIDER`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
`TAVILY_API_KEY`, `SERPER_API_KEY`, `LLM_MAX_USD_PER_RUN`, `LLM_MIN_INTERVAL_MS`,
`MARKETDESK_ADMIN_EMAILS`, `MARKETDESK_CRON_TOKEN`, `MARKETDESK_SCHEDULER`,
`NEWS_API_KEY`.

`MAILER_API_KEY` is required for email — `middleware/mailer.js` posts to an
external service that authenticates with it. It was missing when this module was
built and has since been added to `.env`; a test edition was accepted by Gmail
(`250 2.0.0 OK`). `GET /api/marketdesk/status` reports `mailerConfigured`, and the
settings page warns if it ever goes missing again, so a silent mail outage stays
visible.
