import { ok, err } from "../api-client.js";

export const authTools = [
  {
    name: "start_login",
    description:
      "Start the browser-based login flow for Noteit. Returns a URL to open in your browser — no password needed in chat. After calling this, tell the user to open the URL, then call check_login to confirm once they are done.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "check_login",
    description:
      "Check if the user has completed the browser login after calling start_login. Call this after the user says they have logged in, or every ~5 seconds after showing them the login URL. Requires a code returned by start_login.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The auth code returned by start_login",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "logout",
    description: "Logout from Noteit and clear the stored session token.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_profile",
    description: "Get the currently logged-in user's profile (name, email, verified status).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "forgot_password",
    description: "Send a password reset email to the given address.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email address of the account" },
      },
      required: ["email"],
    },
  },
  {
    name: "auth_status",
    description: "Check whether you are currently logged in.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleAuthTool(name, args, api) {
  try {
    switch (name) {

      // ── Step 1: Generate auth code + return login URL ────────────────────
      case "start_login": {
        const { code, loginUrl } = await api.request("GET", "/api/users/mcp/auth");
        return ok(
          `🔐 **Open this URL in your browser to login:**\n\n${loginUrl}\n\n` +
          `Log in with your NoteIt email and password on that page.\n` +
          `Once you're done, come back and I'll confirm your login automatically.\n\n` +
          `_(Auth code: \`${code}\` — expires in 5 minutes)_`
        );
      }

      // ── Step 2: Poll once to see if token is ready ────────────────────────
      case "check_login": {
        const { code } = args;
        if (!code) {
          return err(new Error("Missing code. Please call start_login first to get an auth code."));
        }

        let res;
        try {
          res = await api.request("GET", `/api/users/mcp/token?code=${encodeURIComponent(code)}`);
        } catch (e) {
          const msg = e.message || "";
          if (msg.includes("expired") || msg.includes("not found")) {
            return err(new Error("The auth code has expired or is invalid. Please call start_login again."));
          }
          return err(e);
        }

        // Backend returns { status: "pending" } if user hasn't logged in yet
        if (res && res.status === "pending") {
          return ok("⏳ Not yet — please open the login URL in your browser and complete the login, then let me know.");
        }

        if (res && res.token) {
          // The token stays here. It is the user's 365-day account JWT and it
          // cannot be revoked, so it is never handed back to the client — the
          // session it authenticates is what has to survive instead.
          api.setToken(res.token);
          // Fetch profile to confirm
          try {
            const profile = await api.request("GET", "/api/users/info");
            return ok(`✅ Logged in successfully as **${profile.name}** (${profile.email})! You can now use all NoteIt tools.`);
          } catch {
            return ok("✅ Logged in successfully! You can now use all NoteIt tools.");
          }
        }

        return ok("⏳ Still waiting — please complete the login in your browser and let me know when done.");
      }


      case "logout": {
        await api.request("GET", "/api/users/logout");
        api.clearToken();
        return ok("Logged out successfully.");
      }

      case "get_profile": {
        if (!api.isAuthenticated()) {
          return err(new Error("Not logged in. Call start_login first."));
        }
        const data = await api.request("GET", "/api/users/info");
        return ok(data);
      }

      case "forgot_password": {
        const data = await api.request("POST", "/api/users/forgotpassword", {
          email: args.email,
        });
        return ok(data.message || "Password reset email sent.");
      }

      case "auth_status": {
        return ok(
          api.isAuthenticated()
            ? "You are logged in."
            : "You are not logged in. Call start_login to login via browser — no password needed in chat."
        );
      }

      default:
        throw new Error(`Unknown auth tool: ${name}`);
    }
  } catch (e) {
    return err(e);
  }
}
