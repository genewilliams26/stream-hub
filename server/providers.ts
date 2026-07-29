import { CATALOG, type CatalogEntry } from "./catalog";
import type {
  Production,
  Rating,
  Availability,
  SettingsData,
} from "@shared/schema";

/**
 * Provider layer
 * --------------
 * This is the single seam where you swap mock data for live APIs.
 *
 * To go live, set environment variables (the app reads them automatically):
 *   TMDB_API_KEY        — metadata, posters, trailers   (themoviedb.org)
 *   OMDB_API_KEY        — IMDb / Rotten Tomatoes / Metacritic ratings (omdbapi.com)
 *   WATCHMODE_API_KEY   — streaming availability + deep links (watchmode.com)
 *
 * Streaming-service credentials (e.g. session tokens you mentioned having) are
 * NOT needed for search/discovery — deep links open the public title page on
 * each service, where the user is already signed in in their browser.
 *
 * When no keys are present, everything falls back to the bundled CATALOG so the
 * app is fully functional on the Raspberry Pi out of the box.
 */

// Canonical live-provider detection lives in live.ts (the module that actually
// talks to TMDB/Watchmode/OMDb). Re-exported here so existing imports keep
// working and there is a single source of truth.
export { hasLiveProviders } from "./live";

// ---- Deep link builder (configurable per-service in settings) ----
function buildDeepLink(template: string, title: string): string {
  const q = encodeURIComponent(title);
  return template.includes("{q}")
    ? template.replace(/\{q\}/g, q)
    : template + q;
}

// ---- Trailer assembly (respects configured trailer-source priority) ----
function buildTrailer(
  entry: CatalogEntry,
  settings: SettingsData,
): Pick<
  Production,
  "trailerUrl" | "trailerWatchUrl" | "trailerThumb" | "trailerSourceId"
> {
  // In the mock layer we only have YouTube ids, but we still honor the
  // enabled/priority config: if YouTube is disabled we drop the trailer.
  const yt = settings.trailerSources.find((s) => s.id === "youtube");
  if (entry.trailerId && yt?.enabled) {
    return {
      // Embeddable URL — used by the in-app modal player ("embed" mode).
      trailerUrl: `https://www.youtube.com/embed/${entry.trailerId}?autoplay=1&rel=0`,
      // Full watch-page URL — used by "redirect" mode (lighter on low-RAM kiosks).
      trailerWatchUrl: `https://www.youtube.com/watch?v=${entry.trailerId}`,
      trailerThumb: `https://i.ytimg.com/vi/${entry.trailerId}/hqdefault.jpg`,
      trailerSourceId: "youtube",
    };
  }
  return {};
}

// ---- Convert a catalog entry into a Production using current settings ----
export function entryToProduction(
  entry: CatalogEntry,
  settings: SettingsData,
  seenIds: Set<string>,
): Production {
  const enabledRatings = settings.ratingSources.filter((r) => r.enabled);
  const ratings: Rating[] = enabledRatings
    .map((r) => {
      const value = (entry.ratings as Record<string, string | undefined>)[r.id];
      return value ? { sourceId: r.id, label: r.name, value } : null;
    })
    .filter((x): x is Rating => x !== null);

  const enabledServiceIds = new Set(
    settings.services.filter((s) => s.enabled).map((s) => s.id),
  );
  const availability: Availability[] = entry.offers
    .filter((o) => enabledServiceIds.has(o.service))
    .map((o) => {
      const svc = settings.services.find((s) => s.id === o.service)!;
      return {
        serviceId: svc.id,
        serviceName: svc.name,
        color: svc.color,
        deepLink: buildDeepLink(svc.searchUrlTemplate, entry.title),
        offerType: o.type,
        price: o.price ?? 0,
      };
    });

  return {
    id: entry.id,
    title: entry.title,
    mediaType: entry.mediaType,
    year: entry.year,
    runtime: entry.runtime,
    genres: entry.genres,
    cast: entry.cast ?? [],
    setting: entry.setting ?? [],
    overview: entry.overview,
    posterUrl: "", // UI renders a generated gradient poster from the title
    backdropUrl: "",
    ratings,
    availability,
    ...buildTrailer(entry, settings),
    seen: seenIds.has(entry.id),
  };
}

/**
 * Apply the free/pay filter to a production's availability based on settings.
 * Returns the same production with its `availability` narrowed, or null if no
 * watchable offer remains.
 *
 *  - includePay OFF  -> keep only free offers.
 *  - includePay ON   -> keep free offers + pay offers whose price <= payLimit
 *                       (payLimit 0 = no limit).
 */
export function applyPayFilter(
  p: Production,
  settings: SettingsData,
): Production | null {
  const limit = settings.payLimit && settings.payLimit > 0 ? settings.payLimit : Infinity;
  const kept = p.availability.filter((a) => {
    if (a.offerType === "free") return true;
    if (!settings.includePay) return false;
    return a.price <= limit;
  });
  if (kept.length === 0) return null;
  // Sort: free first, then cheapest pay.
  kept.sort((a, b) => {
    const av = a.offerType === "free" ? -1 : a.price;
    const bv = b.offerType === "free" ? -1 : b.price;
    return av - bv;
  });
  return { ...p, availability: kept };
}

/**
 * Returns the full candidate set (already filtered to enabled services + pay
 * settings). Live-provider implementations would query TMDB/Watchmode here.
 */
export function getCandidates(
  settings: SettingsData,
  seenIds: Set<string>,
): Production[] {
  // Offline candidate set from the bundled catalog. The LIVE query-driven path
  // (TMDB/Watchmode/OMDb) is handled in search.ts -> live.ts; this remains the
  // browse-mode + offline-fallback source.
  return CATALOG.map((e) => entryToProduction(e, settings, seenIds))
    .filter((p) => p.availability.length > 0)
    .map((p) => applyPayFilter(p, settings))
    .filter((p): p is Production => p !== null);
}
