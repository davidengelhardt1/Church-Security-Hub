"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Incident, Category, Severity } from "@/lib/types";
import { Ribbon } from "@/components/Ribbon";
import { FilterRail } from "@/components/FilterRail";
import { WatchLog } from "@/components/WatchLog";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export default function Page() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(["violence", "extremism", "cyber"])
  );
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(
    new Set(["high", "medium", "low"])
  );
  const [search, setSearch] = useState("");

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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Ribbon incidents={filtered} fetchedAt={fetchedAt} loading={loading} />
      <div style={{ display: "flex", flex: 1 }}>
        <FilterRail
          activeCategories={activeCategories}
          activeSeverities={activeSeverities}
          onToggleCategory={toggleCategory}
          onToggleSeverity={toggleSeverity}
          search={search}
          onSearch={setSearch}
        />
        <main style={{ flex: 1, minWidth: 0 }}>
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
          <WatchLog incidents={filtered} />
        </main>
      </div>
    </div>
  );
}
