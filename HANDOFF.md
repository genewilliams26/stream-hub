# Stream-Hub — Session Handoff

> Purpose: single-file context transfer so a fresh AI session can pick up work on this
> project without re-deriving everything. Last updated: 2026-07-29.

## What this is

An AI-powered streaming aggregator web app for the Williams family. You type a natural-language
query ("mind-bending sci-fi", "movies with Denzel Washington", "something set in Hawaii") and it
returns titles with **where to watch them across the family's subscribed services**, ratings
(IMDb / Rotten Tomatoes / Metacritic), and an in-app trailer player. Designed to run as a
**Chromium kiosk on a Raspberry Pi**.

- **Repo:** `genewilliams26/stream-hub` (branch `main`)
- **Local workspace:** `/home/user/workspace/streamhub/`
- **Owner:** Gene / FE Williams — gene.williams26@gmail.com, Buda TX, America/Chicago (CDT), advanced technical user.

## Stack

Fullstack single-port app from the webapp template:
- **Frontend:** Vite + React + Tailwind (v3) + shadcn/ui + wouter (hash routing) + TanStack Query v5
- **Backend:** Express (`server/index.ts` boots it, calls `registerRoutes`)
- **Persistence:** better-sqlite3 + Drizzle ORM (`data.db`, gitignored)
- **Shared types:** `shared/schema.ts` (Zod + Drizzle), re-exported to client via `client/src/lib/types.ts`

## Two operating modes (IMPORTANT)

1. **Offline / no keys (default):** searches a bundled catalog in `server/catalog.ts` (**31 titles**,
   each enriched with `cast` + `setting`). This is what the Pi kiosk falls back to so it never shows
   an empty screen. Great for demos.
2. **Live / with keys:** real-time search against external APIs. Activates automatically when keys
   are present in `.env`. Falls back to offline gracefully on any failure/timeout.

`GET /api/status` reports which mode is active: `{liveProviders, providers:{tmdb,omdb,watchmode}, aiAvailable}`.

## Live provider layer — `server/live.ts` (~474 lines)

TMDB is the **backbone** (no TMDB key ⇒ no live search). Exports:
`tmdbKey()`, `omdbKey()`, `watchmodeKey()`, `hasLiveProviders()`, `liveSearch(strategy, settings, seenIds, opts)`,
and type `SearchStrategy = {kind:"title";query} | {kind:"person";name} | {kind:"keyword";terms[]}`.

- **TMDB endpoints used:** `search/multi`, `search/person` + `person/{id}/combined_credits`,
  `search/keyword` + `discover/{movie|tv}?with_keywords`, `{movie|tv}/{id}?append_to_response=credits,external_ids`,
  `/videos` (trailer), `/watch/providers`, `genre/{kind}/list`.
- **Watchmode:** `title/{imdbId}/sources/?regions={region}` → real deep links (`web_url`) + prices.
- **OMDb:** `?i={imdbId}` → IMDb / RT / Metacritic ratings.
- `NAME_TO_SERVICE` maps provider display names → app service ids
  (netflix, prime, disney, hulu, max, paramount, peacock, tubi, pluto, discovery, appletv).
- All fetches go through `getJson()` with an 8s timeout and **never throw**.
- `enrichTitle()` returns `null` when there's no watchable offer on an enabled service
  (prevents spotlighting titles the user can't actually watch).
- Region-aware via `settings.region` (ISO 3166-1, default `"US"`).

## Search flow — `server/search.ts` (~285 lines)

`runSearch(query, settings, seenIds)`:
1. Empty query → browse mode.
2. If `hasLiveProviders()` → classify intent → `liveSearch()` → `applyPayFilter` → return.
   - Intent classification: `aiIntent()` (Claude haiku_4_5 routes to person/keyword/title JSON) with
     `heuristicIntent()` regex fallback (actor cues `with|starring|featuring` → person; location cues
     `set in|about|located in` → keyword; else title).
3. If live returns empty / fails → **fall through to OFFLINE**: `aiRankIds` over bundled catalog, then
   `offlineSearch` fuzzy scorer.

**Offline scorer details** (these were hard-won — don't regress them):
- `contentTokens()` strips STOPWORDS (movie/movies/with/set/in/the/…).
- Whole-word matching for cast/setting via `castWords`/`settingWords` Sets — fixes the
  "space" matching "Spacey" bug. Multi-word phrase = substring match; single token = whole-word.
- `MIN_SCORE = 8` gate stops lone generic genre/keyword hits from qualifying.
- Scoring weights: title phrase +50, cast phrase +40, setting phrase +30; per-token title +8,
  cast +10, setting +9, keyword +4, genre +4, haystack +2.

## Split-view in-app trailer player (built 2026-07-29)

Trailers only (YouTube embeds). Netflix/Prime/Disney+ real playback is **impossible** to embed
(DRM + anti-iframe headers) — user accepted this. The Play button deep-links out to the service.

- **`client/src/components/player/PlayerContext.tsx`** — React context. State: `playing` (NowPlaying|null),
  `mode` ("fullscreen"|"docked"). `play()` always starts fullscreen. `toggleMode()`, `setMode()`, `close()`.
- **`client/src/components/player/PlayerPanel.tsx`** — the surface + keyboard handling:
  - Click a trailer → **fullscreen** (fixed inset-0 overlay).
  - **Esc while fullscreen → docked** (fixed right half, `md:w-1/2`); does NOT close.
  - **Esc while docked → close.**
  - Fullscreen/restore toggle button at panel top-right; also a "Watch on \<service\>" deep-link + close.
  - Renders a YouTube `<iframe>` keyed on `id+mode` so it remounts cleanly on mode change.
- **`client/src/App.tsx`** — wraps app in `PlayerProvider`; renders `<PlayerPanel/>` globally; a
  `PlayerLayout` wrapper applies `md:pr-[50vw]` when docked so search/results/controls shift LEFT.
- **`client/src/components/ResultBar.tsx`** — `openTrailer()` calls `player.play({...})` in embed mode
  (redirect mode still `window.location.assign(watchUrl)`). Passes primary offer's `serviceName`/`deepLink`.
- The old `TrailerDialog.tsx` modal is now **dead code** (no longer imported) — left in tree, safe to delete.

QA verified (Playwright): click→fullscreen 1280×800; Esc→docked x=640/w=640 with app-shell paddingRight=640px;
fullscreen button→back; Esc from docked→closes; real Matrix trailer loaded in the docked panel.

## Schema additions — `shared/schema.ts`

- `productionSchema`: `cast: z.array(z.string()).default([])`, `setting: z.array(z.string()).default([])`.
- `settingsDataSchema`: `region: z.string().default("US")`.

## Other files touched

- `server/providers.ts` — re-exports `hasLiveProviders` from `./live` (single source of truth);
  `entryToProduction` now carries `cast`/`setting`; `getCandidates` is the offline/browse source only.
- `server/defaults.ts` — `region: "US"`; added services max (#0046FF), paramount (#0064FF), peacock (#000000).
- `server/routes.ts` — `/api/status` returns live-provider availability.
- `server/catalog.ts` — 31 titles, all enriched with cast+setting; includes 4 Denzel + 4 Hawaii-set titles.
- `.env.example` — documents keys + region behavior.

## Environment keys (all optional; put in `.env`, gitignored)

```
TMDB_API_KEY=        # backbone — required for ANY live search
OMDB_API_KEY=        # IMDb/RT/Metacritic ratings
WATCHMODE_API_KEY=   # availability + real deep links per region
ANTHROPIC_API_KEY=   # AI intent routing + ranking (heuristic fallback if absent)
```

## Build / run / test

```bash
cd /home/user/workspace/streamhub
npx tsc --noEmit | grep -v "npm notice"      # typecheck (expect exit 0)
npm run build                                 # -> dist/index.cjs (server), dist/public/ (client)
```
Run server for testing (do NOT use `(cmd &)` — process dies between bash calls; use start_server tool):
```
pplx-tool start_server  (api_credentials=["pplx-tool:start_server"])
{"command":"NODE_ENV=production PORT=5077 node dist/index.cjs","project_path":".../streamhub","port":5077,"log_file":"/tmp/sh_server.log"}
```
Endpoints: `GET /api/search?q=...`, `GET/PUT /api/settings`, `GET /api/status`, `POST /api/seen`, `DELETE /api/seen/:id`.
UI QA: Playwright via `js_repl` (reset=true), or a throwaway `.mjs` script against `localhost:5077`.

## GitHub push pattern

Use `bash` with `api_credentials=["github"]`. Never print/inspect credentials.
```bash
gh repo clone genewilliams26/stream-hub /tmp/<dir> -- --depth 1
# rsync workspace -> clone, excluding: .git node_modules dist data.db* __pycache__ *.zip .env *.mjs *.py qa_*
git config user.email "gene.williams26@users.noreply.github.com"
git config user.name  "Gene Williams"
git add -A && git commit -m "..." && git push origin main
gh run watch <id> --repo genewilliams26/stream-hub --exit-status
```
CI (`.github/workflows/build.yml`): Node 18.x & 20.x matrix (npm ci, tsc --noEmit, build, verify dist)
+ a `Compile setup.py` job. **Last push `7a8cbdb` — CI green on all jobs.**

## Scheduled task (leave running)

Cron `68881be1`: weekday 4:20 AM CDT repo-health brief for the repo. Emails ONLY if there are new
issues / failed CI on main / new dependency alerts; otherwise silent. Dependabot API currently returns
403 (disabled in repo settings). State file: `/home/user/workspace/cron_tracking/68881be1/last_scan.json`.
Do NOT recreate it.

## Status & next ideas

**Done:** live TMDB/OMDb/Watchmode search + AI intent routing, cast/setting enrichment, hardened offline
scorer, split-view trailer player, region config. Pushed, CI green.

**Open / possible next steps:**
- Live path has only been tested offline + with the real YouTube trailer; end-to-end live search needs
  real API keys to fully validate (user said "I'll add keys").
- Delete dead `client/src/components/TrailerDialog.tsx` if desired.
- Regenerate the downloadable project zip and the Raspberry Pi setup guide with these updates
  (shared assets: `streamhub_full_project`/`stream_hub_full_project` zips, `raspberry_pi_setup_guide` md).
- Consider a "now playing" mini-state so the docked player survives route changes to /settings.
```
