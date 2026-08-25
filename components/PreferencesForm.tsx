"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Category, Severity } from "@/lib/types";

interface Props {
  userEmail: string;
  initialCategories: Category[];
  initialMinSeverity: Severity;
  hasSubscription: boolean;
}

const CATEGORY_OPTIONS: { key: Category; label: string }[] = [
  { key: "physical", label: "Physical Security" },
  { key: "extremism", label: "Extremism" },
  { key: "cyber", label: "Cyber" },
];

const SEVERITY_OPTIONS: { key: Severity; label: string; hint: string }[] = [
  { key: "high", label: "High only", hint: "fewest emails, most urgent only" },
  { key: "medium", label: "High + Medium", hint: "balanced" },
  { key: "low", label: "Everything", hint: "most emails" },
];

export function PreferencesForm({
  userEmail,
  initialCategories,
  initialMinSeverity,
  hasSubscription,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Set<Category>>(new Set(initialCategories));
  const [minSeverity, setMinSeverity] = useState<Severity>(initialMinSeverity);
  const [subscribed, setSubscribed] = useState(hasSubscription);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggleCategory(c: Category) {
    setCategories((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired - please sign in again.");

      // RLS requires auth.uid() = user_id on every write, so user_id must
      // be supplied explicitly here (not inferred server-side, since this
      // runs in the browser with the anon key).
      const { error } = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        email: user.email,
        categories: Array.from(categories),
        min_severity: minSeverity,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      setSubscribed(true);
      setStatus("saved");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Failed to save preferences.");
    }
  }

  async function handleUnsubscribe() {
    setStatus("saving");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired - please sign in again.");

      // RLS also restricts this to the caller's own row, but the JS client
      // requires an explicit filter on delete regardless - this is that,
      // not the actual security boundary.
      const { error } = await supabase.from("subscriptions").delete().eq("user_id", user.id);
      if (error) throw error;
      setSubscribed(false);
      setStatus("idle");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Failed to unsubscribe.");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--hairline)",
        borderRadius: 8,
        padding: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 22,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Alert Preferences
          </h1>
          <p className="mono" style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
            {userEmail}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="mono"
          style={{
            background: "transparent",
            border: "1px solid var(--hairline)",
            borderRadius: 4,
            padding: "6px 10px",
            color: "var(--text-dim)",
            fontSize: 12,
          }}
        >
          Sign out
        </button>
      </div>

      {subscribed && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--sev-low-bg)",
            border: "1px solid var(--sev-low)",
            borderRadius: 4,
            fontSize: 12,
            marginBottom: 20,
          }}
        >
          You're subscribed. Changes below take effect on save.
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 10, textTransform: "uppercase" }}>
          Categories
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CATEGORY_OPTIONS.map((c) => (
            <label
              key={c.key}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={categories.has(c.key)}
                onChange={() => toggleCategory(c.key)}
                style={{ width: 16, height: 16 }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 10, textTransform: "uppercase" }}>
          Minimum severity
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SEVERITY_OPTIONS.map((s) => (
            <label
              key={s.key}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer" }}
            >
              <input
                type="radio"
                name="minSeverity"
                checked={minSeverity === s.key}
                onChange={() => setMinSeverity(s.key)}
                style={{ width: 16, height: 16, marginTop: 2 }}
              />
              <span>
                {s.label}
                <span className="mono" style={{ display: "block", fontSize: 11, color: "var(--text-dim)" }}>
                  {s.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={status === "saving" || categories.size === 0}
        style={{
          width: "100%",
          background: "var(--cat-cyber)",
          border: "none",
          borderRadius: 6,
          padding: "12px 14px",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: status === "saving" ? "default" : "pointer",
          opacity: status === "saving" || categories.size === 0 ? 0.6 : 1,
        }}
      >
        {status === "saving" ? "Saving…" : subscribed ? "Update preferences" : "Subscribe"}
      </button>

      {categories.size === 0 && (
        <p style={{ color: "var(--sev-medium)", fontSize: 12, marginTop: 8 }}>
          Select at least one category.
        </p>
      )}
      {status === "saved" && (
        <p style={{ color: "var(--sev-low)", fontSize: 13, marginTop: 12 }}>Saved.</p>
      )}
      {status === "error" && (
        <p style={{ color: "var(--sev-high)", fontSize: 13, marginTop: 12 }}>{errorMsg}</p>
      )}

      {subscribed && (
        <button
          onClick={handleUnsubscribe}
          disabled={status === "saving"}
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
          Unsubscribe from all alerts
        </button>
      )}

      <a
        href="/"
        className="mono"
        style={{ display: "inline-block", marginTop: 20, fontSize: 12, color: "var(--text-dim)" }}
      >
        ← back to the dashboard
      </a>
    </div>
  );
}
