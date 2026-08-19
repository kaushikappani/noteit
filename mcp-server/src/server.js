import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createApiClient } from "./api-client.js";
import { authTools, handleAuthTool } from "./tools/auth.js";
import { notesTools, handleNotesTool } from "./tools/notes.js";
import { remindersTools, handleRemindersTool } from "./tools/reminders.js";
import { expensesTools, handleExpensesTool } from "./tools/expenses.js";

export const SERVER_INFO = { name: "noteit-mcp", version: "1.1.0" };

const TOOL_GROUPS = [
  [authTools, handleAuthTool],
  [notesTools, handleNotesTool],
  [remindersTools, handleRemindersTool],
  [expensesTools, handleExpensesTool],
];

export const allTools = TOOL_GROUPS.flatMap(([tools]) => tools);

const handlerByName = new Map(
  TOOL_GROUPS.flatMap(([tools, handle]) => tools.map((t) => [t.name, handle]))
);

/**
 * Build a fresh MCP server bound to its own API client.
 *
 * Called once per transport session — stdio creates exactly one, HTTP creates
 * one per `initialize`. The API client (and therefore the logged-in user's JWT)
 * is scoped to that instance, so concurrent HTTP sessions never share a login.
 */
export function createNoteitServer() {
  const api = createApiClient();

  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    const handle = handlerByName.get(name);
    if (!handle) {
      return {
        content: [{ type: "text", text: `Unknown tool: "${name}"` }],
        isError: true,
      };
    }

    return handle(name, args, api);
  });

  return { server, api };
}
