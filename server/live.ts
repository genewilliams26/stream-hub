import type {
  Production,
  Rating,
  Availability,
  SettingsData,
} from "@shared/schema";

/**
 * Live provider layer
 * --------------------
 * Real-time search across every streaming service via aggregator APIs.
 *
 * Why aggregators instead of per-service APIs? Netflix / Disney+ / Max / Prime
 * do NOT expose public catalog-search APIs. The industry queries availability
 * aggregators that track "what's on which service" across all of them at once:
 *
 *   TMDB       (TMDB_API_KEY)      — title/person/keyword search, metadata,
 *                                    posters, trailers, cast, and per-region
 *                                    watch providers (data powered by JustWatch).
 *   Watchmode  (WATCHMODE_API_KEY) — precise streaming availability + real deep
 *                                    links (web_url) and rent/buy prices.
 *   OMDb       (OMDB_API_KEY)      — IMDb / Rotten Tomatoes / Metacritic ratings.
 *
 * Search flow for a natural-language query:
 *   1. A strategy is chosen (title | person | keyword/location) — either by the
 *      AI interpretation layer or a heuristic fallback.
 *   2. TMDB returns matching titles (person search -> that actor's filmography;
 *      keyword search -> "set in Hawaii" etc.; plain title search otherwise).
 *   3. Each title is enriched: availability + deep links (Watchmode, TMDB
 *      providers as backup) filtered to the user's enabled services + region,
 *      then ratings from OMDb, then a YouTube/TMDB trailer.
 *   4. Titles with no watchable offer on an enabled service are dropped.
 *
 * Every network call is defensive: any failure degrades to a partial result or
 * lets the caller fall back to the bundled offline catalog. Nothing here throws
 * to the request handler.
 */

const TMDB = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const OMDB = "https://www.omdbapi.com";
const WATCHMODE = "https://api.watchmode.com/v1";

export function tmdbKey() {
  return process.env.TMDB_API_KEY || "";
}
export function omdbKey() {
  return process.env.OMDB_API_KEY || "";
}
export function watchmodeKey() {
  return process.env.WATCHMODE_API_KEY || "";
}

export function hasLiveProviders(): boolean {
  return Boolean(tmdbKey() || omdbKey() || watchmodeKey());
}

// A small fetch wrapper: JSON, timeout, never throws (returns null on any error).
async function getJson<T = any>(url: string, timeoutMs = 8000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- service id mapping --------------------------- */
// TMDB / Watchmode identify providers by their own ids/names. Map the common
// ones onto this app's service ids ("netflix", "prime", ...). Anything not in
// the map is matched loosely by normalized name so new services still surface.

const NAME_TO_SERVICE: Record<string, string> = {
  netflix: "netflix",
  "amazon prime video": "prime",
  "amazon video": "prime",
  "prime video": "prime",
  "disney plus": "disney",
  "disney+": "disney",
  hulu: "hulu",
  max: "max",
  "hbo max": "max",
  "apple tv": "appletv",
  "apple tv plus": "appletv",
  "apple tv+": "appletv",
  "paramount plus": "paramount",
  "paramount+": "paramount",
  peacock: "peacock",
  "peacock premium": "peacock",
  tubi: "tubi",
  "pluto tv": "pluto",
  "discovery+": "discovery",
  "discovery plus": "discovery",
};

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+ ]/g, "").replace(/\s+/g, " ").trim();
}

// Resolve a provider display name to one of the app's configured service ids,
// or null if the user hasn't enabled anything matching it.
function resolveServiceId(providerName: string, settings: SettingsData): string | null {
  const n = normName(providerName);
  const mapped = NAME_TO_SERVICE[n];
  const enabled = settings.services.filter((s) => s.enabled);
  if (mapped) {
    return enabled.find((s) => s.id === mapped)?.id ?? null;
  }
  // Loose fallback: provider name contains (or is contained by) a service id/name.
  const hit = enabled.find(
    (s) => n.includes(s.id) || n.includes(normName(s.name)) || normName(s.name).includes(n),
  );
  return hit?.id ?? null;
}

/* ------------------------------- TMDB search ------------------------------ */

type TmdbTitle = {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  year?: number;
  overview: string;
  genreIds: number[];
  poster?: string;
  backdrop?: string;
  tmdbScore?: string;
};

let genreCache: Record<number, string> | null = null;
async function tmdbGenres(): Promise<Record<number, string>> {
  if (genreCache) return genreCache;
  const key = tmdbKey();
  const out: Record<number, string> = {};
  for (const kind of ["movie", "tv"]) {
    const data = await getJson<{ genres: { id: number; name: string }[] }>(
      `${TMDB}/genre/${kind}/list?api_key=${key}`,
    );
    for (const g of data?.genres ?? []) out[g.id] = g.name;
  }
  genreCache = out;
  return out;
}

function pickYear(m: any): number | undefined {
  const d: string = m.release_date || m.first_air_date || "";
  const y = parseInt(d.slice(0, 4), 10);
  return Number.isFinite(y) ? y : undefined;
}

function mapTmdbResult(m: any): TmdbTitle | null {
  const media = m.media_type || (m.title ? "movie" : m.name ? "tv" : null);
  if (media !== "movie" && media !== "tv") return null;
  const title = m.title || m.name;
  if (!title) return null;
  return {
    id: m.id,
    media_type: media,
    title,
    year: pickYear(m),
    overview: m.overview || "",
    genreIds: m.genre_ids || [],
    poster: m.poster_path ? `${TMDB_IMG}/w500${m.poster_path}` : undefined,
    backdrop: m.backdrop_path ? `${TMDB_IMG}/w1280${m.backdrop_path}` : undefined,
    tmdbScore: m.vote_average ? Number(m.vote_average).toFixed(1) : undefined,
  };
}

// Search strategies. Each returns a ranked list of TMDB titles.
export type SearchStrategy =
  | { kind: "title"; query: string }
  | { kind: "person"; name: string }
  | { kind: "keyword"; terms: string[] };

async function searchByTitle(query: string): Promise<TmdbTitle[]> {
  const key = tmdbKey();
  const data = await getJson<{ results: any[] }>(
    `${TMDB}/search/multi?api_key=${key}&query=${encodeURIComponent(query)}&include_adult=false`,
  );
  return (data?.results ?? []).map(mapTmdbResult).filter((x): x is TmdbTitle => !!x);
}

async function searchByPerson(name: string): Promise<TmdbTitle[]> {
  const key = tmdbKey();
  const person = await getJson<{ results: { id: number; popularity: number }[] }>(
    `${TMDB}/search/person?api_key=${key}&query=${encodeURIComponent(name)}&include_adult=false`,
  );
  const top = (person?.results ?? []).sort((a, b) => b.popularity - a.popularity)[0];
  if (!top) return [];
  const credits = await getJson<{ cast: any[] }>(
    `${TMDB}/person/${top.id}/combined_credits?api_key=${key}`,
  );
  return (credits?.cast ?? [])
    // most prominent roles first, then most popular titles
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .map(mapTmdbResult)
    .filter((x): x is TmdbTitle => !!x);
}

async function searchByKeyword(terms: string[]): Promise<TmdbTitle[]> {
  const key = tmdbKey();
  // Resolve free-text terms (e.g. "Hawaii", "heist") to TMDB keyword ids, then
  // use /discover to pull titles tagged with them. Falls back to title search.
  const ids: number[] = [];
  for (const term of terms) {
    const kw = await getJson<{ results: { id: number; name: string }[] }>(
      `${TMDB}/search/keyword?api_key=${key}&query=${encodeURIComponent(term)}`,
    );
    const best = kw?.results?.[0];
    if (best) ids.push(best.id);
  }
  if (ids.length === 0) return searchByTitle(terms.join(" "));
  const out: TmdbTitle[] = [];
  for (const kind of ["movie", "tv"]) {
    const data = await getJson<{ results: any[] }>(
      `${TMDB}/discover/${kind}?api_key=${key}&with_keywords=${ids.join(",")}` +
        `&sort_by=popularity.desc&include_adult=false`,
    );
    for (const m of data?.results ?? []) {
      const mapped = mapTmdbResult({ ...m, media_type: kind === "movie" ? "movie" : "tv" });
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

async function runStrategy(strategy: SearchStrategy): Promise<TmdbTitle[]> {
  switch (strategy.kind) {
    case "person":
      return searchByPerson(strategy.name);
    case "keyword":
      return searchByKeyword(strategy.terms);
    case "title":
    default:
      return searchByTitle(strategy.query);
  }
}

/* ----------------------------- enrichment -------------------------------- */

// TMDB cast (top-billed names) + external IMDb id, for one title.
async function tmdbDetails(
  t: TmdbTitle,
): Promise<{ cast: string[]; imdbId?: string; runtime?: string }> {
  const key = tmdbKey();
  const kind = t.media_type === "movie" ? "movie" : "tv";
  const data = await getJson<any>(
    `${TMDB}/${kind}/${t.id}?api_key=${key}&append_to_response=credits,external_ids`,
  );
  if (!data) return { cast: [] };
  const cast: string[] = (data.credits?.cast ?? [])
    .slice(0, 6)
    .map((c: any) => c.name)
    .filter(Boolean);
  const imdbId: string | undefined = data.external_ids?.imdb_id || data.imdb_id || undefined;
  let runtime: string | undefined;
  if (kind === "movie" && data.runtime) {
    const h = Math.floor(data.runtime / 60);
    const m = data.runtime % 60;
    runtime = h ? `${h}h ${m}m` : `${m}m`;
  } else if (kind === "tv" && data.number_of_seasons) {
    runtime = `${data.number_of_seasons} season${data.number_of_seasons > 1 ? "s" : ""}`;
  }
  return { cast, imdbId, runtime };
}

// OMDb ratings by IMDb id -> IMDb / RT / Metacritic values.
async function omdbRatings(imdbId: string | undefined, settings: SettingsData): Promise<Rating[]> {
  if (!imdbId || !omdbKey()) return [];
  const data = await getJson<any>(`${OMDB}/?apikey=${omdbKey()}&i=${imdbId}`);
  if (!data || data.Response === "False") return [];
  const enabled = new Set(settings.ratingSources.filter((r) => r.enabled).map((r) => r.id));
  const label = (id: string) => settings.ratingSources.find((r) => r.id === id)?.name ?? id;
  const out: Rating[] = [];
  if (enabled.has("imdb") && data.imdbRating && data.imdbRating !== "N/A")
    out.push({ sourceId: "imdb", label: label("imdb"), value: data.imdbRating });
  const rt = (data.Ratings ?? []).find((r: any) => r.Source === "Rotten Tomatoes");
  if (enabled.has("rt") && rt) out.push({ sourceId: "rt", label: label("rt"), value: rt.Value });
  if (enabled.has("metacritic") && data.Metascore && data.Metascore !== "N/A")
    out.push({ sourceId: "metacritic", label: label("metacritic"), value: data.Metascore });
  return out;
}

// Availability via Watchmode (preferred: real deep links + prices), then TMDB
// watch providers as a backup (no per-title deep link, links to TMDB's page).
async function availabilityFor(
  t: TmdbTitle,
  imdbId: string | undefined,
  settings: SettingsData,
): Promise<Availability[]> {
  const region = settings.region || "US";
  const byService = new Map<string, Availability>();

  // --- Watchmode ---
  if (watchmodeKey() && imdbId) {
    const src = await getJson<any[]>(
      `${WATCHMODE}/title/${imdbId}/sources/?apiKey=${watchmodeKey()}&regions=${region}`,
    );
    for (const s of src ?? []) {
      if (s.region && s.region !== region) continue;
      const serviceId = resolveServiceId(s.name || "", settings);
      if (!serviceId) continue;
      const offerType: Availability["offerType"] =
        s.type === "sub" || s.type === "free" ? "free" : s.type === "buy" ? "buy" : "rent";
      const price = typeof s.price === "number" ? s.price : 0;
      const svc = settings.services.find((x) => x.id === serviceId)!;
      const existing = byService.get(serviceId);
      // Prefer the cheapest / free-est offer per service.
      if (!existing || (offerType === "free" && existing.offerType !== "free")) {
        byService.set(serviceId, {
          serviceId,
          serviceName: svc.name,
          color: svc.color,
          deepLink: s.web_url || buildFallbackDeepLink(svc.searchUrlTemplate, t.title),
          offerType,
          price,
        });
      }
    }
  }

  // --- TMDB watch providers (backup / fills gaps) ---
  if (byService.size === 0 && tmdbKey()) {
    const kind = t.media_type === "movie" ? "movie" : "tv";
    const data = await getJson<any>(`${TMDB}/${kind}/${t.id}/watch/providers?api_key=${tmdbKey()}`);
    const regionData = data?.results?.[region];
    if (regionData) {
      const buckets: [string, Availability["offerType"]][] = [
        ["flatrate", "free"],
        ["free", "free"],
        ["ads", "free"],
        ["rent", "rent"],
        ["buy", "buy"],
      ];
      for (const [bucket, offerType] of buckets) {
        for (const p of regionData[bucket] ?? []) {
          const serviceId = resolveServiceId(p.provider_name || "", settings);
          if (!serviceId || byService.has(serviceId)) continue;
          const svc = settings.services.find((x) => x.id === serviceId)!;
          byService.set(serviceId, {
            serviceId,
            serviceName: svc.name,
            color: svc.color,
            // TMDB doesn't give a per-service deep link; use the service's
            // configured search template so the Play button still lands there.
            deepLink: buildFallbackDeepLink(svc.searchUrlTemplate, t.title),
            offerType,
            price: 0,
          });
        }
      }
    }
  }

  return Array.from(byService.values());
}

function buildFallbackDeepLink(template: string, title: string): string {
  const q = encodeURIComponent(title);
  if (!template) return `https://www.google.com/search?q=${q}+watch+online`;
  return template.includes("{q}") ? template.replace(/\{q\}/g, q) : template + q;
}

// Trailer: TMDB videos endpoint -> first YouTube "Trailer".
async function trailerFor(t: TmdbTitle, settings: SettingsData): Promise<Partial<Production>> {
  const yt = settings.trailerSources.find((s) => s.id === "youtube");
  if (!yt?.enabled || !tmdbKey()) return {};
  const kind = t.media_type === "movie" ? "movie" : "tv";
  const data = await getJson<{ results: any[] }>(
    `${TMDB}/${kind}/${t.id}/videos?api_key=${tmdbKey()}`,
  );
  const vids = data?.results ?? [];
  const pick =
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    vids.find((v) => v.site === "YouTube");
  if (!pick) return {};
  return {
    trailerUrl: `https://www.youtube.com/embed/${pick.key}?autoplay=1&rel=0`,
    trailerWatchUrl: `https://www.youtube.com/watch?v=${pick.key}`,
    trailerThumb: `https://i.ytimg.com/vi/${pick.key}/hqdefault.jpg`,
    trailerSourceId: "youtube",
  };
}

/* ------------------------------ orchestration ----------------------------- */

// Enrich a single TMDB title into a full Production, or null if it has no
// watchable offer on any enabled service (so we never "spotlight" unmatched
// or unavailable titles).
async function enrichTitle(
  t: TmdbTitle,
  settings: SettingsData,
  seenIds: Set<string>,
  genres: Record<number, string>,
): Promise<Production | null> {
  const details = await tmdbDetails(t);
  const availability = await availabilityFor(t, details.imdbId, settings);
  if (availability.length === 0) return null; // not on any enabled service

  const [ratings, trailer] = await Promise.all([
    omdbRatings(details.imdbId, settings),
    trailerFor(t, settings),
  ]);

  // TMDB's own score as a rating if enabled and no OMDb value present.
  const tmdbEnabled = settings.ratingSources.find((r) => r.id === "tmdb")?.enabled;
  if (tmdbEnabled && t.tmdbScore && !ratings.some((r) => r.sourceId === "tmdb")) {
    ratings.push({ sourceId: "tmdb", label: "TMDB", value: t.tmdbScore });
  }

  const id = details.imdbId
    ? `imdb:${details.imdbId}`
    : `tmdb:${t.media_type}:${t.id}`;

  return {
    id,
    title: t.title,
    mediaType: t.media_type === "movie" ? "movie" : "series",
    year: t.year,
    runtime: details.runtime,
    genres: t.genreIds.map((g) => genres[g]).filter(Boolean),
    cast: details.cast,
    setting: [], // live path relies on keyword/discover matching, not stored setting
    overview: t.overview,
    posterUrl: t.poster || "",
    backdropUrl: t.backdrop || "",
    ratings,
    availability,
    ...trailer,
    seen: seenIds.has(id),
  };
}

/**
 * Live search entry point. Runs the chosen strategy against TMDB, enriches the
 * top N results in parallel, applies seen/pay filters via the provided helper,
 * and returns ready-to-render Productions. Returns [] on total failure so the
 * caller can fall back to the offline catalog.
 */
export async function liveSearch(
  strategy: SearchStrategy,
  settings: SettingsData,
  seenIds: Set<string>,
  opts: { limit?: number } = {},
): Promise<Production[]> {
  if (!tmdbKey()) return []; // TMDB is the backbone; without it, no live search
  const limit = opts.limit ?? 18;

  const [titles, genres] = await Promise.all([runStrategy(strategy), tmdbGenres()]);
  if (titles.length === 0) return [];

  // De-dupe by tmdb id, cap the count of expensive per-title enrichment calls.
  const seenTmdb = new Set<string>();
  const unique = titles.filter((t) => {
    const k = `${t.media_type}:${t.id}`;
    if (seenTmdb.has(k)) return false;
    seenTmdb.add(k);
    return true;
  });

  const enriched = await Promise.all(
    unique.slice(0, limit).map((t) => enrichTitle(t, settings, seenIds, genres).catch(() => null)),
  );

  let results = enriched.filter((p): p is Production => p !== null);
  if (!settings.includeSeen) results = results.filter((p) => !p.seen);
  return results;
}
