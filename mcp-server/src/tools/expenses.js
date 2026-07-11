import { makeRequest, isAuthenticated, ok, err } from "../api-client.js";

function requireAuth() {
  if (!isAuthenticated()) {
    throw new Error("Not logged in. Call the login tool first.");
  }
}

export const expensesTools = [
  {
    name: "get_expenses",
    description:
      "Get all active expenses for the logged-in user, sorted by date (newest first).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_expense",
    description: "Record a new expense. category should be a simple string supported Values are 'Investments' , 'Needs' , 'Wants', 'Others'.",
    inputSchema: {
      type: "object",
      properties: {
        cost: {
          type: "number",
          description: "Amount spent (e.g. 250.50)",
        },
        category: {
          type: "string",
          description: "Expense category (e.g. Food, Transport, Entertainment)",
        },
        description: {
          type: "string",
          description: "Brief description of the expense",
        },
        date: {
          type: "string",
          description:
            "Date of the expense in ISO 8601 format (e.g. '2025-02-24'). Defaults to today if omitted.",
        },
      },
      required: ["cost", "category", "description"],
    },
  },
  {
    name: "delete_expense",
    description:
      "Soft-delete an expense by ID (marks it inactive, does not permanently remove it).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The expense ID to delete" },
      },
      required: ["id"],
    },
  },
];

export async function handleExpensesTool(name, args) {
  try {
    requireAuth();

    switch (name) {
      case "get_expenses": {
        const data = await makeRequest("GET", "/api/expenses");
        if (!data || data.length === 0) return ok("No expenses found.");

        // Compute a quick total
        const total = data.reduce((sum, e) => sum + (e.cost || 0), 0);
        const formatted = data.map((e) => ({
          id: e._id,
          cost: e.cost,
          category: e.category,
          description: e.description,
          date: e.date,
        }));
        return ok({ expenses: formatted, total: parseFloat(total.toFixed(2)) });
      }

      case "add_expense": {
        const body = {
          cost: args.cost,
          category: args.category,
          description: args.description,
          date: args.date || new Date().toISOString(),
        };
        const data = await makeRequest("POST", "/api/expenses/add", body);
        return ok(
          `Expense recorded — ${data.category}: ${data.cost} on ${new Date(data.date).toDateString()}`
        );
      }

      case "delete_expense": {
        const data = await makeRequest("DELETE", `/api/expenses/remove/${args.id}`);
        return ok(data.message || "Expense deleted.");
      }

      default:
        throw new Error(`Unknown expenses tool: ${name}`);
    }
  } catch (e) {
    return err(e);
  }
}
