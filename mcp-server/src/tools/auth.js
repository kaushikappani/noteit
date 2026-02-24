import { makeRequest, clearToken, isAuthenticated, ok, err } from "../api-client.js";

export const authTools = [
  {
    name: "login",
    description:
      "Login to Noteit with email and password. Must be called before using any other tool. Stores the session token automatically.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Your Noteit account email" },
        password: { type: "string", description: "Your Noteit account password" },
      },
      required: ["email", "password"],
    },
  },
  {
    name: "register",
    description: "Create a new Noteit account.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name" },
        email: { type: "string", description: "Email address" },
        password: { type: "string", description: "Password" },
      },
      required: ["name", "email", "password"],
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

export async function handleAuthTool(name, args) {
  try {
    switch (name) {
      case "login": {
        const data = await makeRequest("POST", "/api/users/login", {
          email: args.email,
          password: args.password,
          platform: "web",
        });
        return ok(`Logged in successfully as ${data.name} (${data.email})`);
      }

      case "register": {
        const data = await makeRequest("POST", "/api/users", {
          name: args.name,
          email: args.email,
          password: args.password,
          platform: "web",
        });
        return ok(
          `Account created for ${data.name} (${data.email}). Check your email to verify your account.`
        );
      }

      case "logout": {
        await makeRequest("GET", "/api/users/logout");
        clearToken();
        return ok("Logged out successfully.");
      }

      case "get_profile": {
        if (!isAuthenticated()) {
          return err(new Error("Not logged in. Call login first."));
        }
        const data = await makeRequest("GET", "/api/users/info");
        return ok(data);
      }

      case "forgot_password": {
        const data = await makeRequest("POST", "/api/users/forgotpassword", {
          email: args.email,
        });
        return ok(data.message || "Password reset email sent.");
      }

      case "auth_status": {
        return ok(
          isAuthenticated()
            ? "You are logged in."
            : "You are not logged in. Call the login tool first."
        );
      }

      default:
        throw new Error(`Unknown auth tool: ${name}`);
    }
  } catch (e) {
    return err(e);
  }
}
