# How the Noteit MCP setup fits together

Three independent pieces. Noteit does not know the extension exists, and the
extension does not know Noteit exists — they meet over plain MCP.

```
┌────────────────────┐   MCP / JSON-RPC over HTTP   ┌──────────────────────────┐
│  Any MCP client    │ ───────────────────────────► │  Noteit MCP server       │
│  (TL;DR extension, │                              │  mcp-server/src/         │
│   Claude Desktop,  │ ◄─────────────────────────── │  20 tools                │
│   inspector, …)    │      tool results + _meta    └───────────┬──────────────┘
└────────────────────┘                                          │ HTTP + cookie
                                                                ▼
                                                  ┌──────────────────────────┐
                                                  │  Noteit REST API         │
                                                  │  routes/*.js  + Mongo    │
                                                  │  + Redis                 │
                                                  └──────────────────────────┘
```

The MCP server is a **translator, not a data store**. Every tool turns into an
ordinary call to the Noteit REST API with the user's JWT replayed as a cookie —
the same API the web app uses, with the same `protect` middleware in front.

## Where it runs

Two ways, same code:

| Mode | Entry point | Used for |
| --- | --- | --- |
| **Mounted** (production) | `middleware/mcp.js` mounts the handlers into the Express app at `/mcp` | The deployed server |
| **Standalone** | `node mcp-server/src/index.js` (`--http` or stdio) | Local dev, Claude Desktop, the inspector |

Transports: streamable HTTP at `/mcp` (current spec) and legacy SSE at
`/mcp/sse` + `/mcp/messages`. Replies default to plain JSON — SSE through a
compressing proxy is where hosted MCP usually breaks.

## Signing in

Nobody types a password into a chat. It is a device-code flow with **two**
secrets, which is the part worth understanding.

```
 client                MCP server                 Noteit API              browser
   │  start_login          │                          │                      │
   ├──────────────────────►│  GET /mcp/auth           │                      │
   │                       ├─────────────────────────►│  mint code + secret  │
   │  login URL (code)     │◄─────────────────────────┤  store sha256(secret)│
   │◄──────────────────────┤  keeps the secret        │                      │
   │                       │                          │   user opens URL     │
   │                       │                          │◄─────────────────────┤
   │                       │                          │  POST /mcp/exchange  │
   │                       │                          │  (cookie-authed)     │
   │  check_login          │                          │                      │
   ├──────────────────────►│  GET /mcp/token          │                      │
   │                       │  ?code=…&secret=…        │                      │
   │                       ├─────────────────────────►│  returns the JWT,    │
   │  ✅ + _meta credential │◄─────────────────────────┤  burns the code      │
   │◄──────────────────────┤  mints a grant           │                      │
```

- **`code`** rides in the login URL, so it ends up in the chat and in the model's
  prompt. It cannot be kept quiet — the user has to click it.
- **`secret`** never leaves the MCP server's session memory. Redeeming needs
  both, so reading the URL back out of a transcript buys nothing.
- The **JWT** (365-day account token) never goes to the client and is never
  printed. It lives in the per-session API client.

## Staying signed in

The problem this solves: the session map is process memory, the deployment is
Render's free plan, and a free plan stops the process after ~15 idle minutes.
Every cold start used to be a silent mass logout — the client dutifully replayed
a session id the new process had never heard of, got a 404, re-handshook into a
fresh signed-out session, and the user logged in again with a token that was
still good for eleven more months.

So the login moved out of process memory:

```
check_login  ──►  mint grant key "nk_…"
                  store sha256(key) → { jwt } in Redis, 365d
                  hand the key to the client in the result's `_meta`

every later   ──►  Authorization: Bearer nk_…
request           server looks it up, binds the JWT to whatever session
                  this client happens to be on now
```

`_meta` is out-of-band by design: the client renders `content` into the prompt
and reads `_meta` separately, so the credential never reaches the model.

What survives what:

| Event | Session id | Login |
| --- | --- | --- |
| MV3 service worker torn down | survives (storage.local) | survives |
| MCP server restart / redeploy | lost, re-handshakes | **survives** (grant) |
| Second instance / no sticky routing | lost, re-handshakes | **survives** (grant) |
| Session evicted at the 500 cap | lost, re-handshakes | **survives** (grant) |
| `logout` tool | kept | revoked, both ends |

A grant is revocable; the raw JWT is not. That is the other reason to hand out a
grant rather than the token itself.

## This does not couple the two projects

- **Any MCP client works.** Clients that ignore `_meta` — Claude Desktop, the
  inspector, stdio — get exactly the old session-bound behaviour, unchanged.
  Nothing in `mcp-server/` mentions the extension.
- **The extension is generic.** It implements "if a server sends a `_meta`
  credential, store it and replay it", with no mention of Noteit. Any MCP server
  can use the same convention.
- **The wire format is ordinary.** The grant is a standard
  `Authorization: Bearer` header, so a client that can set a static header can
  use one too.

The `mcp.client/credential` `_meta` key is a convention these two agree on, not a
spec feature, and neither side requires the other to implement it.

## Storage

| What | Where | Lifetime |
| --- | --- | --- |
| Account JWT | Redis `login:<platform>:<id>`, cookie | 365 days, revoked on logout |
| Pending login code | Redis `mcp_auth:<code>` (secret hashed) | 5 minutes, single use |
| Grant | Redis `mcp_grant:<sha256(key)>` | 365 days, revoked by `logout` |
| MCP session | MCP server process memory | 30 days idle, cap 500 |
| Grant key (client copy) | `chrome.storage.local` — never `.sync` | until revoked |
| Session id (client copy) | `chrome.storage.local` | 30 days |

## Config

Everything has a working default; see `.env.example`. The ones that matter:

- `NOTEIT_API_URL` — backend origin. Unset when mounted (loops back to `$PORT`).
- `MCP_PATH` — defaults to `/mcp`.
- `MCP_ALLOWED_ORIGINS` — extra browser origins allowed to drive `/mcp`. No
  Origin, browser extensions, and the server's own origin are always allowed;
  other web pages are refused.
- `MCP_HTTP_ENABLED=false` — don't mount `/mcp` at all.

Standalone mode keeps grants in memory rather than Redis, so they die with the
process. Fine for stdio and local work; the mounted build is the one people log
into.
