import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { authTools, handleAuthTool } from "./tools/auth.js";
import { notesTools, handleNotesTool } from "./tools/notes.js";
import { remindersTools, handleRemindersTool } from "./tools/reminders.js";
import { expensesTools, handleExpensesTool } from "./tools/expenses.js";

// ─── Server setup ────────────────────────────────────────────────────────────

const server = new Server(
  { name: "noteit-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// All tools from every domain
const allTools = [
  ...authTools,
  ...notesTools,
  ...remindersTools,
  ...expensesTools,
];

// Map tool name → its handler for fast lookup
const toolHandlers = new Map([
  ...authTools.map((t) => [t.name, (args) => handleAuthTool(t.name, args)]),
  ...notesTools.map((t) => [t.name, (args) => handleNotesTool(t.name, args)]),
  ...remindersTools.map((t) => [t.name, (args) => handleRemindersTool(t.name, args)]),
  ...expensesTools.map((t) => [t.name, (args) => handleExpensesTool(t.name, args)]),
]);

// ─── Handlers ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const handler = toolHandlers.get(name);
  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: "${name}"` }],
      isError: true,
    };
  }

  return handler(args);
});

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

// Let the user know the server is live (goes to stderr so it doesn't pollute stdio)
process.stderr.write(
  "[noteit-mcp] Server started. Available tools: " +
    allTools.map((t) => t.name).join(", ") +
    "\n"
);
