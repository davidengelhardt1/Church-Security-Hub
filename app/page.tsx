"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Incident, Category, Severity } from "@/lib/types";
import { Ribbon } from "@/components/Ribbon";
import { FilterRail } from "@/components/FilterRail";
import { WatchLog } from "@/components/WatchLog";
import { createClient, authConfigured } from "@/lib/supabase-browser";

// Leaflet touches `window` at import time, so it can never be part of the
// server-rendered bundle - ssr:false is load-bearing here, not optional.
const IncidentMap = dynamic(
  () => import("@/components/IncidentMap").then((m) => m.IncidentMap),
  { ssr: false, loading: () => <MapLoadingPlaceholder /> }
);

function MapLoadingPlaceholder() {
  return (
    <div
      className="mono"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-dim)",
        fontSize: 13,
      }}
    >
      Loading map…
    </div>
  );
}

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
type View = "log" | "map";

export default function Page() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(["physical", "extremism", "cyber"])
  );
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(
    new Set(["high", "medium", "low"])
  );
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("log");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Reflects sign-in state in the nav link ("Get Alerts" -> "My Account").
  // Runs once on mount, then stays in sync via onAuthStateChange - e.g.
  // if someone signs out on /preferences and navigates back here without
  // a full page reload.
  useEffect(() => {
    if (!authConfigured) return;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setIncidents(data.incidents ?? []);
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const toggleCategory = (c: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const toggleSeverity = (s: Severity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (!activeCategories.has(i.category)) return false;
      if (!activeSeverities.has(i.severity)) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [incidents, activeCategories, activeSeverities, search]);

  return (
    <div className="board">
      <Ribbon incidents={filtered} fetchedAt={fetchedAt} loading={loading} userEmail={userEmail} />
      <div className="board__body">
        <FilterRail
          activeCategories={activeCategories}
          activeSeverities={activeSeverities}
          onToggleCategory={toggleCategory}
          onToggleSeverity={toggleSeverity}
          search={search}
          onSearch={setSearch}
        />
        <main className="board__main" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: "10px 24px",
              borderBottom: "1px solid var(--hairline)",
              background: "var(--panel)",
            }}
          >
            {(["log", "map"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="mono"
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  border: "1px solid var(--hairline)",
                  borderRadius: 4,
                  background: view === v ? "var(--panel-raised)" : "transparent",
                  color: view === v ? "var(--text-primary)" : "var(--text-dim)",
                }}
              >
                {v === "log" ? "Watch Log" : "Map"}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="mono"
              style={{
                margin: 20,
                padding: 14,
                border: "1px solid var(--sev-high)",
                background: "var(--sev-high-bg)",
                color: "var(--sev-high)",
                fontSize: 13,
                borderRadius: 4,
              }}
            >
              Sync failed: {error}
            </div>
          )}

          {view === "log" ? (
            <WatchLog incidents={filtered} />
          ) : (
            <div className="map-panel" style={{ flex: 1, minHeight: 420 }}>
              <IncidentMap incidents={filtered} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
