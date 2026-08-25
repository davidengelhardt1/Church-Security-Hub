"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

// Two-step: request a code, then enter it. NOT a clickable magic link.
//
// Why: Supabase's own docs confirm that clickable magic links get silently
// consumed by corporate/email-provider link scanners (Microsoft Defender's
// Safe Links, and others) BEFORE the real person clicks them - the security
// scanner "visits" the link to check it's safe, which uses up the one-time
// token, so the user's actual click fails with "expired" even though
// nothing really expired. A typed code has no URL for a scanner to
// prefetch, so this failure mode doesn't exist.
//
// Same underlying mechanism as before (Supabase OTP), just verified by
// typing the code instead of clicking a link - "Sign In" and "Sign Up" are
// still the same call underneath; see the note on that further down.
type Mode = "signin" | "signup";
type Stage = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setStatus("sent");
      setStage("code");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      router.push("/preferences");
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(
        err?.message?.includes("expired") || err?.message?.includes("invalid")
          ? "That code is wrong or expired. Double-check the email, or request a new one below."
          : err?.message ?? "Something went wrong. Please try again."
      );
    }
  }

  const copy =
    mode === "signin"
      ? { heading: "Sign In", sub: "enter the email you used before" }
      : { heading: "Sign Up", sub: "enter your email to start getting high-severity incident alerts" };

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
        {stage === "email" && (
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
        )}

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
          {stage === "email" ? copy.heading : "Enter Code"}
        </h1>
        <p className="mono" style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 24px" }}>
          {stage === "email" ? copy.sub : `sent to ${email}`}
        </p>

        {stage === "email" ? (
          <form onSubmit={handleSendCode}>
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
              {status === "sending" ? "Sending…" : "Send code"}
            </button>
            {status === "error" && (
              <p style={{ color: "var(--sev-high)", fontSize: 13, marginTop: 12 }}>{errorMsg}</p>
            )}
            <p className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 16 }}>
              No password to remember - we'll email you a 6-digit code.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              disabled={status === "verifying"}
              autoFocus
              style={{
                width: "100%",
                background: "var(--panel-raised)",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                padding: "12px 14px",
                color: "var(--text-primary)",
                fontSize: 20,
                letterSpacing: "0.3em",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                marginBottom: 12,
              }}
            />
            <button
              type="submit"
              disabled={status === "verifying" || code.length < 6}
              style={{
                width: "100%",
                background: "var(--cat-cyber)",
                border: "none",
                borderRadius: 6,
                padding: "12px 14px",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: status === "verifying" ? "default" : "pointer",
                opacity: status === "verifying" || code.length < 6 ? 0.6 : 1,
              }}
            >
              {status === "verifying" ? "Verifying…" : "Verify and sign in"}
            </button>
            {status === "error" && (
              <p style={{ color: "var(--sev-high)", fontSize: 13, marginTop: 12 }}>{errorMsg}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
                setStatus("idle");
                setErrorMsg("");
              }}
              className="mono"
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                padding: "10px 14px",
                color: "var(--text-dim)",
                fontSize: 12,
                marginTop: 12,
              }}
            >
              Use a different email / send a new code
            </button>
          </form>
        )}

        <a
          href="/"
          className="mono"
          style={{ display: "inline-block", marginTop: 20, fontSize: 12, color: "var(--text-dim)" }}
        >
          ← back to the dashboard
        </a>
      </div>
    </div>
  );
}
