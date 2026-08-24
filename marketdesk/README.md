# MarketDesk

An AI market newspaper. Twice a day — 08:00 and 20:00 IST — it reads every
exchange filing for a configurable watchlist, researches the market on the web
through an agentic LLM loop, and publishes one edition: a screener dashboard,
a page per company, and the same thing emailed, pushed and sent to Telegram.

Admin-only. Self-contained in this folder — see `DEPENDENCIES.md`.

## How it fits together

```
every 10 min                          08:00 / 20:00 IST
─────────────                         ──────────────────
NSE announcements                     buildEdition
      │                                     │
      ▼  upsert on fingerprint              ├─ per company: agent loop
  md_filings ──────────────────────────────▶│    tools: get_company_filings,
      │  (unique index = exactly once)      │           web_search, get_price
      ▼                                     │    → md_company_snapshots
  filingAnalysis                            │
   summary + sentiment                      ├─ market pass: agent loop
   + materiality 0-100                      │    tools: web_search, get_price,
      │                                     │           get_news, get_watchlist
      ▼  score ≥ threshold                  │
  instant alert                             ▼
  (push / telegram)                    md_editions  ──▶ deliverEdition
                                       {date, slot}      email · telegram · push
                                       unique index      (idempotent per channel)
```

The two halves are split on cost. Ingest is cheap and frequent, and summarises
each filing **once** into `md_filings`. The twice-daily build then reads those
stored summaries — it never re-opens a PDF, which is what keeps an edition to a
few cents even with a large watchlist.

## Swapping the LLM provider

```bash
LLM_PROVIDER=gemini      # or openai, openrouter
```

`llm/` exposes one contract — `chat()`, `search()`, `capabilities` — and each
adapter absorbs its vendor's dialect: message roles, tool-declaration format,
JSON-mode support. Nothing above `llm/` knows which vendor is live.

Prove it before trusting it:

```bash
node marketdesk/scripts/llm-smoke.js --provider=gemini
node marketdesk/scripts/llm-smoke.js --provider=openai
```

Both run the same three exercises: plain chat, structured JSON, and a
tool-calling round trip.

### Why web_search is not an ordinary tool

Gemini rejects a request carrying both `google_search` and custom
`functionDeclarations`. So `web_search` looks like a normal tool to the model,
but its handler calls `provider.search()`, which issues a **separate** request
with only the grounding tool attached. Two consequences worth knowing:

- Search backend and chat model are configured independently. `LLM_PROVIDER=openai`
  with `MARKETDESK_SEARCH_PROVIDER=gemini-grounding` is a valid, useful setup.
- Providers with no native grounding fall back to `search/httpSearch.js`
  (Tavily or Serper) with no change above the `llm/` layer.

## Running it by hand

```bash
node marketdesk/scripts/seed-watchlist.js            # from your Portfolio holdings
node marketdesk/scripts/ingest.js --days=2           # run twice: 2nd inserts 0
node marketdesk/scripts/analyze-pending.js --limit=5 # run twice: 2nd processes 0
node marketdesk/scripts/build-edition.js --slot=AM --dry-run --html=out.html
node marketdesk/scripts/build-edition.js --slot=AM --force --deliver
node marketdesk/scripts/run-agent.js --task="What moved Indian markets today?"
```

## API

All admin-gated except `/cron/run`, which is token-gated.

```
GET  /api/marketdesk/status                     health, counts, config summary
GET  /api/marketdesk/editions                   archive
GET  /api/marketdesk/editions/latest
GET  /api/marketdesk/editions/:date/:slot
GET  /api/marketdesk/editions/:date/:slot/html  exactly what was emailed
POST /api/marketdesk/editions/build             {date, slot, force, deliver, dryRun}
POST /api/marketdesk/editions/:id/deliver       {force, only:["email"]}
GET  /api/marketdesk/companies                  screener rows
GET  /api/marketdesk/companies/:symbol
GET  /api/marketdesk/companies/:symbol/filings
GET|PUT  /api/marketdesk/watchlist
POST /api/marketdesk/watchlist/seed
GET|PUT  /api/marketdesk/config
GET  /api/marketdesk/runs  ·  /runs/:id         agent traces
POST /api/marketdesk/ingest
POST /api/marketdesk/cron/run?slot=AM           external trigger
```

## Things that are easy to get wrong

**Editions cannot double-send.** `md_editions` has a unique index on
`{date, slot}`, and each delivery channel stamps its own `sentAt`. Building again
does not re-send; re-sending does not rebuild.

**Filings cannot double-process.** NSE serves a rolling window, so every poll
returns the same filings. `md_filings.fingerprint` is unique, and inserts use
`$setOnInsert`, so a repeat poll is a no-op.

**Alerts cannot repeat.** `alertedAt` is claimed with a conditional update before
any send, so a crash mid-send costs one alert rather than causing a loop.

**A sleeping host still gets its edition.** Render's free tier spins down when
idle, so an in-process 08:00 rule can simply never fire. `catchUpOnBoot()` asks
on startup which slots are past due with no ready edition, and builds them. Set
`MARKETDESK_CRON_TOKEN` and ping `POST /cron/run?slot=AM` if you want a
guarantee rather than a recovery.

**Quiet companies are free.** A company with no new filings carries its previous
snapshot forward marked `stale` and spends no tokens.

## Model choice and rate limits

Defaults are `gemini-3.5-flash-lite` (fast, balanced) and `gemini-3.5-flash`
(deep). Three things were learned the hard way and are worth not relearning:

- **Do not default to 2.5.** Google now answers 404 "no longer available to new
  users" for `gemini-2.5-flash-lite` on freshly issued keys, and closed
  `gemini-2.5-pro` outright. A 2.5 default works until the next key is minted.
- **Do not use the `-latest` aliases.** `gemini-flash-latest` returned 503 "high
  demand" and took 213s when it did answer — unusable for a scheduled job.
- **Pro is not available on free tier at all** (429 on `gemini-2.5-pro` and
  `gemini-pro-latest`). Point `LLM_MODEL_DEEP` at a pro model once billing is on.

### The quota is per day, per model, per project

Free tier allows **20 requests per day per model per project** — less than a
single edition needs. Two mechanisms make this survivable:

- **Key rotation.** `GEMINI_API_KEYS` takes a comma-separated pool. On a 429 (or
  a 404 for a model that project has not been given), the provider advances to
  the next key and remembers which one worked. Keys from *different projects*
  are genuinely separate allowances; a second key on the same project is not.
  Because the cap is per model, `deep` pointing at a different model than `fast`
  also stops the two tiers competing for one allowance.
- **Pacing.** `LLM_MIN_INTERVAL_MS` (default `3500`, about 17 req/min) gates all
  outbound calls process-wide. Set it to `0` on a paid key.

429 retries wait for the server's own `retryDelay`, except when the violation is
a *daily* cap — Gemini still says "retry in 33s" when the quota resets tomorrow,
so that case fails fast and rotates instead of burning the retry budget.

If a configured model is retired, the tier degrades (deep → balanced → fast).

### Google Search grounding needs billing

Grounded search returns a bare `RESOURCE_EXHAUSTED` on free-tier keys — no quota
detail, no allowance. Until billing is enabled, either leave
`MARKETDESK_SEARCH_PROVIDER=none` (the agent is simply not offered `web_search`,
rather than being handed a tool that always fails) or set a `TAVILY_API_KEY` /
`SERPER_API_KEY` and switch the backend. With search off, company entries still
work — they are built from stored filing analyses — but the market brief is thin.

## Cost

Roughly $0.05–0.15 per edition for ~30 companies on Gemini Flash tiers. Turn it
down via `limits.filingsPerCompany`, `limits.maxIterations`,
`limits.companyConcurrency` in settings, and cap it hard with
`LLM_MAX_USD_PER_RUN` — the budget guard refuses the next call rather than
overshooting. Actual spend is recorded on every edition and every agent run.
