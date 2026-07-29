import { CATALOG } from "./catalog";
import type { Production, SettingsData, SearchResponse } from "@shared/schema";
import { getCandidates, applyPayFilter } from "./providers";
import { hasLiveProviders, liveSearch, type SearchStrategy } from "./live";

/**
 * AI / natural-language search.
 * -----------------------------
 * Strategy:
 *   1. If aiSearch is on AND an LLM is reachable (ANTHROPIC creds present),
 *      ask the model to rank the catalog against the natural-language query
 *      and explain its interpretation.
 *   2. Otherwise fall back to a robust offline scorer (title + keyword +
 *      genre + overview matching with fuzzy tolerance). This is what runs on
 *      the Raspberry Pi by default — no network, no keys required.
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Filler words that carry no matching signal. Stripping them stops queries like
// "movies set in Hawaii" from matching every movie via the token "movies".
const STOPWORDS = new Set([
  "movie", "movies", "film", "films", "show", "shows", "series", "tv",
  "with", "set", "in", "on", "at", "the", "a", "an", "of", "and", "or",
  "about", "featuring", "starring", "star", "stars", "like", "me", "some",
  "that", "for", "to", "is", "are", "where", "any", "give", "show me",
]);

function contentTokens(query: string): string[] {
  return normalize(query)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Lightweight fuzzy: token overlap + substring bonus, now cast/setting aware.
function offlineScore(query: string, entry: (typeof CATALOG)[number]): number {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = contentTokens(query);
  if (qTokens.length === 0) return 0;

  const cast = entry.cast ?? [];
  const setting = entry.setting ?? [];
  const titleNorm = normalize(entry.title);
  const castNorm = normalize(cast.join(" "));
  const settingNorm = normalize(setting.join(" "));
  const haystack = normalize(
    [entry.title, entry.genres.join(" "), entry.keywords.join(" "), entry.overview, String(entry.year)].join(" "),
  );
  // Word-set for whole-word matching, so a query token like "space" does NOT
  // match "Spacey" (a substring) in the cast. Short tokens especially need this.
  const castWords = new Set(castNorm.split(" "));
  const settingWords = new Set(settingNorm.split(" "));

  let score = 0;
  // strong: exact-ish title hit (use content tokens so "movies" doesn't count)
  const qContent = qTokens.join(" ");
  if (titleNorm.includes(qContent)) score += 50;
  // Strong: full actor-name phrase ("denzel washington") appears in cast.
  // Multi-word phrases match as substrings (a real name); single tokens must
  // match a whole cast word so "space" can't hit "Spacey".
  const multiWord = qTokens.length > 1;
  if (qContent.length > 2 && (multiWord ? castNorm.includes(qContent) : castWords.has(qContent)))
    score += 40;
  // Strong: a setting/location phrase ("hawaii") appears in setting.
  if (qContent.length > 2 && (multiWord ? settingNorm.includes(qContent) : settingWords.has(qContent)))
    score += 30;

  for (const t of qTokens) {
    if (titleNorm.includes(t)) score += 8;
    if (castWords.has(t)) score += 10; // whole-word actor token: strong signal
    if (settingWords.has(t)) score += 9; // whole-word location token: strong signal
    if (entry.keywords.some((k) => normalize(k).includes(t))) score += 4;
    if (entry.genres.some((g) => normalize(g).includes(t))) score += 4;
    if (haystack.includes(t)) score += 2;
  }
  return score;
}

// Minimum score to be considered a genuine match. Prevents "spotlighting"
// loosely-related titles that only brushed a single weak token. A lone generic
// genre OR keyword hit (4) + haystack echo (2) = 6 must NOT qualify; a genuine
// match needs a strong signal (title/cast/setting phrase) or multiple token
// hits across fields.
const MIN_SCORE = 8;

function offlineSearch(
  query: string,
  candidates: Production[],
): Production[] {
  // Map catalog scoring onto candidate productions (same ids).
  const scoreById = new Map<string, number>();
  for (const entry of CATALOG) scoreById.set(entry.id, offlineScore(query, entry));
  const scored = candidates
    .map((p) => ({ p, score: scoreById.get(p.id) ?? 0 }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  // No confident match → return nothing rather than off-topic filler.
  return scored.map((x) => x.p);
}

async function aiRankIds(query: string): Promise<{ ids: string[]; interpreted: string } | null> {
  // Only attempt if the Anthropic SDK + creds are available at runtime.
  try {
    // Dynamic import so the app still builds/runs without the SDK present.
    const mod = await import("@anthropic-ai/sdk").catch(() => null as any);
    const Anthropic = mod?.default;
    if (!Anthropic) return null;
    const client = new Anthropic();
    const catalogForModel = CATALOG.map((e) => ({
      id: e.id,
      title: e.title,
      year: e.year,
      type: e.mediaType,
      genres: e.genres,
      keywords: e.keywords,
    }));
    const prompt = `You are a film & TV search engine. The user typed a natural-language query.
Pick and rank the matching titles from the CATALOG. Consider mood, plot hints, era, genre, vague descriptions ("that movie with the spinning top"), and partial titles.

Return STRICT JSON only: {"interpreted":"<one short sentence on how you read the query>","ids":["<id>", ...]}
Only use ids that exist in the catalog. Best match first. If nothing fits, return an empty ids array.

QUERY: ${JSON.stringify(query)}
CATALOG: ${JSON.stringify(catalogForModel)}`;
    const msg = await client.messages.create({
      model: "claude_haiku_4_5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content?.[0] as any)?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.ids)) return null;
    return { ids: parsed.ids, interpreted: parsed.interpreted ?? "" };
  } catch {
    return null;
  }
}

/* ------------------------- query intent classification -------------------- */
// For the LIVE path we don't rank a fixed catalog — we must decide HOW to query
// TMDB: by title, by actor/person, or by theme/location keywords. The AI does
// this when available; a heuristic covers the offline-AI / no-key case.

type Intent = { strategy: SearchStrategy; interpreted: string };

const ACTOR_CUE = /\b(with|starring|features?|featuring|actor|actress|stars?)\b/i;
const LOCATION_CUE = /\b(set in|takes? place in|located in|based in|about)\b/i;

function heuristicIntent(query: string): Intent {
  const q = query.trim();
  // "movies with Denzel Washington" / "starring Tom Hanks"
  const actorMatch = q.match(/(?:with|starring|featuring|features?)\s+(.+)$/i);
  if (ACTOR_CUE.test(q) && actorMatch) {
    const name = actorMatch[1].replace(/\b(movies?|films?|shows?|tv|series)\b/gi, "").trim();
    if (name.split(/\s+/).length <= 4 && name.length > 2) {
      return { strategy: { kind: "person", name }, interpreted: `Films & shows featuring ${name}` };
    }
  }
  // "movies set in Hawaii" / "shows about space"
  const locMatch = q.match(/(?:set in|takes? place in|located in|based in|about)\s+(.+)$/i);
  if (LOCATION_CUE.test(q) && locMatch) {
    const terms = locMatch[1]
      .replace(/\b(movies?|films?|shows?|tv|series)\b/gi, "")
      .trim()
      .split(/\s*,\s*|\s+and\s+/)
      .filter(Boolean);
    if (terms.length) {
      return { strategy: { kind: "keyword", terms }, interpreted: `Titles about ${terms.join(", ")}` };
    }
  }
  // Default: treat as a title / free-text search.
  return { strategy: { kind: "title", query: q }, interpreted: `Search results for “${q}”` };
}

async function aiIntent(query: string): Promise<Intent | null> {
  try {
    const mod = await import("@anthropic-ai/sdk").catch(() => null as any);
    const Anthropic = mod?.default;
    if (!Anthropic) return null;
    const client = new Anthropic();
    const prompt = `You route a movie/TV search query to ONE lookup strategy.
Strategies:
- "person": the user wants titles featuring a specific actor/director. Extract the person's full name.
- "keyword": the user describes a theme, setting, location, or plot (e.g. "set in Hawaii", "about time travel", "heist movies"). Extract 1-3 concise search terms (locations, themes) WITHOUT filler words like "movies", "set", "in".
- "title": the user is naming (or partially naming) a specific title, or none of the above fit.

Return STRICT JSON only, one of:
{"strategy":"person","name":"<full name>","interpreted":"<short sentence>"}
{"strategy":"keyword","terms":["<term>", ...],"interpreted":"<short sentence>"}
{"strategy":"title","query":"<cleaned query>","interpreted":"<short sentence>"}

QUERY: ${JSON.stringify(query)}`;
    const msg = await client.messages.create({
      model: "claude_haiku_4_5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content?.[0] as any)?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const p = JSON.parse(m[0]);
    const interpreted = typeof p.interpreted === "string" ? p.interpreted : "";
    if (p.strategy === "person" && p.name) {
      return { strategy: { kind: "person", name: String(p.name) }, interpreted };
    }
    if (p.strategy === "keyword" && Array.isArray(p.terms) && p.terms.length) {
      return { strategy: { kind: "keyword", terms: p.terms.map(String) }, interpreted };
    }
    if (p.strategy === "title") {
      return { strategy: { kind: "title", query: String(p.query ?? query) }, interpreted };
    }
    return null;
  } catch {
    return null;
  }
}

export async function runSearch(
  query: string,
  settings: SettingsData,
  seenIds: Set<string>,
): Promise<SearchResponse> {
  const candidates = getCandidates(settings, seenIds);
  const visible = settings.includeSeen
    ? candidates
    : candidates.filter((p) => !p.seen);

  const trimmed = query.trim();
  // Empty query → show everything (browse mode) from the offline catalog.
  if (!trimmed) {
    return { query, usedAi: false, results: visible };
  }

  /* ---------------- LIVE path: real-time APIs when keys exist ------------- */
  if (hasLiveProviders()) {
    // Decide how to query TMDB (actor / theme-location / title).
    const intent = (settings.aiSearch ? await aiIntent(trimmed) : null) ?? heuristicIntent(trimmed);
    try {
      const live = await liveSearch(intent.strategy, settings, seenIds);
      // Apply the same free/pay filter used for the offline catalog.
      const filtered = live
        .map((p) => applyPayFilter(p, settings))
        .filter((p): p is Production => p !== null);
      if (filtered.length > 0) {
        return {
          query,
          interpreted: intent.interpreted,
          usedAi: Boolean(settings.aiSearch),
          results: filtered,
        };
      }
      // Live returned nothing watchable → fall through to offline catalog so the
      // kiosk still shows the bundled results rather than an empty screen.
    } catch {
      // Any live failure → offline fallback below.
    }
  }

  /* ---------------- OFFLINE path: bundled catalog ------------------------- */
  // Try AI ranking of the bundled catalog first.
  if (settings.aiSearch) {
    const ai = await aiRankIds(trimmed);
    if (ai && ai.ids.length > 0) {
      const byId = new Map(visible.map((p) => [p.id, p]));
      const ordered = ai.ids.map((id) => byId.get(id)).filter((p): p is Production => !!p);
      if (ordered.length > 0) {
        return { query, interpreted: ai.interpreted, usedAi: true, results: ordered };
      }
    }
  }

  // Offline fuzzy fallback.
  const results = offlineSearch(trimmed, visible);
  return {
    query,
    interpreted: results.length ? "Matched by title, genre & keywords" : "No matches found",
    usedAi: false,
    results,
  };
}
