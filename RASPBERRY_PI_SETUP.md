# StreamHub — Raspberry Pi 3 Kiosk Setup Guide

This guide gets StreamHub running as a full-screen, auto-starting kiosk on a Raspberry Pi 3 (any Linux OS — Raspberry Pi OS / Raspbian recommended). It also covers wiring in your own live API keys so search pulls real catalog and ratings data instead of the bundled mock dataset.

StreamHub is a lightweight Express + React app. The Pi runs the app locally and Chromium displays it in kiosk mode.

---

## 1. Prerequisites

- Raspberry Pi 3 (1 GB RAM is enough — the server uses ~80 MB)
- Raspberry Pi OS (32-bit or 64-bit) with desktop, or any Linux distro with a desktop environment
- Internet connection (Wi-Fi or Ethernet)
- A display connected via HDMI

---

## 2. Install Node.js

StreamHub needs Node.js 18 or newer. The version in the default apt repos is usually too old, so use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # should print v20.x or newer
```

> On a Pi 3, `npm install` for the first time can take 5–10 minutes. Be patient.

---

## 3. Get StreamHub onto the Pi

Copy the project folder to the Pi (USB drive, `scp`, or `git clone git@github.com:genewilliams26/stream-hub.git` if you've pushed it to a repo). Assuming it lands in `~/stream-hub`:

```bash
cd ~/stream-hub
npm install
npm run build
```

This produces:
- `dist/index.cjs` — the production server
- `dist/public/` — the built frontend

---

## 4. Run the app

```bash
cd ~/stream-hub
NODE_ENV=production node dist/index.cjs
```

You should see:

```
[express] serving on port 5000
```

Open a browser on the Pi and visit **http://localhost:5000** to confirm it loads. The SQLite database (`data.db`) is created automatically next to the app and remembers your "seen" titles and settings across restarts.

To run it on a different port:

```bash
PORT=8080 NODE_ENV=production node dist/index.cjs
```

---

## 5. Auto-start the server on boot (systemd)

Create a service so StreamHub starts automatically whenever the Pi powers on:

```bash
sudo nano /etc/systemd/system/stream-hub.service
```

Paste (adjust `User` and paths if your username isn't `pi`):

```ini
[Unit]
Description=stream-hub streaming aggregator
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/stream-hub
# Load API keys / service secrets from a file (see section 7)
EnvironmentFile=-/home/pi/stream-hub/.env
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=/usr/bin/node /home/pi/stream-hub/dist/index.cjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stream-hub
sudo systemctl start stream-hub
sudo systemctl status stream-hub   # confirm it's "active (running)"
```

---

## 6. Chromium kiosk mode (full-screen auto-launch)

Install Chromium and the screensaver-disabling tool:

```bash
sudo apt-get install -y chromium-browser unclutter
```

> On 64-bit Raspberry Pi OS / newer Debian the package may be named `chromium` instead of `chromium-browser`. Adjust the command below to match.

### Create the autostart entry

For the LXDE desktop (default on Raspberry Pi OS):

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/stream-hub-kiosk.desktop
```

Paste:

```ini
[Desktop Entry]
Type=Application
Name=stream-hub Kiosk
Exec=/home/pi/stream-hub/kiosk.sh
X-GNOME-Autostart-enabled=true
```

### Create the kiosk launch script

```bash
nano ~/stream-hub/kiosk.sh
```

Paste:

```bash
#!/bin/bash
# Wait for the StreamHub server to be ready
until curl -s http://localhost:5000/api/status >/dev/null; do
  sleep 1
done

# Disable screen blanking / power management
xset s off
xset -dpms
xset s noblank

# Hide the mouse cursor when idle
unclutter -idle 0.5 -root &

# Launch Chromium full-screen, pointed at StreamHub
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --app=http://localhost:5000
```

Make it executable:

```bash
chmod +x ~/stream-hub/kiosk.sh
```

Reboot:

```bash
sudo reboot
```

The Pi will boot to the desktop, the StreamHub server will start via systemd, and Chromium will open full-screen on the StreamHub home screen.

> **Exit kiosk mode:** press `Ctrl+W` or `Alt+F4`, or SSH in and run `pkill chromium`.

### Touchscreen note

StreamHub is touch-friendly and the layout adapts down to small displays (tested at 800×480). On narrow screens the poster art is hidden to keep the result bars tidy — this is by design.

---

## 7. Adding your live API keys (optional but recommended)

Out of the box, StreamHub ships with a bundled mock catalog (22 popular titles with real ratings and trailers) so it works offline with zero configuration. To pull **live** catalog, availability, and ratings data, add your own API keys.

Create an environment file the systemd service reads:

```bash
nano ~/stream-hub/.env
```

Add the keys you have (all optional — add only the ones you want):

```bash
# --- Catalog / metadata / trailers ---
TMDB_API_KEY=your_tmdb_key_here

# --- Ratings (IMDb / Rotten Tomatoes / Metacritic via OMDb) ---
OMDB_API_KEY=your_omdb_key_here

# --- Streaming availability (which service has each title) ---
WATCHMODE_API_KEY=your_watchmode_key_here

# --- AI natural-language search (optional) ---
# Lets the app interpret queries like "that movie with the spinning top".
# Without it, StreamHub falls back to a built-in keyword/genre matcher.
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Where to get free keys:
- **TMDB** (catalog, posters, trailers): https://www.themoviedb.org/settings/api
- **OMDb** (IMDb / RT / Metacritic ratings): https://www.omdbapi.com/apikey.aspx
- **Watchmode** (streaming availability): https://api.watchmode.com/
- **Anthropic** (AI search): https://console.anthropic.com/

After editing `.env`, restart the service:

```bash
sudo systemctl restart stream-hub
```

Visit **http://localhost:5000/api/status** — when live providers are configured it reports `"liveProviders": true`, and `"aiAvailable": true` when an AI key is present.

> **Where the integration lives:** the data layer is isolated in `server/providers.ts`. The `getCandidates()` function is the single seam where mock data is swapped for live API calls — it already contains commented stubs for TMDB / Watchmode wiring. The free/pay filtering, ratings, and "seen" logic all work identically whether the data is mock or live.

### Streaming-service account secrets

The list of services you subscribe to is fully configurable in the in-app **Settings** screen (gear icon, top-right) — toggle each service on/off and edit its deep-link URL template. The default list is Netflix, Apple TV+, Prime Video, Disney+, Hulu, Discovery+, Pluto TV, and Tubi.

If you later integrate a provider that needs per-service credentials (e.g. an availability API tied to your accounts), add them to the same `.env` file as additional environment variables and reference them from `server/providers.ts`.

---

## 8. Updating StreamHub

```bash
cd ~/stream-hub
git pull            # or copy the new files over
npm install         # only if dependencies changed
npm run build
sudo systemctl restart stream-hub
```

Chromium will reflect the new build on its next refresh (or reboot the Pi).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Chromium shows "can't connect" on boot | The server wasn't ready yet. The `kiosk.sh` script waits for `/api/status` — confirm the systemd service is running: `sudo systemctl status stream-hub`. |
| `node: command not found` in systemd | Use the full path in `ExecStart` (`which node` to find it, often `/usr/bin/node`). |
| Screen goes blank after a few minutes | Ensure `xset s off`, `xset -dpms`, `xset s noblank` ran (they're in `kiosk.sh`). |
| Search returns only mock titles | No live API keys set, or the service wasn't restarted after editing `.env`. Check `/api/status`. |
| `npm install` fails with memory errors | Add swap: `sudo dphys-swapfile swapoff && sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile && sudo dphys-swapfile setup && sudo dphys-swapfile swapon`. |
| Wrong Chromium package name | On newer OS, use `chromium` instead of `chromium-browser` in both the apt install and `kiosk.sh`. |

---

Enjoy your single-screen, AI-powered streaming hub.
