#!/usr/bin/env python3
"""
stream-hub — fresh Raspberry Pi 3 setup script.

Provisions a brand-new Raspberry Pi OS (or any Debian-based Linux) install to run
stream-hub as a full-screen, auto-starting Chromium kiosk.

What it does (idempotent — safe to re-run):
  1. Installs Node.js 20 (via NodeSource) and git + chromium + unclutter.
  2. Runs `npm install` and `npm run build` in this project directory.
  3. Optionally writes a .env file for API keys (interactive, skippable).
  4. Creates and enables a systemd service so the server starts on boot.
  5. Creates a Chromium kiosk autostart entry + launch script.

Run it from the project root:

    python3 setup.py                 # full auto setup
    python3 setup.py --no-kiosk      # skip the Chromium kiosk (server only)
    python3 setup.py --no-system     # build only, no apt/systemd/kiosk changes
    python3 setup.py --port 8080     # serve on a custom port (default 5000)
    python3 setup.py --yes           # don't prompt (accept defaults, skip .env)

Most steps need sudo. Run as your normal user (e.g. `pi`); the script calls
sudo where required. Do NOT run the whole thing with `sudo python3 setup.py`,
or npm will install as root and the kiosk will be configured for the wrong user.
"""

import argparse
import getpass
import os
import shutil
import subprocess
import sys
from pathlib import Path

APP_NAME = "stream-hub"
DEFAULT_PORT = 5000
NODE_MAJOR = 20

PROJECT_DIR = Path(__file__).resolve().parent


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    END = "\033[0m"


def step(msg: str) -> None:
    print(f"\n{Colors.BOLD}{Colors.BLUE}==> {msg}{Colors.END}")


def info(msg: str) -> None:
    print(f"    {msg}")


def ok(msg: str) -> None:
    print(f"    {Colors.GREEN}\u2713 {msg}{Colors.END}")


def warn(msg: str) -> None:
    print(f"    {Colors.YELLOW}! {msg}{Colors.END}")


def fail(msg: str) -> None:
    print(f"\n{Colors.RED}{Colors.BOLD}\u2717 {msg}{Colors.END}")
    sys.exit(1)


def run(cmd, check=True, shell=False, **kwargs):
    """Run a command, streaming output. cmd is a list (or string if shell=True)."""
    printable = cmd if isinstance(cmd, str) else " ".join(cmd)
    info(f"$ {printable}")
    result = subprocess.run(cmd, shell=shell, **kwargs)
    if check and result.returncode != 0:
        fail(f"Command failed (exit {result.returncode}): {printable}")
    return result


def have(binary: str) -> bool:
    return shutil.which(binary) is not None


def confirm(prompt: str, assume_yes: bool, default: bool = True) -> bool:
    if assume_yes:
        return default
    suffix = " [Y/n] " if default else " [y/N] "
    try:
        ans = input(prompt + suffix).strip().lower()
    except EOFError:
        return default
    if not ans:
        return default
    return ans in ("y", "yes")


# --------------------------------------------------------------------------- #
# Setup steps
# --------------------------------------------------------------------------- #

def check_not_root() -> None:
    if os.geteuid() == 0:
        fail(
            "Don't run this whole script as root/sudo.\n"
            "    Run it as your normal user (e.g. `pi`); it will call sudo itself "
            "where needed.\n    Example:  python3 setup.py"
        )


def detect_chromium() -> str | None:
    for binary in ("chromium-browser", "chromium"):
        if have(binary):
            return binary
    return None


def install_node(assume_yes: bool) -> None:
    step("Node.js")
    if have("node"):
        try:
            ver = subprocess.run(
                ["node", "-v"], capture_output=True, text=True
            ).stdout.strip()
            major = int(ver.lstrip("v").split(".")[0])
            if major >= 18:
                ok(f"Node {ver} already installed (>=18).")
                return
            warn(f"Node {ver} is too old (need >=18). Installing Node {NODE_MAJOR}.")
        except Exception:
            warn("Could not parse Node version; reinstalling.")
    else:
        info(f"Node not found. Installing Node {NODE_MAJOR} via NodeSource.")

    run(
        f"curl -fsSL https://deb.nodesource.com/setup_{NODE_MAJOR}.x | sudo -E bash -",
        shell=True,
    )
    run(["sudo", "apt-get", "install", "-y", "nodejs"])
    ver = subprocess.run(["node", "-v"], capture_output=True, text=True).stdout.strip()
    ok(f"Node {ver} installed.")


def install_system_packages() -> None:
    step("System packages (git, chromium, unclutter)")
    pkgs = ["git", "unclutter"]
    # Pick whichever chromium package name exists on this OS.
    chromium_pkg = "chromium-browser"
    # On newer Debian/RPi OS the package is just "chromium".
    probe = subprocess.run(
        ["apt-cache", "show", "chromium-browser"],
        capture_output=True, text=True,
    )
    if probe.returncode != 0 or not probe.stdout.strip():
        chromium_pkg = "chromium"
    pkgs.append(chromium_pkg)
    run(["sudo", "apt-get", "install", "-y", *pkgs])
    ok(f"Installed: {', '.join(pkgs)}")


def build_app() -> None:
    step("Build stream-hub")
    if not (PROJECT_DIR / "package.json").exists():
        fail(f"No package.json in {PROJECT_DIR}. Run this script from the project root.")
    run(["npm", "install"], cwd=PROJECT_DIR)
    run(["npm", "run", "build"], cwd=PROJECT_DIR)
    if not (PROJECT_DIR / "dist" / "index.cjs").exists():
        fail("Build did not produce dist/index.cjs. Check the npm output above.")
    ok("Frontend + server built (dist/index.cjs, dist/public/).")


def maybe_write_env(assume_yes: bool) -> None:
    step("API keys (.env)")
    env_path = PROJECT_DIR / ".env"
    if env_path.exists():
        ok(f".env already exists at {env_path} — leaving it untouched.")
        return
    if assume_yes or not confirm(
        "Set up live API keys now? (catalog, ratings, AI search — all optional)",
        assume_yes, default=False,
    ):
        info("Skipping .env. The app runs offline on its bundled catalog.")
        info("You can add keys later — see RASPBERRY_PI_SETUP.md section 7.")
        return

    keys = {
        "TMDB_API_KEY": "TMDB (catalog/posters/trailers) — https://www.themoviedb.org/settings/api",
        "OMDB_API_KEY": "OMDb (IMDb/RT/Metacritic ratings) — https://www.omdbapi.com/apikey.aspx",
        "WATCHMODE_API_KEY": "Watchmode (streaming availability) — https://api.watchmode.com/",
        "ANTHROPIC_API_KEY": "Anthropic (AI natural-language search) — https://console.anthropic.com/",
    }
    lines = []
    for var, desc in keys.items():
        info(desc)
        try:
            val = input(f"  {var} (leave blank to skip): ").strip()
        except EOFError:
            val = ""
        if val:
            lines.append(f"{var}={val}")
    if lines:
        env_path.write_text("\n".join(lines) + "\n")
        os.chmod(env_path, 0o600)
        ok(f"Wrote {len(lines)} key(s) to {env_path} (chmod 600).")
    else:
        info("No keys entered; skipping .env.")


def create_systemd_service(user: str, port: int) -> None:
    step("systemd service (auto-start on boot)")
    node_path = shutil.which("node") or "/usr/bin/node"
    service = f"""[Unit]
Description={APP_NAME} streaming aggregator
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={user}
WorkingDirectory={PROJECT_DIR}
EnvironmentFile=-{PROJECT_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT={port}
ExecStart={node_path} {PROJECT_DIR}/dist/index.cjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    service_path = f"/etc/systemd/system/{APP_NAME}.service"
    info(f"Writing {service_path}")
    # Write via sudo tee so we don't need to be root ourselves.
    subprocess.run(
        ["sudo", "tee", service_path],
        input=service, text=True, stdout=subprocess.DEVNULL, check=True,
    )
    run(["sudo", "systemctl", "daemon-reload"])
    run(["sudo", "systemctl", "enable", APP_NAME])
    run(["sudo", "systemctl", "restart", APP_NAME])
    ok(f"Service '{APP_NAME}' enabled and started on port {port}.")
    info(f"Check status:  sudo systemctl status {APP_NAME}")


def create_kiosk(user: str, port: int) -> None:
    step("Chromium kiosk autostart")
    chromium = detect_chromium()
    if not chromium:
        warn("Chromium not found; skipping kiosk. Install it and re-run, or "
             "open http://localhost:%d manually." % port)
        return

    home = Path(os.path.expanduser(f"~{user}"))

    # 1) Kiosk launch script in the project dir.
    kiosk_sh = PROJECT_DIR / "kiosk.sh"
    kiosk_sh.write_text(f"""#!/bin/bash
# Auto-generated by setup.py — launches stream-hub full-screen in Chromium.

# Wait for the stream-hub server to be ready.
until curl -s http://localhost:{port}/api/status >/dev/null; do
  sleep 1
done

# Disable screen blanking / power management.
xset s off
xset -dpms
xset s noblank

# Hide the mouse cursor when idle.
unclutter -idle 0.5 -root &

# Launch Chromium full-screen, pointed at stream-hub.
{chromium} \\
  --kiosk \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --check-for-update-interval=31536000 \\
  --app=http://localhost:{port}
""")
    os.chmod(kiosk_sh, 0o755)
    ok(f"Wrote kiosk launcher: {kiosk_sh}")

    # 2) Autostart .desktop entry.
    autostart_dir = home / ".config" / "autostart"
    autostart_dir.mkdir(parents=True, exist_ok=True)
    desktop = autostart_dir / f"{APP_NAME}-kiosk.desktop"
    desktop.write_text(f"""[Desktop Entry]
Type=Application
Name={APP_NAME} Kiosk
Exec={kiosk_sh}
X-GNOME-Autostart-enabled=true
""")
    ok(f"Wrote autostart entry: {desktop}")
    info("On next reboot, the Pi will boot to the desktop and open stream-hub full-screen.")
    info("Exit kiosk mode any time with Ctrl+W / Alt+F4, or `pkill chromium`.")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fresh Raspberry Pi 3 setup for stream-hub.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"Port to serve on (default {DEFAULT_PORT}).")
    parser.add_argument("--no-kiosk", action="store_true",
                        help="Skip Chromium kiosk setup (server only).")
    parser.add_argument("--no-system", action="store_true",
                        help="Build only: skip apt installs, systemd, and kiosk.")
    parser.add_argument("--user", default=getpass.getuser(),
                        help="User to run the service/kiosk as (default: current user).")
    parser.add_argument("--yes", action="store_true",
                        help="Non-interactive: accept defaults, skip .env prompts.")
    args = parser.parse_args()

    print(f"{Colors.BOLD}stream-hub — Raspberry Pi setup{Colors.END}")
    print(f"Project dir : {PROJECT_DIR}")
    print(f"Run user    : {args.user}")
    print(f"Port        : {args.port}")
    print(f"Mode        : {'build-only' if args.no_system else 'full setup'}"
          f"{' (no kiosk)' if args.no_kiosk and not args.no_system else ''}")

    check_not_root()

    if args.no_system:
        build_app()
        ok("Build complete. Start it with:")
        info(f"NODE_ENV=production PORT={args.port} node dist/index.cjs")
        info(f"Then open http://localhost:{args.port}")
        print(f"\n{Colors.GREEN}{Colors.BOLD}Done.{Colors.END}")
        return

    # Full setup path.
    if not have("apt-get"):
        fail("apt-get not found. This script targets Debian-based systems "
             "(Raspberry Pi OS, Ubuntu, etc.). Use --no-system on other distros.")

    run(["sudo", "apt-get", "update"])
    install_node(args.yes)
    install_system_packages()
    build_app()
    maybe_write_env(args.yes)
    create_systemd_service(args.user, args.port)
    if not args.no_kiosk:
        create_kiosk(args.user, args.port)

    print(f"\n{Colors.GREEN}{Colors.BOLD}\u2713 Setup complete!{Colors.END}")
    print(f"  • Server running on http://localhost:{args.port} (auto-starts on boot)")
    if not args.no_kiosk:
        print("  • Reboot to launch the full-screen kiosk:  sudo reboot")
    print(f"  • Logs:   sudo journalctl -u {APP_NAME} -f")
    print(f"  • Status: sudo systemctl status {APP_NAME}")


if __name__ == "__main__":
    main()
