import { ok, err } from "../api-client.js";
import { credentialMeta, mintGrantKey, hashGrantKey, GRANT_TTL_MS } from "../grants.js";

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
      "Check if the user has completed the browser login after calling start_login. Call this after the user says they have logged in, or every ~5 seconds after showing them the login URL. Takes no arguments — this server remembers which login it started.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "logout",
    description:
      "Log out of Noteit on this client and revoke its saved sign-in. Other devices and the browser session are left alone.",
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

const GRANT_DAYS = Math.round(GRANT_TTL_MS / (24 * 60 * 60 * 1000));

/**
 * Turn a completed login into a credential the client keeps.
 *
 * The JWT itself never leaves this process. What the client gets is a grant
 * key: a random string that means nothing anywhere else, that only resolves to
 * this token through the store, and that logout can destroy. The account JWT
 * can do none of those things — it is a bare 365-day bearer of the whole
 * account with nothing behind it that can take it back.
 */
async function issueGrant(ctx, token) {
  const key = mintGrantKey();
  const hash = hashGrantKey(key);
  // Never outlive the token inside it. A grant that did would keep resolving —
  // auth_status cheerfully saying "logged in" — while every actual call came
  // back 401, which is a worse experience than being told to sign in.
  const ttl = Math.min(GRANT_TTL_MS, remainingTokenLifeMs(token));
  await ctx.grants.save(hash, { token, createdAt: Date.now() }, ttl);
  ctx.session.grantHash = hash;
  return credentialMeta(key, ttl);
}

/**
 * How long the JWT has left, from its own `exp` claim.
 *
 * Read, not verified — the backend we got it from is the one that signed it,
 * and nothing here is trusted for authentication. It is only used to shorten a
 * lifetime, so a token we cannot parse falls back to the full grant TTL and
 * behaves exactly as it did before.
 */
function remainingTokenLifeMs(token) {
  try {
    const [, payload] = String(token).split(".");
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!exp) return GRANT_TTL_MS;
    return Math.max(0, exp * 1000 - Date.now());
  } catch (_) {
    return GRANT_TTL_MS;
  }
}

export async function handleAuthTool(name, args, api, ctx) {
  try {
    switch (name) {

      // ── Step 1: Generate auth code + return login URL ────────────────────
      case "start_login": {
        const { code, secret, loginUrl } = await api.request("GET", "/api/users/mcp/auth");

        // The login URL has to be shown — the user has to click it — and it
        // carries the code, so the code is in the model's prompt whether we
        // like it or not. The secret is the half that stays here: redeeming the
        // token needs both, so a prompt injection reading the URL back out of
        // the conversation still cannot trade it for the account JWT.
        ctx.session.pendingLogin = { code, secret };

        return ok(
          `🔐 **Open this URL in your browser to login:**\n\n${loginUrl}\n\n` +
          `Log in with your NoteIt email and password on that page.\n` +
          `Once you're done, come back and I'll confirm your login automatically.\n\n` +
          `_(The link expires in 5 minutes.)_`
        );
      }

      // ── Step 2: Poll once to see if token is ready ────────────────────────
      case "check_login": {
        // Only this session can redeem the login it started: the secret was
        // never written down anywhere the model or the user could reach.
        const pending = ctx.session.pendingLogin;
        if (!pending) {
          return err(new Error("No login in progress. Call start_login first."));
        }

        const query =
          `code=${encodeURIComponent(pending.code)}` +
          `&secret=${encodeURIComponent(pending.secret)}`;

        let res;
        try {
          res = await api.request("GET", `/api/users/mcp/token?${query}`);
        } catch (e) {
          const msg = e.message || "";
          if (msg.includes("expired") || msg.includes("not found")) {
            ctx.session.pendingLogin = null;
            return err(new Error("The login link has expired. Please call start_login again."));
          }
          return err(e);
        }

        // Backend returns { status: "pending" } if user hasn't logged in yet
        if (res && res.status === "pending") {
          return ok("⏳ Not yet — please open the login URL in your browser and complete the login, then let me know.");
        }

        if (res && res.token) {
          // The code is spent — the backend deletes it as it hands the token over.
          ctx.session.pendingLogin = null;
          api.setToken(res.token);

          const meta = await issueGrant(ctx, res.token);

          let who = "";
          try {
            const profile = await api.request("GET", "/api/users/info");
            who = ` as **${profile.name}** (${profile.email})`;
          } catch {
            // Logged in either way; only the greeting suffers.
          }

          return ok(
            `✅ Logged in successfully${who}! You can now use all NoteIt tools.\n\n` +
            `This client stays signed in for up to ${GRANT_DAYS} days, including across ` +
            `server restarts. Call logout to end it.`,
            meta
          );
        }

        return ok("⏳ Still waiting — please complete the login in your browser and let me know when done.");
      }

      case "logout": {
        // Deliberately does not call /api/users/logout: that clears a cookie
        // this server does not hold, and revoking the account token would sign
        // the user out of their browser too. Logging *this client* out means
        // destroying this client's grant, which is exactly what a grant is for.
        if (ctx.session.grantHash) {
          await ctx.grants.delete(ctx.session.grantHash);
          ctx.session.grantHash = null;
        }
        ctx.session.pendingLogin = null;
        api.clearToken();

        return ok(
          "Logged out. This client's saved sign-in has been revoked; your browser session is untouched.",
          credentialMeta(null)
        );
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
