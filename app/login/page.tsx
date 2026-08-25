"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

// Magic-link auth is ONE mechanism, not two: the same email link signs in
// an existing user or creates a new one, and Supabase deliberately makes
// both cases produce an identical response (no way to tell "no account
// with that email" from "check your inbox") to avoid leaking which emails
// have accounts on this site. So "Sign In" and "Sign Up" below are the
// same call underneath - this is a UI clarity choice, not two systems.
type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  const copy =
    mode === "signin"
      ? {
          heading: "Sign In",
          sub: "enter the email you used before — we'll send you a link back in",
          button: "Send sign-in link",
        }
      : {
          heading: "Sign Up",
          sub: "enter your email to start getting high-severity incident alerts",
          button: "Send sign-up link",
        };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--panel)",
          border: "1px solid var(--hairline)",
          borderRadius: 8,
          padding: 32,
        }}
      >
        {/* Tabs - purely a UI choice for clarity; both call the same
            signInWithOtp underneath. See note at top of file. */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            background: "var(--panel-raised)",
            borderRadius: 6,
            padding: 4,
          }}
        >
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setStatus("idle");
                setErrorMsg("");
              }}
              className="mono"
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 12,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: 4,
                background: mode === m ? "var(--panel)" : "transparent",
                color: mode === m ? "var(--text-primary)" : "var(--text-dim)",
                cursor: "pointer",
              }}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 24,
            margin: "0 0 4px",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {copy.heading}
        </h1>
        <p
          className="mono"
          style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 24px" }}
        >
          {copy.sub}
        </p>

        {status === "sent" ? (
          <div
            style={{
              padding: 16,
              border: "1px solid var(--sev-low)",
              background: "var(--sev-low-bg)",
              borderRadius: 6,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Check <strong>{email}</strong> for a link. It'll expire after a
            while, so use it soon.
            {mode === "signup" && (
              <div style={{ marginTop: 8, color: "var(--text-dim)", fontSize: 13 }}>
                Already had an account with this email? The same link signs
                you in — nothing gets duplicated.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "sending"}
              style={{
                width: "100%",
                background: "var(--panel-raised)",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                padding: "12px 14px",
                color: "var(--text-primary)",
                fontSize: 16,
                fontFamily: "var(--font-body)",
                marginBottom: 12,
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                width: "100%",
                background: "var(--cat-cyber)",
                border: "none",
                borderRadius: 6,
                padding: "12px 14px",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: status === "sending" ? "default" : "pointer",
                opacity: status === "sending" ? 0.6 : 1,
              }}
            >
              {status === "sending" ? "Sending…" : copy.button}
            </button>

            {status === "error" && (
              <p style={{ color: "var(--sev-high)", fontSize: 13, marginTop: 12 }}>
                {errorMsg}
              </p>
            )}

            <p
              className="mono"
              style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 16 }}
            >
              No password to remember — every sign-in, on any device, works
              this same way: enter your email, click the link we send.
            </p>
          </form>
        )}

        <a
          href="/"
          className="mono"
          style={{
            display: "inline-block",
            marginTop: 20,
            fontSize: 12,
            color: "var(--text-dim)",
          }}
        >
          ← back to the dashboard
        </a>
      </div>
    </div>
  );
}
