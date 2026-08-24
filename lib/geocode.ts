/**
 * Offline place-name matching for the map view.
 *
 * Deliberately NOT calling a live geocoding API (Nominatim, Google, etc.).
 * This project spent a full session chasing silent failures from external
 * search APIs - GDELT rejecting long queries, rate limits, timeouts that
 * look like empty results. A geocoding call on every ingest would be
 * another thing that can quietly break. A hardcoded gazetteer has none of
 * those failure modes: no network call, no rate limit, no API to go down.
 *
 * The honest tradeoff: coverage is bounded to what's listed here. A town
 * not in this list simply won't get a pin - a visible, obvious gap rather
 * than an invisible one. Extend CITIES as coverage gaps show up in practice.
 */

export interface GeoMatch {
  name: string;
  lat: number;
  lng: number;
}

// Multi-word matches are checked before single-word ones, so "Fort Worth"
// matches before a bare "Fort" or "Worth" could (neither exists here, but
// the principle matters for entries like "Las Cruces", "San Diego").
const CITIES: Record<string, [number, number]> = {
  // Cities that have actually appeared in this project's incident feed
  "kearns": [40.6539, -111.9988],
  "columbus": [39.9612, -82.9988],
  "amarillo": [35.2220, -101.8313],
  "fort lauderdale": [26.1224, -80.1373],
  "broward": [26.1901, -80.3659],
  "brooklyn": [40.6782, -73.9442],
  "bushwick": [40.6958, -73.9171],
  "fort worth": [32.7555, -97.3308],
  "las cruces": [32.3199, -106.7637],
  "charleston": [32.7765, -79.9311],
  "san diego": [32.7157, -117.1611],
  "black jack": [38.7973, -90.2551],
  "venice": [27.0998, -82.4543],
  "hudson": [42.3903, -92.4477],

  // Major US cities (population/news-frequency weighted)
  "new york": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "phoenix": [33.4484, -112.0740],
  "philadelphia": [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "dallas": [32.7767, -96.7970],
  "austin": [30.2672, -97.7431],
  "jacksonville": [30.3322, -81.6557],
  "san jose": [37.3382, -121.8863],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "boston": [42.3601, -71.0589],
  "detroit": [42.3314, -83.0458],
  "nashville": [36.1627, -86.7816],
  "memphis": [35.1495, -90.0490],
  "portland": [45.5152, -122.6784],
  "oklahoma city": [35.4676, -97.5164],
  "las vegas": [36.1699, -115.1398],
  "louisville": [38.2527, -85.7585],
  "baltimore": [39.2904, -76.6122],
  "milwaukee": [43.0389, -87.9065],
  "albuquerque": [35.0844, -106.6504],
  "tucson": [32.2226, -110.9747],
  "fresno": [36.7378, -119.7871],
  "sacramento": [38.5816, -121.4944],
  "atlanta": [33.7490, -84.3880],
  "kansas city": [39.0997, -94.5786],
  "colorado springs": [38.8339, -104.8214],
  "omaha": [41.2565, -95.9345],
  "raleigh": [35.7796, -78.6382],
  "miami": [25.7617, -80.1918],
  "cleveland": [41.4993, -81.6944],
  "tulsa": [36.1540, -95.9928],
  "minneapolis": [44.9778, -93.2650],
  "wichita": [37.6872, -97.3301],
  "arlington": [32.7357, -97.1081],
  "tampa": [27.9506, -82.4572],
  "st louis": [38.6270, -90.1994],
  "pittsburgh": [40.4406, -79.9959],
  "cincinnati": [39.1031, -84.5120],
  "orlando": [28.5383, -81.3792],
  "st petersburg": [27.7676, -82.6403],
  "richmond": [37.5407, -77.4360],
  "buffalo": [42.8864, -78.8784],
  "birmingham": [33.5186, -86.8104],
  "spokane": [47.6588, -117.4260],
  "montgomery": [32.3792, -86.3077],
  "baton rouge": [30.4515, -91.1871],
  "shreveport": [32.5252, -93.7502],
  "chattanooga": [35.0456, -85.3097],
  "knoxville": [35.9606, -83.9207],
  "syracuse": [43.0481, -76.1474],
  "rochester": [43.1566, -77.6088],
  "albany": [42.6526, -73.7562],
  "jackson": [32.2988, -90.1848],
  "little rock": [34.7465, -92.2896],
  "columbia": [34.0007, -81.0348],
  "greenville": [34.8526, -82.3940],
  "savannah": [32.0809, -81.0912],
  "charlotte": [35.2271, -80.8431],
  "durham": [35.9940, -78.8986],
  "winston-salem": [36.0999, -80.2442],
  "greensboro": [36.0726, -79.7920],
  "toledo": [41.6528, -83.5379],
  "akron": [41.0814, -81.5190],
  "dayton": [39.7589, -84.1916],
  "flint": [43.0125, -83.6875],
  "grand rapids": [42.9634, -85.6681],
  "lansing": [42.7325, -84.5555],
  "madison": [43.0731, -89.4012],
  "green bay": [44.5133, -88.0133],
  "des moines": [41.5868, -93.6250],
  "cedar rapids": [41.9779, -91.6656],
  "st paul": [44.9537, -93.0900],
  "duluth": [46.7867, -92.1005],
  "fargo": [46.8772, -96.7898],
  "sioux falls": [43.5460, -96.7313],
  "billings": [45.7833, -108.5007],
  "boise": [43.6150, -116.2023],
  "salt lake city": [40.7608, -111.8910],
  "provo": [40.2338, -111.6585],
  "reno": [39.5296, -119.8138],
  "anchorage": [61.2181, -149.9003],
  "honolulu": [21.3069, -157.8583],
  "el paso": [31.7619, -106.4850],
  "corpus christi": [27.8006, -97.3964],
  "lubbock": [33.5779, -101.8552],
  "laredo": [27.5064, -99.5075],
  "irving": [32.8140, -96.9489],
  "garland": [32.9126, -96.6389],
  "frisco": [33.1507, -96.8236],
  "plano": [33.0198, -96.6989],
  "mesa": [33.4152, -111.8315],
  "gilbert": [33.3528, -111.7890],
  "chandler": [33.3062, -111.8413],
  "scottsdale": [33.4942, -111.9261],
  "long beach": [33.7701, -118.1937],
  "oakland": [37.8044, -122.2712],
  "bakersfield": [35.3733, -119.0187],
  "anaheim": [33.8366, -117.9143],
  "riverside": [33.9806, -117.3755],
  "santa ana": [33.7455, -117.8677],
  "irvine": [33.6846, -117.8265],
  "newark": [40.7357, -74.1724],
  "jersey city": [40.7178, -74.0431],
  "trenton": [40.2171, -74.7429],
  "hartford": [41.7658, -72.6734],
  "providence": [41.8240, -71.4128],
  "manchester": [53.4808, -2.2426], // UK - see note below
  "burlington": [44.4759, -73.2121],
  "portland maine": [43.6591, -70.2568],
  "wilmington": [39.7391, -75.5398],
  "annapolis": [38.9784, -76.4922],

  // A few US cities share names with much more newsworthy international
  // cities of the same name (Manchester NH vs Manchester UK, Birmingham AL
  // is already in the main US list above and is genuinely the more common
  // match - but Manchester's bare form defaults to the UK city, since a
  // security-relevant Manchester headline is far more likely to mean the
  // UK city at this project's scale). If this project starts tracking a
  // specific US region where the small-city match matters more, override it
  // there instead of changing the global default.

  // International cities seen in headlines
  "nigeria": [9.0820, 8.6753],
  "lagos": [6.5244, 3.3792],
  "singapore": [1.3521, 103.8198],
  "london": [51.5074, -0.1278],
  "putney": [51.4613, -0.2160],
  "manchester uk": [53.4808, -2.2426],
  "birmingham uk": [52.4862, -1.8904],
  "sydney": [-33.8688, 151.2093],
  "toronto": [43.6532, -79.3832],
  "vancouver": [49.2827, -123.1207],
  "montreal": [45.5019, -73.5674],
  "paris": [48.8566, 2.3522],
  "berlin": [52.5200, 13.4050],
  "rome": [41.9028, 12.4964],
  "madrid": [40.4168, -3.7038],
  "dublin": [53.3498, -6.2603],
};

// State/country-level fallbacks - used when no city matched. Coarser, but
// still useful: a state-level pin is better than no pin at all.
const REGIONS: Record<string, [number, number]> = {
  "alabama": [32.8067, -86.7911], "alaska": [61.3707, -152.4044],
  "arizona": [33.7298, -111.4312], "arkansas": [34.9697, -92.3731],
  "california": [36.1162, -119.6816], "colorado": [39.0598, -105.3111],
  "connecticut": [41.5978, -72.7554], "delaware": [39.3185, -75.5071],
  "florida": [27.7663, -81.6868], "georgia": [33.0406, -83.6431],
  "hawaii": [21.0943, -157.4983], "idaho": [44.2405, -114.4788],
  "illinois": [40.3495, -88.9861], "indiana": [39.8494, -86.2583],
  "iowa": [42.0115, -93.2105], "kansas": [38.5266, -96.7265],
  "kentucky": [37.6681, -84.6701], "louisiana": [31.1695, -91.8678],
  "maine": [44.6939, -69.3819], "maryland": [39.0639, -76.8021],
  "massachusetts": [42.2302, -71.5301], "michigan": [43.3266, -84.5361],
  "minnesota": [45.6945, -93.9002], "mississippi": [32.7416, -89.6787],
  "missouri": [38.4561, -92.2884], "montana": [46.9219, -110.4544],
  "nebraska": [41.1254, -98.2681], "nevada": [38.3135, -117.0554],
  "new hampshire": [43.4525, -71.5639], "new jersey": [40.2989, -74.5210],
  "new mexico": [34.8405, -106.2485], "new york state": [42.1657, -74.9481],
  "north carolina": [35.6301, -79.8064], "north dakota": [47.5289, -99.7840],
  "ohio": [40.3888, -82.7649], "oklahoma": [35.5653, -96.9289],
  "oregon": [44.5720, -122.0709], "pennsylvania": [40.5908, -77.2098],
  "rhode island": [41.6809, -71.5118], "south carolina": [33.8569, -80.9450],
  "south dakota": [44.2998, -99.4388], "tennessee": [35.7478, -86.6923],
  "texas": [31.0545, -97.5635], "utah": [40.1500, -111.8624],
  "vermont": [44.0459, -72.7107], "virginia": [37.7693, -78.1700],
  "washington": [47.4009, -121.4905], "west virginia": [38.4912, -80.9545],
  "wisconsin": [44.2685, -89.6165], "wyoming": [42.7559, -107.3025],
  "missaukee county": [44.3253, -85.1291], "st croix county": [45.0022, -92.4838],

  "united kingdom": [55.3781, -3.4360], "canada": [56.1304, -106.3468],
  "australia": [-25.2744, 133.7751], "germany": [51.1657, 10.4515],
  "france": [46.2276, 2.2137], "italy": [41.8719, 12.5674],
  "spain": [40.4637, -3.7492], "ireland": [53.4129, -8.2439],
  "india": [20.5937, 78.9629], "pakistan": [30.3753, 69.3451],
  "israel": [31.0461, 34.8516], "philippines": [12.8797, 121.7740],
  "south africa": [-30.5595, 22.9375], "kenya": [-0.0236, 37.9062],
  "egypt": [26.8206, 30.8025], "brazil": [-14.2350, -51.9253],
  "mexico": [23.6345, -102.5528], "indonesia": [-0.7893, 113.9213],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

/**
 * Finds the best location match in a title. Checks multi-word city names
 * first (so "Fort Worth" wins over any partial single-word overlap), then
 * single-word cities, then state/country fallbacks.
 */
export function matchLocation(title: string): GeoMatch | null {
  if (!title) return null;
  const text = normalize(title);

  // Multi-word entries first (longest match wins), across cities then regions.
  const multiWord = (table: Record<string, [number, number]>) =>
    Object.keys(table)
      .filter((k) => k.includes(" "))
      .sort((a, b) => b.length - a.length)
      .find((k) => text.includes(k));

  const singleWord = (table: Record<string, [number, number]>) =>
    Object.keys(table)
      .filter((k) => !k.includes(" "))
      .find((k) => new RegExp(`\\b${k}\\b`).test(text));

  const cityKey = multiWord(CITIES) ?? singleWord(CITIES);
  if (cityKey) {
    const [lat, lng] = CITIES[cityKey];
    return { name: titleCase(cityKey), lat, lng };
  }

  const regionKey = multiWord(REGIONS) ?? singleWord(REGIONS);
  if (regionKey) {
    const [lat, lng] = REGIONS[regionKey];
    return { name: titleCase(regionKey), lat, lng };
  }

  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
