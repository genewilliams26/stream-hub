# stream-hub

AI-powered streaming aggregator that searches across all the streaming services
you subscribe to — from a single screen. Designed to run as a lightweight,
full-screen kiosk on a Raspberry Pi 3 (or any Linux desktop), but runs anywhere
Node.js does.

[![Build](https://github.com/genewilliams26/stream-hub/actions/workflows/build.yml/badge.svg)](https://github.com/genewilliams26/stream-hub/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/genewilliams26/stream-hub?color=orange)](https://github.com/genewilliams26/stream-hub/releases/latest)
![brand](https://img.shields.io/badge/stream--hub-streaming%20aggregator-orange)

## Features

- **One AI search across every service.** Natural-language queries like
  _"that movie with the spinning top"_ or _"feel-good sci-fi epic about space"_.
- **Tidy result bars** with poster, title, runtime, genres, overview, the
  streaming source, and three configurable ratings (IMDb, Rotten Tomatoes,
  Metacritic by default).
- **"Seen" tracking** — a rounded toggle on each result hides watched titles and
  remembers them. A global **Include seen** toggle brings them back.
- **Free vs. pay filtering** — defaults to free/prepaid titles; an **Include pay**
  toggle with a coupled **"up to $"** limit lets you include rentals/purchases up
  to a price cap.
- **Trailers** play inline by default; on low-memory kiosks you can switch to
  **redirect mode** (Settings → “Open trailers in a new page”) so the trailer
  opens on its watch page and the app frees memory while it plays.
- The **play button** deep-links to the title on its streaming service.
- **Configurable** services, ratings sources, and trailer sources (Settings screen).
- Runs **fully offline** on a bundled catalog of 22 real titles; wire in your own
  API keys for live data.

## Quick start (run locally)

> ⚠️ Do **not** open `index.html` directly — stream-hub is a fullstack app and
> needs its Node server running. See [QUICK_START.md](./QUICK_START.md).

Requires [Node.js 18+](https://nodejs.org).

```bash
npm install
npm run build
NODE_ENV=production node dist/index.cjs
```

Then open **http://localhost:5000**.

For development with auto-reload: `npm run dev` (also on port 5000).

## Raspberry Pi 3 kiosk setup

One-command provisioning for a fresh Pi (installs Node, builds the app, sets up a
systemd service + Chromium kiosk autostart):

```bash
python3 setup.py
sudo reboot
```

On Raspberry Pi OS, the script installs the **official Foundation Chromium build**
(`chromium-browser` + `rpi-chromium-mods`) for hardware-accelerated H.264 video
— not the generic or snap Chromium, which render in software and stutter. It also
installs a **nightly kiosk auto-restart** (default 04:00) that bounces Chromium
and the app once a day to reclaim memory on long-running kiosks — important on the
1 GB Pi 3.

Run `setup.py` as your normal user (e.g. `pi`), **not** with sudo — it calls sudo
itself where needed. Flags: `--no-kiosk`, `--no-nightly-restart`,
`--restart-time HH:MM` (default 04:00), `--no-system` (build only), `--port`,
`--user`, `--yes`. Full manual walkthrough in
[RASPBERRY_PI_SETUP.md](./RASPBERRY_PI_SETUP.md).

## Live API keys (optional)

Out of the box stream-hub uses a bundled mock catalog. To pull live catalog,
ratings, availability, and AI search, add keys to a `.env` file:

| Variable | Purpose | Get a key |
| --- | --- | --- |
| `TMDB_API_KEY` | Catalog, posters, trailers | https://www.themoviedb.org/settings/api |
| `OMDB_API_KEY` | IMDb / RT / Metacritic ratings | https://www.omdbapi.com/apikey.aspx |
| `WATCHMODE_API_KEY` | Streaming availability | https://api.watchmode.com/ |
| `ANTHROPIC_API_KEY` | AI natural-language search | https://console.anthropic.com/ |

The data layer is isolated in `server/providers.ts` — `getCandidates()` is the
single seam where mock data is swapped for live API calls. Filtering, ratings, and
"seen" logic work identically with mock or live data.

## Tech stack

Express + Vite + React + Tailwind CSS + shadcn/ui + Drizzle ORM (SQLite via
better-sqlite3). Frontend and backend are served together on one port.

## Project layout

```
client/    React frontend (pages, components, lib)
server/    Express API, search, catalog, providers, storage
shared/    Drizzle schema + shared types
setup.py   Raspberry Pi 3 provisioning script
```
