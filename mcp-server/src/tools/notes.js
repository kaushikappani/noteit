import { ok, err } from "../api-client.js";

function requireAuth(api) {
  if (!api.isAuthenticated()) {
    throw new Error("Not logged in. Call start_login first.");
  }
}

export const notesTools = [
  {
    name: "get_notes",
    description:
      "Get all non-archived notes for the logged-in user. Returns the first 150 characters of each note's content.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_archived_notes",
    description: "Get all archived notes for the logged-in user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_shared_notes",
    description: "Get all notes that other users have shared with you (read-only).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_note",
    description:
      "Get a single note by its ID. Optionally fetch an older version from history.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note ID" },
        history: {
          type: "string",
          enum: ["h0", "h1", "h2", "h3"],
          description:
            "h0 = current (default), h1/h2/h3 = older versions (newest-first)",
          default: "h0",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_note",
    description:
      "Create a new note. Your account must be email-verified to create notes.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Note title" },
        content: { type: "string", description: "Note content (supports HTML)" },
        category: { type: "string", description: "Optional category/tag" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_note",
    description:
      "Update an existing note. You can change title, content, category, color, and toggle archived/pinned status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note ID to update" },
        title: { type: "string", description: "New title" },
        content: { type: "string", description: "New content" },
        category: { type: "string", description: "New category" },
        color: {
          type: "string",
          description:
            "Hex color for the note card (e.g. #ff0000). Send the same color again to reset to default.",
        },
        pinned: {
          type: "boolean",
          description: "Pass true to toggle the pinned state",
        },
        archived: {
          type: "boolean",
          description: "Pass true to toggle the archived state",
        },
      },
      required: ["id", "title", "content"],
    },
  },
  {
    name: "delete_note",
    description: "Permanently delete a note you own. This cannot be undone.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "share_note",
    description: "Share one of your notes with another Noteit user by email.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note ID to share" },
        userEmail: {
          type: "string",
          description: "Email address of the user to share with",
        },
      },
      required: ["id", "userEmail"],
    },
  },
  {
    name: "generate_ai_summary",
    description:
      "Generate an AI summary for a note using Gemini. The summary is appended to the note content.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note ID" },
      },
      required: ["id"],
    },
  },
];

export async function handleNotesTool(name, args, api) {
  try {
    requireAuth(api);

    switch (name) {
      case "get_notes": {
        const data = await api.request("GET", "/api/notes");
        const notes = data.modifiedNotes || [];
        if (notes.length === 0) return ok("No notes found.");
        const summary = notes.map((n) => ({
          id: n._id,
          title: n.title,
          category: n.category,
          pinned: n.pinned,
          archived: n.archived,
          preview: n.content,
          updatedAt: n.updatedAt,
        }));
        return ok(summary);
      }

      case "get_archived_notes": {
        const data = await api.request("GET", "/api/notes/archived");
        const notes = data.notes || [];
        if (notes.length === 0) return ok("No archived notes.");
        return ok(notes.map((n) => ({ id: n._id, title: n.title, category: n.category, updatedAt: n.updatedAt })));
      }

      case "get_shared_notes": {
        const data = await api.request("GET", "/api/notes/shared");
        const notes = data.notes || [];
        if (notes.length === 0) return ok("No notes shared with you.");
        return ok(notes.map((n) => ({ id: n._id, title: n.title, category: n.category })));
      }

      case "get_note": {
        const history = args.history || "h0";
        const data = await api.request("GET", `/api/notes/${args.id}/${history}`);
        return ok(data);
      }

      case "create_note": {
        const data = await api.request("POST", "/api/notes/create", {
          title: args.title,
          content: args.content,
          category: args.category || "",
        });
        return ok(`Note created with ID: ${data._id}\nTitle: ${data.title}`);
      }

      case "update_note": {
        const body = {
          title: args.title,
          content: args.content,
          category: args.category,
          color: args.color,
          pinned: args.pinned,
          archived: args.archived,
        };
        // Remove undefined fields
        Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
        const data = await api.request("PUT", `/api/notes/${args.id}`, body);
        return ok(`Note updated: ${data.title}`);
      }

      case "delete_note": {
        const data = await api.request("DELETE", `/api/notes/${args.id}`);
        return ok(data.message || "Note deleted.");
      }

      case "share_note": {
        const data = await api.request(
          "POST",
          `/api/notes/share/${args.id}/${encodeURIComponent(args.userEmail)}`
        );
        return ok(data.message || `Note shared with ${args.userEmail}`);
      }

      case "generate_ai_summary": {
        const data = await api.request("GET", `/api/notes/${args.id}/genai/summary`);
        return ok(data.message || "AI summary generated and appended to the note.");
      }

      default:
        throw new Error(`Unknown notes tool: ${name}`);
    }
  } catch (e) {
    return err(e);
  }
}
