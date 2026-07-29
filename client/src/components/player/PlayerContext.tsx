import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/**
 * In-app player state
 * -------------------
 * Drives the split-view trailer experience:
 *   - "fullscreen": the trailer covers the whole viewport (how playback starts).
 *   - "docked":     a ~half-width panel pinned to the right; the search UI shifts
 *                   to the left so you can keep browsing while it plays.
 *   - null:         nothing playing.
 *
 * Netflix / Prime / Disney+ etc. cannot be embedded (DRM + anti-iframe headers),
 * so this panel plays the YouTube TRAILER. The Play button still deep-links out
 * to the streaming service for the actual title.
 */

export type PlayerMode = "fullscreen" | "docked";

export interface NowPlaying {
  id: string;
  title: string;
  embedUrl: string; // YouTube embed URL
  watchUrl?: string; // full watch page (for "open on YouTube")
  serviceName?: string;
  serviceDeepLink?: string; // where the real title lives
}

interface PlayerState {
  playing: NowPlaying | null;
  mode: PlayerMode;
  play: (item: NowPlaying) => void;
  close: () => void;
  setMode: (m: PlayerMode) => void;
  toggleMode: () => void;
}

const Ctx = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<NowPlaying | null>(null);
  const [mode, setMode] = useState<PlayerMode>("fullscreen");

  const play = useCallback((item: NowPlaying) => {
    setPlaying(item);
    setMode("fullscreen"); // always start fullscreen
  }, []);

  const close = useCallback(() => setPlaying(null), []);

  const toggleMode = useCallback(
    () => setMode((m) => (m === "fullscreen" ? "docked" : "fullscreen")),
    [],
  );

  return (
    <Ctx.Provider value={{ playing, mode, play, close, setMode, toggleMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer(): PlayerState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}
