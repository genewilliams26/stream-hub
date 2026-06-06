import { CATALOG } from "./catalog";
import type { Production, SettingsData, SearchResponse } from "@shared/schema";
import { getCandidates } from "./providers";

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

// Lightweight fuzzy: token overlap + substring bonus.
function offlineScore(query: string, entry: (typeof CATALOG)[number]): number {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = q.split(" ").filter((t) => t.length > 1);
  const haystack = normalize(
    [entry.title, entry.genres.join(" "), entry.keywords.join(" "), entry.overview, String(entry.year)].join(" "),
  );
  const titleNorm = normalize(entry.title);

  let score = 0;
  // strong: exact-ish title hit
  if (titleNorm.includes(q)) score += 50;
  for (const t of qTokens) {
    if (titleNorm.includes(t)) score += 8;
    if (haystack.includes(t)) score += 3;
    // keyword exact
    if (entry.keywords.some((k) => normalize(k).includes(t))) score += 4;
    if (entry.genres.some((g) => normalize(g).includes(t))) score += 4;
  }
  return score;
}

function offlineSearch(
  query: string,
  candidates: Production[],
): Production[] {
  // Map catalog scoring onto candidate productions (same ids).
  const scoreById = new Map<string, number>();
  for (const entry of CATALOG) scoreById.set(entry.id, offlineScore(query, entry));
  const scored = candidates
    .map((p) => ({ p, score: scoreById.get(p.id) ?? 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  // If nothing matched (very loose query), return a relevance-neutral set
  if (scored.length === 0) return [];
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
  // Empty query → show everything (browse mode).
  if (!trimmed) {
    return { query, usedAi: false, results: visible };
  }

  // Try AI ranking first.
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

  // Offline fallback.
  const results = offlineSearch(trimmed, visible);
  return {
    query,
    interpreted: results.length ? "Matched by title, genre & keywords" : "No matches found",
    usedAi: false,
    results,
  };
}
