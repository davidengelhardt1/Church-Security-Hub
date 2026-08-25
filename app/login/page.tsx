"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
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
          Get Alerts
        </h1>
        <p
          className="mono"
          style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 24px" }}
        >
          sign in to subscribe to high-severity incident alerts
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
            Check <strong>{email}</strong> for a sign-in link. It'll expire
            after a while, so use it soon.
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
                fontSize: 16, // prevents iOS auto-zoom on focus
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
              {status === "sending" ? "Sending…" : "Send sign-in link"}
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
              No password needed - we'll email you a link instead.
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
