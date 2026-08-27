# MarketDesk — usage

Admin-only. Sign in as the account in `MARKETDESK_ADMIN_EMAILS`; everyone else
gets a 403 from the server regardless of what the browser shows.

| Page | URL |
| --- | --- |
| Screener dashboard | `/marketdesk` |
| Company snapshot | `/marketdesk/company/INDHOTEL` |
| One edition | `/marketdesk/edition/2026-08-24/PM` |
| Settings | `/marketdesk/settings` |

Also in the avatar dropdown, visible only to your account.

---

## What happens without you

| When | What |
| --- | --- |
| Every 10 min, 06:00–24:00 | Poll NSE, store new filings for watchlist companies, analyse up to 5, alert anything scoring ≥ threshold |
| Every hour | Refresh the corporate-actions calendar |
| 08:00 IST | Build + send the morning edition |
| 20:00 IST | Build + send the evening edition |
| On restart | Build any slot already past due with no edition (covers a sleeping host) |

You only need the buttons below to look at something early, or to fix something.

---

## Screener dashboard — `/marketdesk`

| Control | What it does |
| --- | --- |
| **Refresh** | Re-reads the latest edition from the database. No LLM calls, no cost. |
| **Rebuild now** | Regenerates the current slot's edition from scratch and replaces it. Costs money (~$0.02) and takes 2–5 min. Does **not** re-send email. |
| **Hide quiet** | Hides companies with no new filings this window. On by default. The count in the label tells you how many are hidden. |
| **Sort** | Most material (default) · Symbol A–Z · Sentiment. |
| **A company row** | Opens that company's snapshot. |

The number badge on each row is **materiality, 0–100**: 0–20 routine, 40–60
notable, 70–84 significant, 85+ critical. Colour follows the band. The small dot
is sentiment — green positive, red negative, grey neutral.

A red **"Market section unverified"** banner means no price or news lookup
succeeded for that edition, so the market commentary is not backed by fetched
data. Company entries come from exchange filings and are unaffected.

---

## Company snapshot — `/marketdesk/company/:symbol`

| Control | What it does |
| --- | --- |
| **Analysis** tab | The AI entry for the latest edition: headline, bullets, web digest, risks. |
| **Filings** tab | Every filing on record for this company. |
| **History** tab | Previous editions' entries, so you can see how the story moved. |
| **Click a filing** | Expands its stored summary, materiality reason, and a link to the PDF. |
| **Open filing ↗** | The original NSE document. |

"Carried forward, no new filings" means nothing was filed this window, so the
previous entry was reused at zero cost. "Summarised from headline only" means the
PDF could not be read (usually a scan) and the score came from the NSE
description instead.

---

## One edition — `/marketdesk/edition/:date/:slot`

| Control | What it does |
| --- | --- |
| **Re-send** | Sends this edition again on every enabled channel, ignoring the already-sent stamps. Use after fixing a delivery failure. |
| **View as email ↗** | The exact HTML that was emailed. |
| Delivery line | Per-channel send time, or `not sent` / `failed`. |

Normal sending is idempotent — an edition never emails twice on its own. Re-send
is the deliberate override.

---

## Settings — `/marketdesk/settings`

Changes save on blur. No submit button.

### System (read-only)
Active provider, search backend, watchlist size, filings stored, **pending
analysis**, editions built. If pending analysis stays above zero, LLM quota is
your bottleneck, not the polling interval.

| Control | What it does |
| --- | --- |
| **Run ingest now** | Fires the 10-minute job immediately: poll NSE, store new filings, analyse up to 5, send alerts. Use after adding a company. |

### Watchlist
| Control | What it does |
| --- | --- |
| **Save watchlist** | Replaces the list. Commas, spaces or newlines all work. Only these companies are ever ingested or analysed. |
| **Top up from portfolio** | Adds symbols from your holdings without removing anything you added by hand. |

### Schedule
Morning hour · Evening hour · Ingest interval · Alert materiality threshold.
Changing an hour reschedules immediately — no restart. A filing at or above the
threshold triggers a push and Telegram alert straight away instead of waiting
for the next edition.

### Delivery
Per-channel switches: email, telegram, push, in-app, tweet.

### Market topics
One per line. These drive what the market brief researches each run.

### Models
Fast (filing analysis) · Balanced (company pass) · Deep (market brief). Empty
means the provider default. Free-tier Gemini allows 20 requests/day **per
model**, so pointing Deep at a different model than Fast gives each its own
allowance. API keys and the provider are environment variables, not editable here.

### Cost controls
Filings per company · Max tool iterations · Company concurrency. Lower these to
make each edition cheaper. The hard ceiling is `LLM_MAX_USD_PER_RUN`.

---

## Command line

Same operations without the browser, useful before 08:00 or when debugging.

```bash
node marketdesk/scripts/seed-watchlist.js --symbols=ITC,INFY --replace
node marketdesk/scripts/ingest.js --days=2              # run twice: 2nd inserts 0
node marketdesk/scripts/analyze-pending.js --limit=5
node marketdesk/scripts/build-edition.js --slot=PM --dry-run --html=out.html
node marketdesk/scripts/build-edition.js --slot=PM --force --deliver
node marketdesk/scripts/llm-smoke.js --provider=openai  # prove a provider swap
node marketdesk/scripts/test-gate.js                    # prove the admin gate holds
```

`--dry-run` builds and prints without saving or sending. `--force` replaces an
existing edition. `--deliver` sends it.

---

## If something looks wrong

| Symptom | Cause |
| --- | --- |
| Dashboard says no edition | None built yet — press **Rebuild now**, or check the watchlist is not empty |
| Everything marked quiet | No filings since the last edition. Real, not a bug |
| "Market section unverified" | No price or news lookup succeeded — see search config below |
| Pending analysis climbing | LLM daily quota exhausted; add a key to `GEMINI_API_KEYS` |
| Thin market narrative | No search backend. Free fix: `MARKETDESK_SEARCH_PROVIDER=google` with `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` (100 queries/day, no billing) |
| Email not arriving | Check `mailerConfigured` on the settings page |
| Telegram says sent but nothing arrived | The host helper swallows its own errors; usually Redis being unreachable |

Every edition records what the agent actually did. `GET /api/marketdesk/runs`
lists runs; `/runs/:id` shows each iteration's tool calls, results and tokens —
that is how you tell a real finding from a model guess.
