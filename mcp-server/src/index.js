#!/usr/bin/env node
/**
 * Noteit MCP server entry point.
 *
 * The transport is chosen by MCP_TRANSPORT:
 *
 *   stdio (default)  — runs as a subprocess of the MCP client (Claude Code, inspector)
 *   http             — standalone HTTP server exposing streamable HTTP + legacy SSE
 *
 * When Noteit itself is deployed, the same handlers are mounted straight into the
 * Express app at /mcp (see app.js) — this file is only needed to run it on its own.
 */
import dotenv from "dotenv";
dotenv.config();

import http from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createNoteitServer, allTools } from "./server.js";
import { resolveBaseUrl } from "./api-client.js";

const STDIO_ALIASES = new Set(["stdio", "std", ""]);
const HTTP_ALIASES = new Set([
  "http",
  "sse",
  "streamable",
  "streamable-http",
  "streamablehttp",
]);

// CLI flag wins over env so `npm run start:http` works on any shell.
const flag = process.argv.slice(2).find((a) => a.startsWith("--"));
const transportName = (flag ? flag.replace(/^--/, "") : process.env.MCP_TRANSPORT || "stdio")
  .trim()
  .toLowerCase();
const mcpPath = normalizePath(process.env.MCP_PATH || "/mcp");

function normalizePath(p) {
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

function log(message) {
  process.stderr.write(`[noteit-mcp] ${message}\n`);
}

/** Read and JSON-parse a request body. Returns undefined for empty/unparseable bodies. */
async function readJsonBody(req) {
  if (req.method !== "POST" && req.method !== "PUT") return undefined;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.MCP_ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Last-Event-ID, Mcp-Session-Id, Mcp-Protocol-Version"
  );
  // Browser clients cannot read the session id back without this.
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

async function startStdio() {
  const { server } = createNoteitServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(
    `stdio transport ready — backend ${resolveBaseUrl()} — ${allTools.length} tools: ` +
      allTools.map((t) => t.name).join(", ")
  );
}

async function startHttp() {
  const port = Number(process.env.MCP_PORT || process.env.PORT || 5100);
  const { createMcpHttpHandlers } = await import("./http.js");

  const ssePath = `${mcpPath}/sse`;
  const messagePath = `${mcpPath}/messages`;

  const handlers = createMcpHttpHandlers({ log, ssePath });

  const server = http.createServer(async (req, res) => {
    applyCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = normalizePath(url.pathname);

    if (pathname === ssePath && req.method === "GET") {
      await handlers.handleSseConnect(req, res, messagePath);
      return;
    }

    if (pathname === messagePath && req.method === "POST") {
      const body = await readJsonBody(req);
      await handlers.handleSseMessage(req, res, body, url.searchParams.get("sessionId"));
      return;
    }

    if (pathname === mcpPath) {
      const body = await readJsonBody(req);
      await handlers.handleStreamable(req, res, body);
      return;
    }

    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sessions: handlers.activeSessions() }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: `Not found. MCP is served at ${mcpPath}` }));
  });

  const shutdown = async () => {
    log("shutting down");
    await handlers.close();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise((resolve) => server.listen(port, resolve));

  log(
    `http transport ready on :${port} — streamable ${mcpPath}, legacy sse ${ssePath} ` +
      `— backend ${resolveBaseUrl()} — ${allTools.length} tools`
  );
}

if (STDIO_ALIASES.has(transportName)) {
  await startStdio();
} else if (HTTP_ALIASES.has(transportName)) {
  await startHttp();
} else {
  log(
    `Unknown MCP_TRANSPORT="${transportName}". Use "stdio" or "http".`
  );
  process.exit(1);
}
