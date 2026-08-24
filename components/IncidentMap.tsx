"use client";

import { useEffect, useRef } from "react";
import { Incident, Severity } from "@/lib/types";

// Leaflet touches `window` on import, so this component is only ever
// mounted client-side (see app/page.tsx, which loads it via next/dynamic
// with ssr:false). Imported dynamically here too, defensively.

const SEVERITY_COLOR: Record<Severity, string> = {
  high: "#c2452f",
  medium: "#d9a441",
  low: "#6e9080",
};

interface Props {
  incidents: Incident[];
}

export function IncidentMap({ incidents }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const located = incidents.filter(
    (i) => typeof i.lat === "number" && typeof i.lng === "number"
  );

  // Initialize the map once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 12,
        worldCopyJump: true,
      });

      // CartoDB's dark basemap - free, no API key, matches the watch-board
      // palette far better than default OSM tiles would.
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // Leaflet measures its container's pixel size exactly once, at init.
      // On mobile that measurement can happen before the layout has
      // settled (address bar collapsing, viewport height changing right
      // after load), which locks in a wrong size and renders broken/
      // partial tiles. A ResizeObserver tells Leaflet to remeasure
      // whenever the container's actual size changes - covers initial
      // load, orientation change, and switching into the Map tab.
      const resizeObserver = new ResizeObserver(() => {
        mapRef.current?.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;

      // Also catch the very next paint, in case the observer's first
      // callback fires before layout is fully settled.
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers whenever the incident list changes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !layerRef.current) return;

      layerRef.current.clearLayers();

      for (const inc of located) {
        const marker = L.circleMarker([inc.lat as number, inc.lng as number], {
          radius: inc.severity === "high" ? 7 : 5,
          color: SEVERITY_COLOR[inc.severity],
          fillColor: SEVERITY_COLOR[inc.severity],
          fillOpacity: 0.75,
          weight: 1.5,
        });

        const safeTitle = escapeHtml(inc.title);
        const safeLoc = inc.locationName ? escapeHtml(inc.locationName) : "";
        marker.bindPopup(
          `<div style="font-family: -apple-system, sans-serif; font-size: 13px; max-width: 240px;">
             <div style="font-weight: 600; margin-bottom: 4px;">${safeTitle}</div>
             <div style="color: #8ea0ac; font-size: 12px;">${safeLoc}${
            safeLoc && inc.source ? " · " : ""
          }${escapeHtml(inc.source)}</div>
             <a href="${escapeHtml(inc.url)}" target="_blank" rel="noopener noreferrer"
                style="color: #4c7ea8; font-size: 12px;">Open article →</a>
           </div>`
        );

        marker.addTo(layerRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [located]);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {located.length === 0 && (
        <div
          className="mono"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-dim)",
            fontSize: 13,
            pointerEvents: "none",
            background: "var(--bg)",
          }}
        >
          No located incidents match the current filters.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
