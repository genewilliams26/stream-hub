import type { SettingsData } from "@shared/schema";

/**
 * Default settings. Everything here is user-configurable in the Settings page
 * and persisted to SQLite. The deep-link templates use {q} as a placeholder
 * for the URL-encoded title. These open the *title page* on each service
 * (the closest reliably-working behavior; direct-play deep links are not
 * permitted by most services from third-party apps).
 */
export const DEFAULT_SETTINGS: SettingsData = {
  includeSeen: false,
  includePay: false,
  payLimit: 0,
  aiSearch: true,
  services: [
    {
      id: "netflix",
      name: "Netflix",
      enabled: true,
      searchUrlTemplate: "https://www.netflix.com/search?q={q}",
      color: "#E50914",
    },
    {
      id: "appletv",
      name: "Apple TV+",
      enabled: true,
      searchUrlTemplate: "https://tv.apple.com/search?term={q}",
      color: "#3B82F6",
    },
    {
      id: "prime",
      name: "Prime Video",
      enabled: true,
      searchUrlTemplate: "https://www.amazon.com/s?k={q}&i=instant-video",
      color: "#00A8E1",
    },
    {
      id: "disney",
      name: "Disney+",
      enabled: true,
      searchUrlTemplate: "https://www.disneyplus.com/search?q={q}",
      color: "#113CCF",
    },
    {
      id: "hulu",
      name: "Hulu",
      enabled: true,
      searchUrlTemplate: "https://www.hulu.com/search?q={q}",
      color: "#1CE783",
    },
    {
      id: "discovery",
      name: "Discovery+",
      enabled: true,
      searchUrlTemplate: "https://www.discoveryplus.com/search?q={q}",
      color: "#2175D9",
    },
    {
      id: "pluto",
      name: "Pluto TV",
      enabled: true,
      searchUrlTemplate: "https://pluto.tv/en/search/details?query={q}",
      color: "#FFE000",
    },
    {
      id: "tubi",
      name: "Tubi",
      enabled: true,
      searchUrlTemplate: "https://tubitv.com/search/{q}",
      color: "#FA382B",
    },
  ],
  // Exactly the 3 the user requested by default — all configurable.
  ratingSources: [
    { id: "imdb", name: "IMDb", enabled: true },
    { id: "rt", name: "Rotten Tomatoes", enabled: true },
    { id: "metacritic", name: "Metacritic", enabled: true },
    // extra options available to switch on
    { id: "tmdb", name: "TMDB", enabled: false },
    { id: "letterboxd", name: "Letterboxd", enabled: false },
  ],
  trailerSources: [
    { id: "youtube", name: "YouTube", enabled: true, priority: 0 },
    { id: "appletv", name: "Apple TV", enabled: true, priority: 1 },
    { id: "vimeo", name: "Vimeo", enabled: true, priority: 2 },
    { id: "tmdb", name: "TMDB", enabled: true, priority: 3 },
  ],
  // "embed" plays trailers in an in-app modal. Set to "redirect" on low-RAM
  // kiosks (e.g. Raspberry Pi 3) to navigate to the watch page instead.
  trailerMode: "embed",
};
