import type { Production } from "@shared/schema";

/**
 * Bundled mock catalog.
 * ---------------------
 * Used when no external API keys are configured. Each entry uses real metadata
 * (ratings, genres, trailer IDs) so the app feels real out of the box. When you
 * add provider keys (see providers.ts), live results replace this dataset.
 *
 * posterUrl is intentionally left blank — the UI renders a clean, deterministic
 * gradient poster from the title so there are no external image dependencies on
 * the Raspberry Pi. Drop in real poster URLs (e.g. TMDB image CDN) and they'll
 * be used automatically.
 *
 * trailerId is a YouTube video id; the UI builds an embeddable URL from it and
 * uses youtube thumbnail CDN for the trailer thumbnail.
 */

// An offer is one way to watch on one service.
//   type "free" = included with subscription / ad-supported (no extra cost)
//   type "rent" | "buy" = costs money; price in USD
export interface Offer {
  service: string; // service id
  type: "free" | "rent" | "buy";
  price?: number; // USD, omitted/0 for free
}

export interface CatalogEntry {
  id: string;
  title: string;
  mediaType: "movie" | "series";
  year: number;
  runtime: string;
  genres: string[];
  overview: string;
  ratings: { imdb: string; rt: string; metacritic: string; tmdb?: string; letterboxd?: string };
  offers: Offer[]; // where + how it can be watched
  trailerId?: string; // youtube id
  keywords: string[]; // helps offline natural-language matching
}

export const CATALOG: CatalogEntry[] = [
  {
    id: "imdb:tt0111161",
    title: "The Shawshank Redemption",
    mediaType: "movie",
    year: 1994,
    runtime: "2h 22m",
    genres: ["Drama"],
    overview:
      "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    ratings: { imdb: "9.3", rt: "89%", metacritic: "82", tmdb: "8.7", letterboxd: "4.6" },
    offers: [{ service: "hulu", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "PLl99DlL6b4",
    keywords: ["prison", "hope", "friendship", "redemption", "classic", "uplifting", "drama"],
  },
  {
    id: "imdb:tt0816692",
    title: "Interstellar",
    mediaType: "movie",
    year: 2014,
    runtime: "2h 49m",
    genres: ["Sci-Fi", "Adventure", "Drama"],
    overview:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    ratings: { imdb: "8.7", rt: "73%", metacritic: "74", tmdb: "8.4", letterboxd: "4.4" },
    offers: [{ service: "prime", type: "free" }, { service: "appletv", type: "buy", price: 14.99 }],
    trailerId: "zSWdZVtXT7E",
    keywords: ["space", "wormhole", "time", "science", "epic", "emotional", "nolan", "sci-fi"],
  },
  {
    id: "imdb:tt0468569",
    title: "The Dark Knight",
    mediaType: "movie",
    year: 2008,
    runtime: "2h 32m",
    genres: ["Action", "Crime", "Drama"],
    overview:
      "When the menace known as the Joker wreaks havoc on Gotham, Batman must accept one of the greatest tests.",
    ratings: { imdb: "9.0", rt: "94%", metacritic: "84", tmdb: "8.5", letterboxd: "4.5" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "EXeTwQWrcwY",
    keywords: ["batman", "joker", "superhero", "crime", "dark", "nolan", "action"],
  },
  {
    id: "imdb:tt4154796",
    title: "Avengers: Endgame",
    mediaType: "movie",
    year: 2019,
    runtime: "3h 1m",
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos' actions.",
    ratings: { imdb: "8.4", rt: "94%", metacritic: "78", tmdb: "8.2", letterboxd: "3.9" },
    offers: [{ service: "disney", type: "free" }],
    trailerId: "TcMBFSGVi1c",
    keywords: ["marvel", "superhero", "thanos", "epic", "action", "comic"],
  },
  {
    id: "imdb:tt15398776",
    title: "Oppenheimer",
    mediaType: "movie",
    year: 2023,
    runtime: "3h 0m",
    genres: ["Drama", "History", "Thriller"],
    overview:
      "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    ratings: { imdb: "8.3", rt: "93%", metacritic: "90", tmdb: "8.1", letterboxd: "4.2" },
    offers: [{ service: "prime", type: "rent", price: 5.99 }, { service: "appletv", type: "rent", price: 5.99 }],
    trailerId: "uYPbbksJxIg",
    keywords: ["nuclear", "history", "war", "biopic", "nolan", "drama", "atomic bomb"],
  },
  {
    id: "imdb:tt1375666",
    title: "Inception",
    mediaType: "movie",
    year: 2010,
    runtime: "2h 28m",
    genres: ["Action", "Sci-Fi", "Thriller"],
    overview:
      "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.",
    ratings: { imdb: "8.8", rt: "87%", metacritic: "74", tmdb: "8.4", letterboxd: "4.2" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "buy", price: 12.99 }],
    trailerId: "YoHD9XEInc0",
    keywords: ["dreams", "heist", "mind", "spinning top", "nolan", "sci-fi", "thriller", "mind-bending"],
  },
  {
    id: "imdb:tt0109830",
    title: "Forrest Gump",
    mediaType: "movie",
    year: 1994,
    runtime: "2h 22m",
    genres: ["Drama", "Romance"],
    overview:
      "The history of the United States from the 1950s to the '70s unfolds through the perspective of an Alabama man.",
    ratings: { imdb: "8.8", rt: "71%", metacritic: "82", tmdb: "8.5", letterboxd: "4.0" },
    offers: [{ service: "prime", type: "free" }, { service: "pluto", type: "free" }],
    trailerId: "bLvqoHBptjg",
    keywords: ["feel-good", "uplifting", "history", "romance", "classic", "drama", "heartwarming"],
  },
  {
    id: "imdb:tt6751668",
    title: "Parasite",
    mediaType: "movie",
    year: 2019,
    runtime: "2h 12m",
    genres: ["Drama", "Thriller", "Comedy"],
    overview:
      "Greed and class discrimination threaten the newly formed symbiotic relationship between two families.",
    ratings: { imdb: "8.5", rt: "99%", metacritic: "96", tmdb: "8.5", letterboxd: "4.5" },
    offers: [{ service: "hulu", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "5xH0HfJHsaY",
    keywords: ["korean", "class", "thriller", "dark comedy", "oscar", "foreign", "drama"],
  },
  {
    id: "imdb:tt0903747",
    title: "Breaking Bad",
    mediaType: "series",
    year: 2008,
    runtime: "5 seasons",
    genres: ["Crime", "Drama", "Thriller"],
    overview:
      "A chemistry teacher diagnosed with cancer turns to manufacturing and selling methamphetamine with a former student.",
    ratings: { imdb: "9.5", rt: "96%", metacritic: "87", tmdb: "8.9", letterboxd: "4.6" },
    offers: [{ service: "netflix", type: "free" }],
    trailerId: "HhesaQXLuRY",
    keywords: ["crime", "drugs", "antihero", "tv", "series", "drama", "binge"],
  },
  {
    id: "imdb:tt0944947",
    title: "Game of Thrones",
    mediaType: "series",
    year: 2011,
    runtime: "8 seasons",
    genres: ["Action", "Adventure", "Drama", "Fantasy"],
    overview:
      "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns.",
    ratings: { imdb: "9.2", rt: "89%", metacritic: "86", tmdb: "8.4", letterboxd: "4.0" },
    offers: [{ service: "prime", type: "free" }],
    trailerId: "KPLWWIOCOOQ",
    keywords: ["fantasy", "dragons", "medieval", "epic", "tv", "series", "war", "binge"],
  },
  {
    id: "imdb:tt4574334",
    title: "Stranger Things",
    mediaType: "series",
    year: 2016,
    runtime: "4 seasons",
    genres: ["Drama", "Fantasy", "Horror", "Sci-Fi"],
    overview:
      "When a young boy vanishes, a small town uncovers a mystery involving secret experiments and supernatural forces.",
    ratings: { imdb: "8.7", rt: "92%", metacritic: "76", tmdb: "8.6", letterboxd: "3.9" },
    offers: [{ service: "netflix", type: "free" }],
    trailerId: "b9EkMc79ZSU",
    keywords: ["80s", "sci-fi", "horror", "kids", "supernatural", "tv", "series", "nostalgic"],
  },
  {
    id: "imdb:tt2861424",
    title: "Rick and Morty",
    mediaType: "series",
    year: 2013,
    runtime: "7 seasons",
    genres: ["Animation", "Adventure", "Comedy", "Sci-Fi"],
    overview:
      "An animated series that follows the exploits of a super scientist and his not-so-bright grandson.",
    ratings: { imdb: "9.1", rt: "94%", metacritic: "85", tmdb: "8.7", letterboxd: "4.1" },
    offers: [{ service: "hulu", type: "free" }, { service: "netflix", type: "free" }],
    trailerId: "Atli0v0i3lc",
    keywords: ["animation", "comedy", "sci-fi", "adult", "tv", "series", "funny"],
  },
  {
    id: "imdb:tt5180504",
    title: "The Witcher",
    mediaType: "series",
    year: 2019,
    runtime: "3 seasons",
    genres: ["Action", "Adventure", "Fantasy"],
    overview:
      "Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world.",
    ratings: { imdb: "8.0", rt: "68%", metacritic: "56", tmdb: "8.1", letterboxd: "3.4" },
    offers: [{ service: "netflix", type: "free" }],
    trailerId: "ndl1W4ltcmg",
    keywords: ["fantasy", "monsters", "magic", "medieval", "tv", "series", "action"],
  },
  {
    id: "imdb:tt2306299",
    title: "Vikings",
    mediaType: "series",
    year: 2013,
    runtime: "6 seasons",
    genres: ["Action", "Adventure", "Drama", "History"],
    overview:
      "The adventures of Ragnar Lothbrok, the greatest hero of his age, as he raids, explores and rises to power.",
    ratings: { imdb: "8.5", rt: "93%", metacritic: "73", tmdb: "8.0", letterboxd: "3.8" },
    offers: [{ service: "prime", type: "free" }, { service: "hulu", type: "free" }],
    trailerId: "I6Mwq7c4hAk",
    keywords: ["vikings", "history", "war", "medieval", "tv", "series", "action"],
  },
  {
    id: "imdb:tt1856101",
    title: "Blade Runner 2049",
    mediaType: "movie",
    year: 2017,
    runtime: "2h 44m",
    genres: ["Sci-Fi", "Drama", "Mystery"],
    overview:
      "A young blade runner's discovery of a long-buried secret leads him to track down former blade runner Rick Deckard.",
    ratings: { imdb: "8.0", rt: "88%", metacritic: "81", tmdb: "7.6", letterboxd: "4.1" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "gCcx85zbxz4",
    keywords: ["sci-fi", "future", "dystopia", "replicant", "noir", "visual", "drama"],
  },
  {
    id: "imdb:tt0114369",
    title: "Se7en",
    mediaType: "movie",
    year: 1995,
    runtime: "2h 7m",
    genres: ["Crime", "Drama", "Mystery", "Thriller"],
    overview:
      "Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.",
    ratings: { imdb: "8.6", rt: "84%", metacritic: "65", tmdb: "8.4", letterboxd: "4.3" },
    offers: [{ service: "prime", type: "rent", price: 2.99 }, { service: "tubi", type: "free" }],
    trailerId: "znmZoVkCjpI",
    keywords: ["serial killer", "detective", "dark", "thriller", "crime", "fincher", "mystery"],
  },
  {
    id: "imdb:tt0133093",
    title: "The Matrix",
    mediaType: "movie",
    year: 1999,
    runtime: "2h 16m",
    genres: ["Action", "Sci-Fi"],
    overview:
      "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war.",
    ratings: { imdb: "8.7", rt: "83%", metacritic: "73", tmdb: "8.2", letterboxd: "4.2" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "buy", price: 9.99 }],
    trailerId: "vKQi3bBA1y8",
    keywords: ["sci-fi", "hacker", "simulation", "90s", "action", "cyberpunk", "classic"],
  },
  {
    id: "imdb:tt0245429",
    title: "Spirited Away",
    mediaType: "movie",
    year: 2001,
    runtime: "2h 5m",
    genres: ["Animation", "Adventure", "Family", "Fantasy"],
    overview:
      "A young girl wanders into a world of spirits and must find a way to free herself and her parents.",
    ratings: { imdb: "8.6", rt: "97%", metacritic: "96", tmdb: "8.5", letterboxd: "4.5" },
    offers: [{ service: "hulu", type: "free" }, { service: "tubi", type: "free" }],
    trailerId: "ByXuk9QqQkk",
    keywords: ["anime", "ghibli", "fantasy", "family", "magical", "animation", "japanese"],
  },
  {
    id: "imdb:tt0468565",
    title: "Planet Earth II",
    mediaType: "series",
    year: 2016,
    runtime: "1 season",
    genres: ["Documentary"],
    overview:
      "Wildlife documentary series exploring the unique characteristics of Earth's most iconic habitats.",
    ratings: { imdb: "9.5", rt: "97%", metacritic: "97", tmdb: "8.8", letterboxd: "4.6" },
    offers: [{ service: "discovery", type: "free" }, { service: "prime", type: "buy", price: 19.99 }],
    trailerId: "c8aFcHFu8QM",
    keywords: ["nature", "documentary", "wildlife", "earth", "attenborough", "relaxing", "educational"],
  },
  {
    id: "imdb:tt9777666",
    title: "Shogun",
    mediaType: "series",
    year: 2024,
    runtime: "1 season",
    genres: ["Drama", "History", "War"],
    overview:
      "In Japan in the year 1600, an English navigator becomes embroiled in a power struggle that will reshape the country.",
    ratings: { imdb: "8.7", rt: "99%", metacritic: "89", tmdb: "8.5", letterboxd: "4.3" },
    offers: [{ service: "hulu", type: "free" }, { service: "disney", type: "free" }],
    trailerId: "rUSdnGEqhfo",
    keywords: ["japan", "samurai", "history", "war", "prestige", "tv", "series", "drama"],
  },
  {
    id: "imdb:tt3581920",
    title: "The Last of Us",
    mediaType: "series",
    year: 2023,
    runtime: "2 seasons",
    genres: ["Action", "Adventure", "Drama", "Horror"],
    overview:
      "After a global pandemic destroys civilization, a hardened survivor takes charge of a 14-year-old girl.",
    ratings: { imdb: "8.7", rt: "96%", metacritic: "84", tmdb: "8.5", letterboxd: "4.2" },
    offers: [{ service: "prime", type: "free" }],
    trailerId: "uLtkt8BonwM",
    keywords: ["apocalypse", "zombie", "survival", "game adaptation", "tv", "series", "drama"],
  },
  {
    id: "imdb:tt1745960",
    title: "Top Gun: Maverick",
    mediaType: "movie",
    year: 2022,
    runtime: "2h 11m",
    genres: ["Action", "Drama"],
    overview:
      "After more than thirty years of service, Pete 'Maverick' Mitchell trains a detachment of graduates for a specialized mission.",
    ratings: { imdb: "8.2", rt: "96%", metacritic: "78", tmdb: "8.2", letterboxd: "3.8" },
    offers: [{ service: "prime", type: "rent", price: 3.99 }, { service: "appletv", type: "rent", price: 3.99 }],
    trailerId: "qSqVVswa420",
    keywords: ["action", "fighter jets", "navy", "feel-good", "blockbuster", "sequel"],
  },
];
