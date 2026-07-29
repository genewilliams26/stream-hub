import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * stream-hub data model
 * ---------------------
 * The app persists three things server-side:
 *   1. seen_productions  — which titles the user has marked "seen" (remembered).
 *   2. app_settings      — a single-row settings blob (configurable services,
 *                          rating sources, trailer sources, etc.).
 *
 * Catalog/metadata (posters, ratings, streaming availability, trailers) come
 * from external providers at runtime (TMDB / OMDb / Watchmode) OR, when no API
 * keys are present, from the bundled mock dataset in server/catalog.ts.
 * We do NOT persist the catalog itself — only the user's "seen" decisions and
 * their settings — so the dataset can be swapped for live APIs freely.
 */

/* ----------------------------- seen state ----------------------------- */

export const seenProductions = sqliteTable("seen_productions", {
  // Stable production id. Prefer "imdb:tt1234567" or "tmdb:movie:603".
  productionId: text("production_id").primaryKey(),
  title: text("title").notNull(),
  // "movie" | "series"
  mediaType: text("media_type").notNull().default("movie"),
  year: integer("year"),
  seenAt: integer("seen_at").notNull(), // epoch ms
});

export const insertSeenSchema = createInsertSchema(seenProductions).omit({
  seenAt: true,
});
export type InsertSeen = z.infer<typeof insertSeenSchema>;
export type SeenProduction = typeof seenProductions.$inferSelect;

/* ------------------------------ settings ------------------------------ */
// Stored as a single JSON row so the shape can evolve without migrations.

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(), // always 1 (singleton)
  data: text("data").notNull(), // JSON string of SettingsData
});

// ---- Settings shape (validated in app code, stored as JSON) ----

export const streamingServiceSchema = z.object({
  id: z.string(), // "netflix", "appletv", "prime", "disney", "hulu", "discovery", "pluto", "tubi"
  name: z.string(), // "Netflix"
  enabled: z.boolean().default(true),
  // Base URL used to build a deep link to a title page on this service.
  // {q} is replaced with the URL-encoded title. Configurable per service.
  searchUrlTemplate: z.string().default(""),
  // Brand color used for the source chip.
  color: z.string().default("#888888"),
});
export type StreamingService = z.infer<typeof streamingServiceSchema>;

// Which rating providers to show, and in what order. Exactly the 3 the user
// asked for by default (IMDb, Rotten Tomatoes, Metacritic), all configurable.
export const ratingSourceSchema = z.object({
  id: z.string(), // "imdb" | "rt" | "metacritic" | "tmdb" | "letterboxd"
  name: z.string(), // display label
  enabled: z.boolean().default(true),
});
export type RatingSource = z.infer<typeof ratingSourceSchema>;

export const trailerSourceSchema = z.object({
  id: z.string(), // "youtube" | "vimeo" | "appletv" | "tmdb"
  name: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().default(0), // lower = more preferred
});
export type TrailerSource = z.infer<typeof trailerSourceSchema>;

export const settingsDataSchema = z.object({
  services: z.array(streamingServiceSchema),
  ratingSources: z.array(ratingSourceSchema),
  trailerSources: z.array(trailerSourceSchema),
  includeSeen: z.boolean().default(false), // global "include seen" toggle
  includePay: z.boolean().default(false), // global "include pay" toggle
  // Max price (USD) for pay titles when includePay is on. Titles whose cheapest
  // pay offer exceeds this are hidden. 0 / undefined means "no limit".
  payLimit: z.number().default(0),
  aiSearch: z.boolean().default(true), // natural-language interpretation on/off
  // ISO 3166-1 country code for region-specific streaming availability & pricing
  // (used by the live TMDB/Watchmode providers). Defaults to US.
  region: z.string().default("US"),
  // How trailers play. "embed" (default) plays in an in-app modal iframe.
  // "redirect" navigates the whole tab to the trailer's watch page and lets
  // the user return to stream-hub afterwards. On low-RAM kiosks (e.g. the 1 GB
  // Raspberry Pi 3) "redirect" frees the app's DOM/compositor while the video
  // plays, which is lighter than layering the YouTube player over the app.
  trailerMode: z.enum(["embed", "redirect"]).default("embed"),
});
export type SettingsData = z.infer<typeof settingsDataSchema>;

/* ------------------------- catalog / runtime types ------------------------- */
// These are NOT DB tables. They describe the shape of a search result that the
// backend returns (assembled from mock data or live providers).

export const ratingSchema = z.object({
  sourceId: z.string(), // matches RatingSource.id
  label: z.string(), // "IMDb"
  value: z.string(), // "8.6", "94%", "78"
});
export type Rating = z.infer<typeof ratingSchema>;

// offerType:
//   "free"   — included with subscription / ad-supported / prepaid (no extra cost)
//   "rent"   — pay-per-view rental (has a price)
//   "buy"    — purchase (has a price)
export const offerTypeSchema = z.enum(["free", "rent", "buy"]);
export type OfferType = z.infer<typeof offerTypeSchema>;

export const availabilitySchema = z.object({
  serviceId: z.string(), // matches StreamingService.id
  serviceName: z.string(),
  color: z.string(),
  deepLink: z.string(), // URL to the title page on that service
  offerType: offerTypeSchema.default("free"),
  price: z.number().default(0), // USD; 0 for free/prepaid
});
export type Availability = z.infer<typeof availabilitySchema>;

export const productionSchema = z.object({
  id: z.string(),
  title: z.string(),
  mediaType: z.enum(["movie", "series"]),
  year: z.number().optional(),
  runtime: z.string().optional(), // "2h 16m" or "3 seasons"
  genres: z.array(z.string()).default([]),
  // Principal cast (actor names) — powers "movies with Denzel Washington".
  cast: z.array(z.string()).default([]),
  // Where the story is set (locations/regions) — powers "movies set in Hawaii".
  setting: z.array(z.string()).default([]),
  overview: z.string().default(""),
  posterUrl: z.string().default(""),
  backdropUrl: z.string().default(""),
  ratings: z.array(ratingSchema).default([]),
  availability: z.array(availabilitySchema).default([]),
  trailerUrl: z.string().optional(), // embeddable trailer URL (YouTube embed etc.)
  trailerWatchUrl: z.string().optional(), // full watch-page URL (for redirect mode)
  trailerThumb: z.string().optional(),
  trailerSourceId: z.string().optional(),
  seen: z.boolean().default(false),
});
export type Production = z.infer<typeof productionSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  interpreted: z.string().optional(), // how the AI understood the query
  usedAi: z.boolean().default(false),
  results: z.array(productionSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
