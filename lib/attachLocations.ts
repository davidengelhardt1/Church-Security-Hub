import { Incident } from "./types";
import { matchLocation } from "./geocode";

/**
 * Attaches lat/lng to each incident by matching its title against the
 * offline gazetteer (lib/geocode.ts). Pure and synchronous - no network
 * call - so this is cheap enough to run on every incident every time,
 * rather than only on newly-inserted rows.
 */
export function attachLocations(incidents: Incident[]): Incident[] {
  return incidents.map((inc) => {
    const match = matchLocation(inc.title);
    if (!match) return inc;
    return { ...inc, locationName: match.name, lat: match.lat, lng: match.lng };
  });
}
