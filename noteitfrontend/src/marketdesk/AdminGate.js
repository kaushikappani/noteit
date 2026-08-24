/**
 * Client-side admin gate.
 *
 * Convenience only — it keeps a non-admin from staring at a broken page. The
 * real boundary is adminProtect on the server, which 403s regardless of what the
 * browser believes.
 */

import React from "react";
import { Link } from "react-router-dom";

const ADMIN_EMAILS = ["kaushikappani@gmail.com"];

export function currentUser() {
    try {
        return JSON.parse(localStorage.getItem("userInfo")) || null;
    } catch {
        return null;
    }
}

export const isAdmin = (user = currentUser()) =>
    !!user?.email && ADMIN_EMAILS.includes(String(user.email).toLowerCase());

export default function AdminGate({ children }) {
    const user = currentUser();

    if (!user) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: "#9aa4b2" }}>
                <h4 style={{ color: "#e8ecf1" }}>Sign in required</h4>
                <p>MarketDesk needs an authenticated session.</p>
                <Link to="/">Go to sign in</Link>
            </div>
        );
    }

    if (!isAdmin(user)) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: "#9aa4b2" }}>
                <h4 style={{ color: "#e8ecf1" }}>Not available</h4>
                <p>MarketDesk is restricted to the account owner.</p>
                <Link to="/notes">Back to notes</Link>
            </div>
        );
    }

    return children;
}
