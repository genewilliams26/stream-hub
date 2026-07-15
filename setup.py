#!/usr/bin/env python3
"""
stream-hub — fresh Raspberry Pi 3 setup script.

Provisions a brand-new Raspberry Pi OS (or any Debian-based Linux) install to run
stream-hub as a full-screen, auto-starting Chromium kiosk.

Supported systems:
  • Full auto-setup (Node + systemd service + Chromium kiosk): Debian-based only
    (Raspberry Pi OS, Debian, Ubuntu, Mint). Requires apt-get + systemd + an X11 desktop.
  • Any other Linux (Fedora/RHEL, Arch, Alpine, etc.) or macOS: the script auto-
    falls back to build-only mode. Install Node 18+ yourself first, then run with
    --no-system. The app itself runs anywhere Node.js does.

What it does (idempotent — safe to re-run):
  1. Installs Node.js 20 (via NodeSource) and git + chromium + unclutter.
     On Raspberry Pi OS it installs the OFFICIAL Foundation Chromium build
     (chromium-browser + rpi-chromium-mods) for hardware-accelerated video.
  2. Runs `npm install` and `npm run build` in this project directory. On
     low-RAM boards (e.g. the 1 GB Pi 3) it temporarily adds a swapfile for
     the build so it doesn't run out of memory, then removes it afterward.
  3. Optionally writes a .env file for API keys (interactive, skippable).
  4. Creates and enables a systemd service so the server starts on boot.
  5. Creates a Chromium kiosk autostart entry + launch script.
  6. Installs a nightly kiosk auto-restart timer (reclaims Chromium memory
     on long-running kiosks — important on the 1 GB Pi 3).

Run it from the project root:

    python3 setup.py                      # full auto setup
    python3 setup.py --no-kiosk           # skip the Chromium kiosk (server only)
    python3 setup.py --no-nightly-restart # skip the nightly kiosk restart timer
    python3 setup.py --restart-time 03:30 # nightly restart at a custom time
    python3 setup.py --no-swap-boost      # don't add temporary build swap
    python3 setup.py --swap-size-mb 1024  # size of the temporary build swap
    python3 setup.py --no-system          # build only, no apt/systemd/kiosk changes
    python3 setup.py --port 8080          # serve on a custom port (default 5000)
    python3 setup.py --yes                # don't prompt (accept defaults, skip .env)

Most steps need sudo. Run as your normal user (e.g. `pi`); the script calls
sudo where required. Do NOT run the whole thing with `sudo python3 setup.py`,
or npm will install as root and the kiosk will be configured for the wrong user.
"""

import argparse
import contextlib
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


def _is_raspberry_pi_os() -> bool:
    """True only on genuine Raspberry Pi OS (Raspbian), where the Foundation's
    GPU-accelerated Chromium build (chromium-browser + rpi-chromium-mods) lives."""
    try:
        osr = Path("/etc/os-release").read_text().lower()
    except OSError:
        return False
    return "raspbian" in osr or "raspberry pi os" in osr


def install_system_packages() -> None:
    step("System packages (git, chromium, unclutter)")
    pkgs = ["git", "unclutter"]

    # --- Chromium: prefer the OFFICIAL Raspberry Pi OS build ---------------- #
    # On Raspberry Pi OS the Foundation ships `chromium-browser` together with
    # `rpi-chromium-mods`, which wires in V4L2 hardware H.264 video decode and
    # the right GPU flags. That is the build we want for a smooth kiosk — NOT
    # the generic upstream `chromium` package, and never a snap/flatpak build
    # (those ship software-only rendering and stutter badly on a Pi).
    chromium_pkgs = []
    if _is_raspberry_pi_os():
        info("Raspberry Pi OS detected — using the official Foundation Chromium build.")
        probe = subprocess.run(
            ["apt-cache", "show", "chromium-browser"],
            capture_output=True, text=True,
        )
        if probe.returncode == 0 and probe.stdout.strip():
            chromium_pkgs = ["chromium-browser", "rpi-chromium-mods"]
        else:
            warn("chromium-browser not in apt sources; falling back to 'chromium'.")
            chromium_pkgs = ["chromium"]
    else:
        # Non-RPi Debian/Ubuntu: pick whichever chromium .deb is available.
        # (We deliberately avoid snap chromium, which has no HW video decode.)
        warn("Not Raspberry Pi OS — installing the distro's chromium .deb.")
        warn("For best video performance, run stream-hub on Raspberry Pi OS so the")
        warn("GPU-accelerated chromium-browser + rpi-chromium-mods build is used.")
        probe = subprocess.run(
            ["apt-cache", "show", "chromium-browser"],
            capture_output=True, text=True,
        )
        if probe.returncode == 0 and probe.stdout.strip():
            chromium_pkgs = ["chromium-browser"]
        else:
            chromium_pkgs = ["chromium"]

    pkgs.extend(chromium_pkgs)
    run(["sudo", "apt-get", "install", "-y", *pkgs])
    ok(f"Installed: {', '.join(pkgs)}")


# Temporary swapfile used only during the build on low-RAM boards.
SWAP_BOOST_PATH = "/var/swap.stream-hub-build"


def _total_ram_mb() -> int | None:
    """Total physical RAM in MB, or None if it can't be determined."""
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal:"):
                return int(line.split()[1]) // 1024  # kB -> MB
    except (OSError, ValueError, IndexError):
        return None
    return None


def _swap_total_mb() -> int:
    """Current active swap in MB (0 if none / unknown)."""
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("SwapTotal:"):
                return int(line.split()[1]) // 1024
    except (OSError, ValueError, IndexError):
        return 0
    return 0


@contextlib.contextmanager
def swap_boost(enabled: bool, size_mb: int):
    """Temporarily add a swapfile so the build doesn't OOM on a 1 GB board.

    Only activates on Linux when: enabled, physical RAM looks tight
    (< 1536 MB), and current swap is smaller than the requested size. The
    swapfile is ALWAYS removed on exit — even if the build raises — so we don't
    leave state behind or wear the SD card.
    """
    activated = False
    if not enabled:
        yield
        return
    if sys.platform != "linux" or not have("mkswap") or not have("swapon"):
        yield
        return

    ram = _total_ram_mb()
    have_swap = _swap_total_mb()
    if ram is not None and ram >= 1536:
        info(f"RAM looks sufficient ({ram} MB) — skipping temporary build swap.")
        yield
        return
    if have_swap >= size_mb:
        info(f"Existing swap ({have_swap} MB) is already ≥ {size_mb} MB — no boost needed.")
        yield
        return

    step(f"Temporary build swap (+{size_mb} MB)")
    info(f"Low RAM detected ({ram} MB); adding a temporary {size_mb} MB swapfile")
    info("so `npm run build` doesn't run out of memory. It's removed afterward.")
    try:
        if os.path.exists(SWAP_BOOST_PATH):
            run(["sudo", "swapoff", SWAP_BOOST_PATH], check=False)
            run(["sudo", "rm", "-f", SWAP_BOOST_PATH], check=False)
        # Allocate (fallocate is fast; dd is the portable fallback).
        alloc = run(["sudo", "fallocate", "-l", f"{size_mb}M", SWAP_BOOST_PATH], check=False)
        if alloc.returncode != 0:
            run(["sudo", "dd", "if=/dev/zero", f"of={SWAP_BOOST_PATH}",
                 "bs=1M", f"count={size_mb}", "status=none"])
        run(["sudo", "chmod", "600", SWAP_BOOST_PATH])
        run(["sudo", "mkswap", SWAP_BOOST_PATH])
        run(["sudo", "swapon", SWAP_BOOST_PATH])
        activated = True
        ok(f"Temporary swap active ({size_mb} MB).")
    except SystemExit:
        # `run(check=True)` failed and called fail()->sys.exit; clean up first.
        if activated:
            run(["sudo", "swapoff", SWAP_BOOST_PATH], check=False)
        run(["sudo", "rm", "-f", SWAP_BOOST_PATH], check=False)
        raise
    except Exception:
        warn("Could not set up temporary swap; continuing without it.")
        if activated:
            run(["sudo", "swapoff", SWAP_BOOST_PATH], check=False)
        run(["sudo", "rm", "-f", SWAP_BOOST_PATH], check=False)
        activated = False

    try:
        yield
    finally:
        if activated:
            step("Removing temporary build swap")
            run(["sudo", "swapoff", SWAP_BOOST_PATH], check=False)
            run(["sudo", "rm", "-f", SWAP_BOOST_PATH], check=False)
            ok("Temporary swap removed; original swap configuration restored.")


def build_app(swap_enabled: bool = True, swap_size_mb: int = 2048) -> None:
    step("Build stream-hub")
    if not (PROJECT_DIR / "package.json").exists():
        fail(f"No package.json in {PROJECT_DIR}. Run this script from the project root.")
    run(["npm", "install"], cwd=PROJECT_DIR)
    # The Vite/esbuild build is the memory-hungry step; wrap it in the swap boost.
    with swap_boost(swap_enabled, swap_size_mb):
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


def create_nightly_restart(user: str, restart_time: str) -> None:
    """Install a systemd timer that restarts the kiosk every night.

    Chromium leaks memory over long uptimes and the Pi 3 only has 1 GB of RAM,
    so a once-a-day restart of the browser (and the app server) keeps a 24/7
    kiosk from slowly degrading or freezing. The timer runs a tiny script that
    relaunches the kiosk for the logged-in desktop user.
    """
    step("Nightly kiosk auto-restart")

    # Validate HH:MM.
    try:
        hh, mm = restart_time.split(":")
        oncal = f"*-*-* {int(hh):02d}:{int(mm):02d}:00"
    except (ValueError, AttributeError):
        warn(f"Invalid --restart-time '{restart_time}'; using 04:00.")
        oncal = "*-*-* 04:00:00"
        restart_time = "04:00"

    # 1) Restart script (project dir): bounce the server, then relaunch kiosk.
    restart_sh = PROJECT_DIR / "nightly-restart.sh"
    restart_sh.write_text(f"""#!/bin/bash
# Auto-generated by setup.py — nightly restart of the stream-hub kiosk.
# Restarts the app server, kills the old Chromium, and relaunches the kiosk
# so memory is reclaimed once a day. Runs as user '{user}'.

# Bounce the app server (clears any server-side memory creep too).
sudo systemctl restart {APP_NAME} 2>/dev/null || true

# Kill the current kiosk Chromium so it can be relaunched fresh.
pkill -u "{user}" -f chromium 2>/dev/null || true
sleep 3

# Relaunch the kiosk on the running X display for this user.
export DISPLAY="${{DISPLAY:-:0}}"
export XAUTHORITY="$(getent passwd {user} | cut -d: -f6)/.Xauthority"
nohup "{PROJECT_DIR}/kiosk.sh" >/dev/null 2>&1 &
""")
    os.chmod(restart_sh, 0o755)
    ok(f"Wrote nightly restart script: {restart_sh}")

    # 2) Allow the restart script to bounce the service without a password.
    sudoers_line = (
        f"{user} ALL=(root) NOPASSWD: /usr/bin/systemctl restart {APP_NAME}, "
        f"/bin/systemctl restart {APP_NAME}\n"
    )
    sudoers_path = f"/etc/sudoers.d/{APP_NAME}-restart"
    subprocess.run(
        ["sudo", "tee", sudoers_path],
        input=sudoers_line, text=True, stdout=subprocess.DEVNULL, check=True,
    )
    run(["sudo", "chmod", "0440", sudoers_path])

    # 3) systemd service (oneshot) that runs the script as the desktop user.
    svc = f"""[Unit]
Description=Nightly restart of the {APP_NAME} kiosk

[Service]
Type=oneshot
User={user}
ExecStart={restart_sh}
"""
    svc_path = f"/etc/systemd/system/{APP_NAME}-restart.service"
    subprocess.run(
        ["sudo", "tee", svc_path],
        input=svc, text=True, stdout=subprocess.DEVNULL, check=True,
    )

    # 4) systemd timer that fires the service every day at restart_time.
    timer = f"""[Unit]
Description=Run nightly {APP_NAME} kiosk restart

[Timer]
OnCalendar={oncal}
Persistent=true

[Install]
WantedBy=timers.target
"""
    timer_path = f"/etc/systemd/system/{APP_NAME}-restart.timer"
    subprocess.run(
        ["sudo", "tee", timer_path],
        input=timer, text=True, stdout=subprocess.DEVNULL, check=True,
    )

    run(["sudo", "systemctl", "daemon-reload"])
    run(["sudo", "systemctl", "enable", f"{APP_NAME}-restart.timer"])
    run(["sudo", "systemctl", "start", f"{APP_NAME}-restart.timer"])
    ok(f"Nightly restart scheduled daily at {restart_time}.")
    info(f"Check it:  systemctl list-timers {APP_NAME}-restart.timer")
    info(f"Run it now to test:  sudo systemctl start {APP_NAME}-restart.service")


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
    parser.add_argument("--no-nightly-restart", action="store_true",
                        help="Skip the nightly kiosk auto-restart timer.")
    parser.add_argument("--restart-time", default="04:00", metavar="HH:MM",
                        help="Local time for the nightly kiosk restart (default 04:00).")
    parser.add_argument("--no-swap-boost", action="store_true",
                        help="Don't add a temporary swapfile during the build "
                             "(the boost only triggers on low-RAM boards).")
    parser.add_argument("--swap-size-mb", type=int, default=2048, metavar="MB",
                        help="Size of the temporary build swapfile in MB (default 2048).")
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
    if not args.no_system and not args.no_kiosk and not args.no_nightly_restart:
        print(f"Nightly restart: {args.restart_time}")

    check_not_root()

    if args.no_system:
        build_app(swap_enabled=not args.no_swap_boost, swap_size_mb=args.swap_size_mb)
        ok("Build complete. Start it with:")
        info(f"NODE_ENV=production PORT={args.port} node dist/index.cjs")
        info(f"Then open http://localhost:{args.port}")
        print(f"\n{Colors.GREEN}{Colors.BOLD}Done.{Colors.END}")
        return

    # Full setup path requires a Debian-based system (apt-get).
    # On any other distro, fall back to build-only so the user is never stuck.
    if not have("apt-get"):
        warn("apt-get not found — this is not a Debian/Ubuntu/Raspberry Pi OS system.")
        warn("The full auto-setup (package install + systemd + kiosk) is Debian-only.")
        info("Falling back to build-only mode. You'll need Node 18+ installed already,")
        info("and you can set up the service/kiosk manually (see RASPBERRY_PI_SETUP.md).")
        if not have("node"):
            fail("Node.js not found. Install Node 18+ with your distro's package "
                 "manager (dnf/pacman/apk/brew), then re-run: python3 setup.py --no-system")
        build_app(swap_enabled=not args.no_swap_boost, swap_size_mb=args.swap_size_mb)
        ok("Build complete. Start it with:")
        info(f"NODE_ENV=production PORT={args.port} node dist/index.cjs")
        info(f"Then open http://localhost:{args.port}")
        print(f"\n{Colors.GREEN}{Colors.BOLD}Done.{Colors.END}")
        return

    run(["sudo", "apt-get", "update"])
    install_node(args.yes)
    install_system_packages()
    build_app(swap_enabled=not args.no_swap_boost, swap_size_mb=args.swap_size_mb)
    maybe_write_env(args.yes)

    if have("systemctl"):
        create_systemd_service(args.user, args.port)
        if not args.no_kiosk:
            create_kiosk(args.user, args.port)
            if not args.no_nightly_restart:
                create_nightly_restart(args.user, args.restart_time)
    else:
        warn("systemctl not found — skipping auto-start service and kiosk setup.")
        info("Start the app manually with:")
        info(f"NODE_ENV=production PORT={args.port} node dist/index.cjs")
        print(f"\n{Colors.GREEN}{Colors.BOLD}Build complete.{Colors.END}")
        return

    print(f"\n{Colors.GREEN}{Colors.BOLD}\u2713 Setup complete!{Colors.END}")
    print(f"  • Server running on http://localhost:{args.port} (auto-starts on boot)")
    if not args.no_kiosk:
        print("  • Reboot to launch the full-screen kiosk:  sudo reboot")
        if not args.no_nightly_restart:
            print(f"  • Kiosk auto-restarts nightly at {args.restart_time} "
                  "(reclaims Chromium memory)")
    print(f"  • Logs:   sudo journalctl -u {APP_NAME} -f")
    print(f"  • Status: sudo systemctl status {APP_NAME}")


if __name__ == "__main__":
    main()
