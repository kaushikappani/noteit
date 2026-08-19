import dotenv from "dotenv";
dotenv.config();

const FALLBACK_LOCAL_PORT = 5000;

/**
 * Resolve the Noteit backend base URL.
 *
 *   1. NOTEIT_API_URL           — explicit, always wins (e.g. https://noteit-prod2.onrender.com)
 *   2. http://127.0.0.1:$PORT   — set when mounted inside the Noteit app itself (loopback to self)
 *   3. http://localhost:5000    — local dev default
 *
 * Note: only the origin belongs here. `/notesv2` is a React route, not an API prefix.
 */
export function resolveBaseUrl() {
  const explicit = process.env.NOTEIT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.PORT) return `http://127.0.0.1:${process.env.PORT}`;
  return `http://localhost:${FALLBACK_LOCAL_PORT}`;
}

/**
 * Create an isolated API client. Each MCP session gets its own client, so the
 * JWT captured by `check_login` never leaks between concurrent HTTP sessions.
 */
export function createApiClient({ baseUrl } = {}) {
  const BASE_URL = (baseUrl || resolveBaseUrl()).replace(/\/+$/, "");

  let authToken = null;

  /** Make an HTTP request to the Noteit backend, replaying this session's JWT cookie. */
  async function request(method, endpoint, body = null) {
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
    } catch (e) {
      throw new Error(
        `Cannot reach Noteit backend at ${BASE_URL}. Is the server running? (${e.message})`
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
        typeof data === "object" ? data.message || JSON.stringify(data) : text;
      throw new Error(msg || `HTTP ${response.status}`);
    }

    return data;
  }

  return {
    baseUrl: BASE_URL,
    request,
    /** Inject a token directly (used by the start_login / check_login flow) */
    setToken(token) {
      authToken = token;
    },
    /** Clear the stored auth token (logout) */
    clearToken() {
      authToken = null;
    },
    /** Check whether this session is currently authenticated */
    isAuthenticated() {
      return authToken !== null;
    },
  };
}

/** Format a successful MCP tool response */
export function ok(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/** Format an error MCP tool response */
export function err(error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
