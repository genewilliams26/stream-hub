import { useEffect, useRef } from "react";
import { usePlayer } from "./PlayerContext";
import { Maximize2, Minimize2, X, ExternalLink, Play } from "lucide-react";

/**
 * The split-view player surface.
 *
 * Keyboard:
 *   - ESC while FULLSCREEN  -> collapse to the docked half-panel (does NOT close).
 *   - ESC while DOCKED      -> close the player.
 *
 * Layout:
 *   - Fullscreen: fixed overlay covering the viewport.
 *   - Docked:     fixed to the right half of the viewport; a fullscreen button
 *                 sits at the panel's top-right. The app content (left) is given
 *                 right padding by <PlayerLayout> so search/results move left.
 */
export function PlayerPanel() {
  const { playing, mode, close, toggleMode, setMode } = usePlayer();
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC handling: fullscreen -> docked, docked -> close.
  useEffect(() => {
    if (!playing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (mode === "fullscreen") setMode("docked");
        else close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, mode, setMode, close]);

  if (!playing) return null;

  const fullscreen = mode === "fullscreen";

  return (
    <div
      ref={panelRef}
      data-testid="player-panel"
      data-mode={mode}
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-black"
          : "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-black shadow-2xl md:w-1/2"
      }
    >
      {/* Top control bar */}
      <div className="flex items-center justify-between gap-2 bg-black px-3 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <Play className="h-3.5 w-3.5 shrink-0 fill-current text-primary" />
          <span className="truncate text-sm font-medium" data-testid="player-title">
            {playing.title}
          </span>
          <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide">
            Trailer
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {playing.serviceDeepLink && (
            <a
              href={playing.serviceDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              title={`Open on ${playing.serviceName ?? "service"}`}
              data-testid="player-open-service"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Watch on {playing.serviceName ?? "service"}
              </span>
            </a>
          )}
          {/* Fullscreen / restore toggle — sits at the panel's top-right. */}
          <button
            onClick={toggleMode}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={fullscreen ? "Collapse to side panel" : "Expand to fullscreen"}
            title={fullscreen ? "Collapse (Esc)" : "Fullscreen"}
            data-testid="player-toggle-fullscreen"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close player"
            title="Close"
            data-testid="player-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video */}
      <div className="relative flex-1 bg-black">
        <iframe
          key={playing.id + mode /* remount on mode change keeps aspect correct */}
          src={playing.embedUrl}
          title={`${playing.title} trailer`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          data-testid="player-iframe"
        />
      </div>

      {/* Hint bar */}
      <div className="bg-black px-3 py-1.5 text-center text-[0.65rem] text-white/50">
        {fullscreen ? "Press Esc to shrink to a side panel" : "Press Esc to close · use the expand button for fullscreen"}
      </div>
    </div>
  );
}
