import { makeRequest, isAuthenticated, ok, err } from "../api-client.js";

function requireAuth() {
  if (!isAuthenticated()) {
    throw new Error("Not logged in. Call the login tool first.");
  }
}

export const remindersTools = [
  {
    name: "get_reminders",
    description: "Get all active (non-expired) reminders for the logged-in user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_reminder",
    description:
      "Create a new reminder. A push notification will be triggered at the specified date/time. " +
      "Provide the date in ISO 8601 format (e.g. '2025-03-01T10:30:00').",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "What the reminder is about",
        },
        date: {
          type: "string",
          description:
            "Date and time for the reminder in ISO 8601 format, e.g. '2025-03-01T10:30:00'",
        },
      },
      required: ["description", "date"],
    },
  },
];

export async function handleRemindersTool(name, args) {
  try {
    requireAuth();

    switch (name) {
      case "get_reminders": {
        const data = await makeRequest("GET", "/api/remainders");
        if (!data || data.length === 0) return ok("No active reminders.");
        const formatted = data.map((r) => ({
          id: r._id,
          description: r.description,
          date: r.date,
          expired: r.expired,
        }));
        return ok(formatted);
      }

      case "add_reminder": {
        const data = await makeRequest("POST", "/api/remainders/add", {
          description: args.description,
          date: args.date,
        });
        return ok(data.message || "Reminder added successfully.");
      }

      default:
        throw new Error(`Unknown reminders tool: ${name}`);
    }
  } catch (e) {
    return err(e);
  }
}
