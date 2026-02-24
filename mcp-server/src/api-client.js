import dotenv from "dotenv";
dotenv.config();

// In-memory token store — persists for the lifetime of the MCP server process
let authToken = null;

const BASE_URL = process.env.NOTEIT_API_URL || "http://localhost:5500";

/**
 * Make an HTTP request to the Noteit backend.
 * Automatically attaches the stored JWT cookie and extracts it on login.
 */
export async function makeRequest(method, endpoint, body = null) {
  const headers = { "Content-Type": "application/json" };

  if (authToken) {
    headers["Cookie"] = `token=${authToken}`;
  }

  const options = { method, headers };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, options);
  } catch (err) {
    throw new Error(
      `Cannot reach Noteit backend at ${BASE_URL}. Is the server running? (${err.message})`
    );
  }

  // Extract JWT from Set-Cookie header (present on login / register)
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/token=([^;,\s]+)/);
    if (match) {
      authToken = match[1];
    }
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const msg =
      typeof data === "object"
        ? data.message || JSON.stringify(data)
        : text;
    throw new Error(msg || `HTTP ${response.status}`);
  }

  return data;
}

/** Clear the stored auth token (logout) */
export function clearToken() {
  authToken = null;
}

/** Check whether a user is currently authenticated */
export function isAuthenticated() {
  return authToken !== null;
}

/** Format a successful MCP tool response */
export function ok(data) {
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/** Format an error MCP tool response */
export function err(error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
