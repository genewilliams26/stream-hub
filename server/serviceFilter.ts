import type { SettingsData, Production } from "@shared/schema";

/**
 * Service-filter detection
 * ------------------------
 * When a query names a streaming service ("... on netflix", "hbo shows",
 * "what's on prime"), we want to RESTRICT results to that service rather than
 * treat the service name as search content. This module:
 *   - detects which configured/enabled service(s) a query refers to,
 *   - strips those words from the query so the remaining text is the real
 *     search intent ("psychological thrillers"),
 *   - filters a result list down to titles available on the requested service.
 *
 * Only services the user has ENABLED in settings are considered, so "netflix"
 * is ignored if Netflix is toggled off.
 */

// Common aliases → canonical service id (must match settings service ids).
const SERVICE_ALIASES: Record<string, string> = {
  netflix: "netflix",
  nflx: "netflix",
  prime: "prime",
  "prime video": "prime",
  "amazon prime": "prime",
  amazon: "prime",
  disney: "disney",
  "disney+": "disney",
  "disney plus": "disney",
  hulu: "hulu",
  max: "max",
  hbo: "max",
  "hbo max": "max",
  paramount: "paramount",
  "paramount+": "paramount",
  "paramount plus": "paramount",
  peacock: "peacock",
  discovery: "discovery",
  "discovery+": "discovery",
  pluto: "pluto",
  "pluto tv": "pluto",
  tubi: "tubi",
  apple: "appletv",
  "apple tv": "appletv",
  "apple tv+": "appletv",
  appletv: "appletv",
};

export interface ServiceFilterResult {
  serviceIds: string[]; // enabled services named in the query (may be empty)
  cleanedQuery: string; // query with service words removed
  matchedNames: string[]; // display names for interpreted-text
}

/**
 * Detect service references in a query, limited to services the user enabled.
 * Longest aliases are checked first so "prime video" wins over "prime".
 */
export function detectServiceFilter(query: string, settings: SettingsData): ServiceFilterResult {
  const enabled = new Set(
    settings.services.filter((s) => s.enabled).map((s) => s.id),
  );
  const nameById = new Map(settings.services.map((s) => [s.id, s.name]));

  let working = ` ${query.toLowerCase()} `;
  const foundIds = new Set<string>();

  // Sort aliases by word length desc so multi-word aliases match first.
  const aliases = Object.keys(SERVICE_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const id = SERVICE_ALIASES[alias];
    if (!enabled.has(id)) continue; // ignore services the user turned off
    // Word-boundary match on the alias (handles "on netflix", "netflix shows").
    const re = new RegExp(`(?<![a-z0-9])${alias.replace(/[+]/g, "\\+")}(?![a-z0-9])`, "gi");
    if (re.test(working)) {
      foundIds.add(id);
      working = working.replace(re, " ");
    }
  }

  // Remove now-orphaned connector words left behind by the service term.
  let cleaned = working
    .replace(/\b(on|from|via|streaming|available|whats|what\s+is)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // If NO service was detected, never hand back an empty query (preserve intent).
  // If a service WAS detected and nothing meaningful remains, leave it empty so
  // the caller can treat it as a "browse this service" request.
  if (!cleaned && foundIds.size === 0) cleaned = query.trim();

  const serviceIds = Array.from(foundIds);
  return {
    serviceIds,
    cleanedQuery: cleaned,
    matchedNames: serviceIds.map((id) => nameById.get(id) ?? id),
  };
}

/**
 * Keep only titles available on at least one of the requested services.
 * If serviceIds is empty, returns the list unchanged (search all services).
 */
export function filterByServices(
  results: Production[],
  serviceIds: string[],
): Production[] {
  if (serviceIds.length === 0) return results;
  const wanted = new Set(serviceIds);
  return results.filter((p) =>
    (p.availability ?? []).some((a) => wanted.has(a.serviceId)),
  );
}
