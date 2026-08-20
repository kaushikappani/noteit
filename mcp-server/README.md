# Noteit MCP Server

A Model Context Protocol (MCP) server that exposes the Noteit backend as tools — notes, reminders, expenses, and authentication.

It runs two ways, chosen by config:

| Mode | Transport | Where it runs |
|------|-----------|---------------|
| **stdio** (default) | JSON-RPC over stdin/stdout | Local subprocess of the MCP client |
| **http** | Streamable HTTP + legacy SSE | Hosted — mounted into the Noteit app at `/mcp`, or standalone |

When Noteit deploys, the HTTP mode is mounted into the same Express app, so it is live at:

```
https://noteit-prod2.onrender.com/mcp          ← streamable HTTP (current spec)
https://noteit-prod2.onrender.com/mcp/sse      ← legacy SSE, for older clients
```

---

## File Structure

```
mcp-server/
├── src/
│   ├── index.js          ← entry point; picks the transport from MCP_TRANSPORT
│   ├── server.js         ← createNoteitServer() — one server + one API client per session
│   ├── http.js           ← streamable-HTTP / SSE handlers (framework-agnostic)
│   ├── api-client.js     ← createApiClient() — per-session HTTP client + JWT
│   └── tools/
│       ├── auth.js       ← 6 auth tools
│       ├── notes.js      ← 9 notes tools
│       ├── reminders.js  ← 2 reminder tools
│       └── expenses.js   ← 3 expense tools
├── .env.example
├── package.json
└── README.md
```

The Express glue lives outside this folder, in [`../middleware/mcp.js`](../middleware/mcp.js), and is mounted from [`../app.js`](../app.js).

---

## Configuration

Everything is env-driven. Copy `.env.example` to `.env` for local runs; on Render set these in the environment group.

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTEIT_API_URL` | `http://127.0.0.1:$PORT`, else `http://localhost:5000` | Backend **origin** the tools call. `/notesv2` is a React route, not an API prefix — do not include it. |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http`. Aliases: `sse`, `streamable-http`. |
| `MCP_PORT` | `$PORT`, else `5100` | Port for standalone `http` mode only. |
| `MCP_PATH` | `/mcp` | Path MCP is served under, standalone and mounted. |
| `MCP_JSON_RESPONSE` | `true` | Reply to POSTs with plain JSON instead of an SSE stream. Survives compressing/buffering proxies; set `false` for spec-preferred streaming. |
| `MCP_SESSION_TTL_MS` | `1800000` (30 min) | Idle HTTP sessions are closed, dropping their cached JWT. |
| `MCP_ALLOWED_ORIGIN` | `*` | CORS origin, standalone `http` mode. |
| `MCP_HTTP_ENABLED` | `true` | Set to `false` in the **root** `.env` to stop `app.js` mounting `/mcp`. |

The transport can also be forced per-run with a flag, which beats the env var:

```bash
node src/index.js --http
node src/index.js --stdio
```

---

## Mode 1 — stdio (local)

```bash
cd mcp-server
npm install
cp .env.example .env      # set NOTEIT_API_URL
```

Claude Code / Claude Desktop config:

```json
{
  "mcpServers": {
    "noteit": {
      "command": "node",
      "args": ["d:/projects/noteit/mcp-server/src/index.js"],
      "env": {
        "NOTEIT_API_URL": "https://noteit-prod2.onrender.com",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Point `NOTEIT_API_URL` at `http://localhost:5500` instead to work against a local backend.

---

## Mode 2 — http (hosted)

### Mounted into the Noteit app (how production works)

Nothing to run separately. `app.js` mounts the handlers at `MCP_PATH`, so a single Render service serves both the app and MCP. Requirements, all already in place:

- `@modelcontextprotocol/sdk` is a **root** dependency — Render's build only runs `npm install` at the repo root, and `mcp-server/node_modules` is gitignored.
- `/mcp` is exempt from `compression()` — gzip buffers SSE frames and stalls the stream.
- `/mcp` is exempt from the 60-POST/min rate limiter — MCP is JSON-RPC over POST and a tool-heavy session blows straight past it.
- The mount is registered **before** the production `app.get("*")` catch-all, or the SPA index would swallow it.
- `NOTEIT_API_URL` can stay unset; the client loops back to `http://127.0.0.1:$PORT`.
- **`DOMAIN` must be the public URL** (`https://noteit-prod2.onrender.com`). `start_login` builds its browser login URL from it, so a stale `DOMAIN` sends users to the wrong host.

Client config for a remote server:

```json
{
  "mcpServers": {
    "noteit": {
      "type": "http",
      "url": "https://noteit-prod2.onrender.com/mcp"
    }
  }
}
```

### Standalone

Useful for testing the HTTP path without booting Mongo/Redis:

```bash
cd mcp-server
npm run start:http          # or: MCP_TRANSPORT=http npm start
```

```
[noteit-mcp] http transport ready on :5100 — streamable /mcp, legacy sse /mcp/sse — ...
```

Standalone mode also serves `GET /health`, returning the active session count.

---

## Sessions and authentication

All tools except `start_login`, `check_login`, and `forgot_password` require a login.

Login is a browser device-code flow — no password in chat:

1. `start_login` → returns a URL (`$DOMAIN/mcp-login?code=…`) and a code, valid 5 minutes
2. The user opens it and logs in; the page exchanges the code for a token
3. `check_login` with that code → the token is stored for the session

**Each session gets its own API client and its own JWT.** In stdio mode there is exactly one session for the process lifetime. In HTTP mode a session is created per `initialize` and keyed by `Mcp-Session-Id`, so concurrent users never see each other's login. Idle sessions are swept after `MCP_SESSION_TTL_MS`.

### The token never leaves the server

`generateToken` in `routes/user.js` signs a **365-day** JWT, and it is the *same* credential the web app uses — not an MCP-scoped one. Being stateless, it cannot be revoked: `logout` only clears a cookie, so the sole way to kill an escaped copy is rotating `JWT_SECRET`, which signs out every other user too.

So it is never returned to the client. It goes browser → backend → Redis → this server's session and stops there. The chat only ever carries the `code`, which is single-use and expires in 5 minutes — no password and no token passes through the model, the chat UI, or an inference provider's logs.

The consequence is that **the session is the login**. Nothing else holds it, so how long a user stays signed in is exactly how long their session survives, which is why `MCP_SESSION_TTL_MS` defaults to 30 days. In exchange, a session id is itself a month-long bearer credential for that account — it is not bound to an IP or a client, so treat it as the secret it is. Anything that ends the session (a deploy, a restart, an eviction) costs that user another browser login; there is no recovery path by design.

### Why the session cap exists

A 30-day TTL means the sweeper no longer bounds the map, so `MCP_MAX_SESSIONS` does. The eviction *order* is the security-relevant part: opening a session needs no credentials, and `/mcp` is exempt from the app's rate limiter, so anyone can create them for free. Under a plain least-recently-used cap, a few hundred anonymous `initialize` calls would evict every signed-in user — a cheap denial of login. Sessions that never authenticated are therefore given up first, so a flood spends the attacker's own sessions instead of someone's month-old login. Evicting an authenticated session is logged as such, and means the cap is genuinely too low.

---

## Testing

### MCP Inspector

```bash
cd mcp-server
npm run inspect                                    # stdio
npx @modelcontextprotocol/inspector                # then connect to a URL for http mode
```

Typical flow: `auth_status` → `start_login` → open the URL → `check_login` → `get_notes`.

**Pick the URL to match the transport — the two are not interchangeable:**

| Inspector "Transport Type" | URL to use |
|---|---|
| Streamable HTTP *(preferred)* | `https://noteit-prod2.onrender.com/mcp` |
| SSE *(legacy clients only)* | `https://noteit-prod2.onrender.com/mcp/sse` |

Choosing **SSE** with the plain `/mcp` URL is the one combination guaranteed to fail: `/mcp` speaks streamable HTTP, where a session is opened by `POST initialize`, so a bare `GET` has no session to attach to and is refused. It surfaces in the Inspector as `SSE error: Non-200 status code`. Either switch the transport to Streamable HTTP or add `/sse` to the URL.

Remote connectors (Claude custom connectors and the like) should be given the streamable URL and no auth — this server authenticates inside the session via `start_login`, not at the transport. The OAuth discovery paths under `/.well-known/` deliberately answer 404 so a probing client learns there is no OAuth to do; without that they hit the React catch-all and get `200 text/html`, which reads as a broken auth server rather than an absent one.

### Against the hosted endpoint

```bash
curl -i https://noteit-prod2.onrender.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

Grab `Mcp-Session-Id` from the response headers and send it back on every subsequent call:

```bash
curl -s https://noteit-prod2.onrender.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <id>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

---

### Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Cannot reach Noteit backend at …` | Backend not running, or `NOTEIT_API_URL` wrong. It must be an origin — no `/notesv2` suffix. |
| `400 Missing mcp-session-id header` | The first request must be `initialize`; reuse the returned `Mcp-Session-Id` afterwards. On a bare `GET`, it means an SSE-transport client was pointed at `/mcp` — use `/mcp/sse`, or switch it to streamable HTTP. |
| `SSE error: Non-200 status code` | Same thing: SSE transport aimed at `/mcp`. See the transport/URL table above. |
| `404 Unknown or expired MCP session` | Session swept after 30 days idle, evicted at `MCP_MAX_SESSIONS`, or the server restarted. Re-initialize and log in again. |
| Asked to log in again after a while | The session ended. Check `MCP_SESSION_TTL_MS` is not still set to an old short value in the deploy's env, and that the *client* isn't discarding session ids sooner than the server does — in the TL;DR extension that's `SESSION_TTL_MS` in `mcp.js`. |
| Everyone logged out at once | A deploy or restart — session state is in-memory. Or `MCP_MAX_SESSIONS` is too low: check the logs for `evicted at cap … must log in again`. |
| `406 Not Acceptable` | Client must send `Accept: application/json, text/event-stream`. |
| SSE connects but no events arrive | Something is buffering the stream. Leave `MCP_JSON_RESPONSE=true`, and keep `/mcp` out of `compression()`. |
| `/mcp` returns the SPA HTML | Mount moved below `app.get("*")` in `app.js`. |
| `429 Too many requests` on `/mcp` | The rate-limiter exemption for `MCP_PATH` was removed. |
| Login URL points at localhost | `DOMAIN` is not set to the public URL. |
| `Cannot find package '@modelcontextprotocol/sdk'` on Render | It must be in the **root** `package.json`, not only `mcp-server/package.json`. |

---

## Available Tools (20 total)

### Auth

| Tool | Input | Description |
|------|-------|-------------|
| `start_login` | — | Start the browser login flow; returns a URL and a code |
| `check_login` | `code` | Exchange the code for a session token once the user has logged in |
| `logout` | — | Logout and clear the stored token |
| `get_profile` | — | Get current user info (name, email, verified) |
| `forgot_password` | `email` | Send a password reset email |
| `auth_status` | — | Check whether this session is logged in |

### Notes

| Tool | Input | Description |
|------|-------|-------------|
| `get_notes` | — | List all non-archived notes |
| `get_archived_notes` | — | List all archived notes |
| `get_shared_notes` | — | List notes shared with you by other users |
| `get_note` | `id`, `history?` | Get a single note. `history`: `h0` (current), `h1`/`h2`/`h3` (older versions) |
| `create_note` | `title`, `content`, `category?` | Create a new note (account must be email-verified) |
| `update_note` | `id`, `title`, `content`, `category?`, `color?`, `pinned?`, `archived?` | Update content or toggle pinned/archived |
| `delete_note` | `id` | Permanently delete a note you own |
| `share_note` | `id`, `userEmail` | Share a note with another Noteit user |
| `generate_ai_summary` | `id` | Append a Gemini AI summary to the note content |

### Reminders

| Tool | Input | Description |
|------|-------|-------------|
| `get_reminders` | — | List all active (non-expired) reminders |
| `add_reminder` | `description`, `date` | Create a reminder. `date` in ISO 8601, e.g. `2025-03-01T10:30:00` |

### Expenses

| Tool | Input | Description |
|------|-------|-------------|
| `get_expenses` | — | List all expenses with a running total |
| `add_expense` | `cost`, `category`, `description`, `date?` | Record a new expense |
| `delete_expense` | `id` | Soft-delete an expense (marks inactive) |

---

## Architecture

```
        stdio                                    HTTP
  ┌───────────────────┐            ┌──────────────────────────────┐
  │ Claude Code       │            │ Claude web / desktop / any    │
  │ (local subprocess)│            │ remote MCP client             │
  └─────────┬─────────┘            └──────────────┬───────────────┘
            │ stdin/stdout                        │ POST/GET /mcp
            │ JSON-RPC                            │ Mcp-Session-Id
            ▼                                     ▼
   src/index.js --stdio              app.js → middleware/mcp.js → src/http.js
            │                                     │
            └──────────────┬──────────────────────┘
                           ▼
              src/server.js — createNoteitServer()
              one Server + one API client per session
                           │
                           │ HTTP fetch, Cookie: token=<jwt>
                           ▼
                    Noteit backend (/api/…)
                           │
                           ▼
                     MongoDB + Redis
```

- **No business logic here** — every tool is a thin wrapper over a Noteit REST endpoint, so all auth and validation stays in the backend.
- **`src/http.js` never imports express.** `mcp-server/` resolves express 5 while the Noteit app runs express 4, and a Router built by one cannot be mounted into the other. It exports plain `(req, res)` handlers instead; `middleware/mcp.js` wires them with the app's own express, and standalone mode uses `node:http`.
