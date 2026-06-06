# StreamHub — Quick Start (Run Locally)

## ⚠️ Do NOT open index.html directly

StreamHub is a **fullstack app**, not a static web page. Double-clicking `index.html`
(opening it as a `file://...` URL) gives a **blank white screen** because:

1. The CSS/JS are referenced with absolute paths (`/assets/...`) that don't resolve under `file://`.
2. The app needs a backend server (`/api/search`, `/api/seen`, ...) that only runs via Node.

You must run the Node server and open the app at **http://localhost:5000**.

---

## Run it (3 commands)

You need [Node.js 18+](https://nodejs.org) installed (`node -v` to check).

```bash
cd stream-hub       # this folder (the one with package.json)
npm install         # first time only — downloads dependencies
npm run build       # builds the frontend + server
NODE_ENV=production node dist/index.cjs
```

When you see:

```
[express] serving on port 5000
```

…open your browser to:

```
http://localhost:5000
```

That's it. The screen will populate with the search bar and results.

---

## Even quicker (dev mode, auto-reload)

```bash
cd stream-hub
npm install
npm run dev
```

Then open **http://localhost:5000**. This mode rebuilds automatically when files change.

---

## Notes

- A `data.db` file is created automatically next to the app — it remembers your "seen"
  titles and settings between restarts.
- Out of the box it runs **fully offline** on a bundled catalog of 22 real titles.
- To add live catalog/ratings and AI search, see **RASPBERRY_PI_SETUP.md → section 7**
  (the API-key setup works the same on any computer, not just the Pi).
- To run on a different port: `PORT=8080 NODE_ENV=production node dist/index.cjs`
- For full-screen kiosk setup on a Raspberry Pi 3, see **RASPBERRY_PI_SETUP.md**.
