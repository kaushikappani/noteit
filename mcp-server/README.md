# Noteit MCP Server

A Model Context Protocol (MCP) server that exposes the Noteit backend as tools Claude can call directly — notes, reminders, expenses, and authentication.

---

## File Structure

```
mcp-server/
├── src/
│   ├── index.js          ← MCP server entry point (stdio transport)
│   ├── api-client.js     ← HTTP client + cookie/token management
│   └── tools/
│       ├── auth.js       ← 6 auth tools
│       ├── notes.js      ← 9 notes tools
│       ├── reminders.js  ← 2 reminder tools
│       └── expenses.js   ← 3 expense tools
├── .env.example
├── package.json
└── README.md
```

---

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# URL of your running Noteit backend
NOTEIT_API_URL=http://localhost:5000
```

### 3. Add to Claude Code config

Open your Claude Code MCP settings (`~/.claude/claude_desktop_config.json` or equivalent) and add:

```json
{
  "mcpServers": {
    "noteit": {
      "command": "node",
      "args": ["c:/Users/AppaniKaushik/Desktop/projects/noteit/mcp-server/src/index.js"],
      "env": {
        "NOTEIT_API_URL": "http://localhost:5000"
      }
    }
  }
}
```

### 4. Start your Noteit backend

Make sure the backend is running before using the MCP server:

```bash
cd ..
npm start
```

---

## Running & Testing

### Option 1 — MCP Inspector (recommended for development)

The MCP Inspector is an interactive browser UI that lets you call every tool manually without Claude.

```bash
cd mcp-server
npx @modelcontextprotocol/inspector node src/index.js
```

It will print two URLs:

```
Proxy server listening on port 3000
Open inspector at http://localhost:5173
```

Open `http://localhost:5173` in your browser. You will see all 20 tools listed on the left. Click any tool, fill in the inputs, and hit **Run Tool** to test it live.

**Typical test flow in the inspector:**

1. Run `auth_status` → should say "not logged in"
2. Run `login` with your email + password → should say "Logged in as ..."
3. Run `get_notes` → should return your notes list
4. Run `create_note` with a title and content → note created
5. Run `get_reminders` → list active reminders
6. Run `get_expenses` → list expenses with total

---

### Option 2 — Claude Code (production use)

Add the server to your Claude Code config as shown in the Setup section, then restart Claude Code. The tools appear automatically and Claude can call them when you ask things like:

- *"Show me all my notes"*
- *"Create a note titled Meeting Summary with ..."*
- *"Add a reminder for tomorrow at 9am to call the client"*
- *"Log a ₹500 food expense for today"*
- *"Delete expense with id ..."*

---

### Option 3 — Manual smoke test (no UI)

If you just want to verify the server starts without errors:

```bash
cd mcp-server
node src/index.js
```

You should see on stderr:

```
[noteit-mcp] Server started. Available tools: login, register, logout, ...
```

The process will then sit waiting for JSON-RPC input on stdin (that is normal — Claude/inspector sends input through stdin).

---

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Cannot reach Noteit backend` | Start the backend first: `npm start` from the project root |
| `Not logged in` error on any tool | Call `login` first |
| `Please verify your account` on `create_note` | Check your email and click the verification link |
| Port conflict on inspector | Pass a custom port: `npx @modelcontextprotocol/inspector --port 3001 node src/index.js` |

---

## Authentication

All tools except `login`, `register`, and `forgot_password` require you to be logged in first.

The JWT token is stored **in memory** for the lifetime of the MCP server process — call `login` once per session and all subsequent tool calls will be authenticated automatically.

---

## Available Tools (20 total)

### Auth

| Tool | Input | Description |
|------|-------|-------------|
| `login` | `email`, `password` | Login and store session token |
| `register` | `name`, `email`, `password` | Create a new account |
| `logout` | — | Logout and clear the stored token |
| `get_profile` | — | Get current user info (name, email, verified) |
| `forgot_password` | `email` | Send a password reset email |
| `auth_status` | — | Check whether you are currently logged in |

### Notes

| Tool | Input | Description |
|------|-------|-------------|
| `get_notes` | — | List all non-archived notes (first 150 chars of content) |
| `get_archived_notes` | — | List all archived notes |
| `get_shared_notes` | — | List notes shared with you by other users |
| `get_note` | `id`, `history?` | Get a single note. `history`: `h0` (current), `h1`/`h2`/`h3` (older versions) |
| `create_note` | `title`, `content`, `category?` | Create a new note (account must be email-verified) |
| `update_note` | `id`, `title`, `content`, `category?`, `color?`, `pinned?`, `archived?` | Update note content or toggle pinned/archived state |
| `delete_note` | `id` | Permanently delete a note you own |
| `share_note` | `id`, `userEmail` | Share a note with another Noteit user |
| `generate_ai_summary` | `id` | Append a Gemini AI summary to the note content |

### Reminders

| Tool | Input | Description |
|------|-------|-------------|
| `get_reminders` | — | List all active (non-expired) reminders |
| `add_reminder` | `description`, `date` | Create a reminder. `date` in ISO 8601 format e.g. `2025-03-01T10:30:00` |

### Expenses

| Tool | Input | Description |
|------|-------|-------------|
| `get_expenses` | — | List all expenses with a running total |
| `add_expense` | `cost`, `category`, `description`, `date?` | Record a new expense |
| `delete_expense` | `id` | Soft-delete an expense (marks inactive) |

---

## Architecture

```
Claude / AI Client
       │
       │  stdio (JSON-RPC)
       ▼
 MCP Server (this app)
       │
       │  HTTP fetch + JWT cookie
       ▼
 Noteit Backend (port 5000)
       │
       ▼
 MongoDB + Redis
```

- **Transport**: stdio — the MCP server runs as a subprocess of the Claude client
- **Auth mechanism**: Cookie-based JWT. The `login` tool captures the `Set-Cookie` response header and replays it on all subsequent requests
- **No business logic**: the MCP server is a pure thin wrapper — all logic lives in the Noteit backend
