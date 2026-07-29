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
  cast?: string[]; // principal actors — powers actor-name search
  setting?: string[]; // where the story is set — powers location/theme search
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
    cast: ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
    setting: ["Maine", "United States", "prison"],
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
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
    setting: ["space", "outer space", "future Earth"],
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
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
    setting: ["Gotham City", "United States"],
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
    cast: ["Robert Downey Jr.", "Chris Evans", "Scarlett Johansson", "Chris Hemsworth"],
    setting: ["New York", "space", "United States"],
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
    cast: ["Cillian Murphy", "Emily Blunt", "Matt Damon", "Robert Downey Jr."],
    setting: ["Los Alamos", "New Mexico", "United States"],
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
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"],
    setting: ["Paris", "Tokyo", "dreams", "Los Angeles"],
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
    cast: ["Tom Hanks", "Robin Wright", "Gary Sinise"],
    setting: ["Alabama", "Vietnam", "United States"],
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
    cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"],
    setting: ["Seoul", "South Korea"],
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
    cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn"],
    setting: ["Albuquerque", "New Mexico", "United States"],
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
    cast: ["Emilia Clarke", "Kit Harington", "Peter Dinklage", "Lena Headey"],
    setting: ["Westeros", "fantasy world"],
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
    cast: ["Millie Bobby Brown", "Finn Wolfhard", "Winona Ryder", "David Harbour"],
    setting: ["Hawkins", "Indiana", "United States"],
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
    cast: ["Justin Roiland", "Chris Parnell", "Spencer Grammer"],
    setting: ["space", "multiverse"],
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
    cast: ["Henry Cavill", "Anya Chalotra", "Freya Allan"],
    setting: ["the Continent", "fantasy world"],
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
    cast: ["Travis Fimmel", "Katheryn Winnick", "Clive Standen"],
    setting: ["Scandinavia", "Norway", "England"],
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
    cast: ["Ryan Gosling", "Harrison Ford", "Ana de Armas"],
    setting: ["Los Angeles", "future", "dystopia"],
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
    cast: ["Brad Pitt", "Morgan Freeman", "Kevin Spacey", "Gwyneth Paltrow"],
    setting: ["unnamed city", "United States"],
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
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
    setting: ["simulation", "dystopia", "future"],
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
    cast: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki"],
    setting: ["Japan", "spirit world"],
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
    cast: ["David Attenborough"],
    setting: ["Earth", "worldwide", "nature"],
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
    cast: ["Hiroyuki Sanada", "Cosmo Jarvis", "Anna Sawai"],
    setting: ["Japan", "feudal Japan"],
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
    cast: ["Pedro Pascal", "Bella Ramsey"],
    setting: ["United States", "post-apocalyptic America"],
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
    cast: ["Tom Cruise", "Miles Teller", "Jennifer Connelly", "Val Kilmer"],
    setting: ["San Diego", "California", "United States", "Navy"],
  },

  // ---- Denzel Washington films (powers "movies with Denzel Washington") ---- //
  {
    id: "imdb:tt0181689",
    title: "Training Day",
    mediaType: "movie",
    year: 2001,
    runtime: "2h 2m",
    genres: ["Crime", "Drama", "Thriller"],
    overview:
      "A rookie cop spends his first day as a Los Angeles narcotics officer with a rogue detective who isn't what he appears.",
    ratings: { imdb: "7.7", rt: "73%", metacritic: "71", tmdb: "7.5", letterboxd: "3.8" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "S1wZg55zJv4",
    keywords: ["police", "corruption", "crime", "thriller", "gritty", "drama"],
    cast: ["Denzel Washington", "Ethan Hawke", "Eva Mendes"],
    setting: ["Los Angeles", "California", "United States"],
  },
  {
    id: "imdb:tt0455944",
    title: "The Equalizer",
    mediaType: "movie",
    year: 2014,
    runtime: "2h 12m",
    genres: ["Action", "Crime", "Thriller"],
    overview:
      "A former black-ops operative living a quiet life comes out of retirement to rescue a young girl from Russian gangsters.",
    ratings: { imdb: "7.2", rt: "61%", metacritic: "57", tmdb: "7.3", letterboxd: "3.4" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "IY2j_Ncy4-w",
    keywords: ["vigilante", "action", "revenge", "thriller", "crime"],
    cast: ["Denzel Washington", "Marton Csokas", "Chloë Grace Moretz"],
    setting: ["Boston", "Massachusetts", "United States"],
  },
  {
    id: "imdb:tt0790636",
    title: "Flight",
    mediaType: "movie",
    year: 2012,
    runtime: "2h 18m",
    genres: ["Drama", "Thriller"],
    overview:
      "An airline pilot miraculously crash-lands his plane, but an investigation soon reveals a troubling truth about him.",
    ratings: { imdb: "7.3", rt: "78%", metacritic: "76", tmdb: "7.0", letterboxd: "3.4" },
    offers: [{ service: "prime", type: "rent", price: 3.99 }, { service: "tubi", type: "free" }],
    trailerId: "nENY-93zwyk",
    keywords: ["pilot", "addiction", "drama", "courtroom", "redemption"],
    cast: ["Denzel Washington", "Don Cheadle", "Kelly Reilly"],
    setting: ["Atlanta", "Georgia", "United States"],
  },
  {
    id: "imdb:tt2671706",
    title: "Fences",
    mediaType: "movie",
    year: 2016,
    runtime: "2h 19m",
    genres: ["Drama"],
    overview:
      "A working-class African-American father tries to raise his family in the 1950s while coming to terms with his own life.",
    ratings: { imdb: "7.2", rt: "92%", metacritic: "79", tmdb: "7.2", letterboxd: "3.7" },
    offers: [{ service: "prime", type: "free" }, { service: "appletv", type: "rent", price: 3.99 }],
    trailerId: "9RN2ImsaoTM",
    keywords: ["family", "drama", "1950s", "play adaptation", "fatherhood"],
    cast: ["Denzel Washington", "Viola Davis", "Stephen Henderson"],
    setting: ["Pittsburgh", "Pennsylvania", "United States"],
  },

  // ---- Films set in Hawaii (powers "movies set in Hawaii") ---- //
  {
    id: "imdb:tt1049413",
    title: "The Descendants",
    mediaType: "movie",
    year: 2011,
    runtime: "1h 55m",
    genres: ["Drama", "Comedy"],
    overview:
      "A Honolulu land baron tries to reconnect with his two daughters after his wife is left comatose by a boating accident.",
    ratings: { imdb: "7.3", rt: "89%", metacritic: "84", tmdb: "7.0", letterboxd: "3.5" },
    offers: [{ service: "disney", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "Vqnk__2rEZI",
    keywords: ["family", "grief", "drama", "island", "bittersweet"],
    cast: ["George Clooney", "Shailene Woodley", "Beau Bridges"],
    setting: ["Hawaii", "Honolulu", "Oahu", "Kauai", "United States", "island"],
  },
  {
    id: "imdb:tt1068680",
    title: "Forgetting Sarah Marshall",
    mediaType: "movie",
    year: 2008,
    runtime: "1h 51m",
    genres: ["Comedy", "Romance"],
    overview:
      "Heartbroken after a breakup, a man takes a Hawaiian vacation only to discover his ex and her new boyfriend at the same resort.",
    ratings: { imdb: "7.1", rt: "85%", metacritic: "67", tmdb: "6.9", letterboxd: "3.4" },
    offers: [{ service: "netflix", type: "free" }, { service: "prime", type: "rent", price: 3.99 }],
    trailerId: "tjNhXWNZAMw",
    keywords: ["breakup", "comedy", "romance", "vacation", "resort"],
    cast: ["Jason Segel", "Kristen Bell", "Mila Kunis", "Russell Brand"],
    setting: ["Hawaii", "Oahu", "Turtle Bay", "United States", "island"],
  },
  {
    id: "imdb:tt0405469",
    title: "50 First Dates",
    mediaType: "movie",
    year: 2004,
    runtime: "1h 39m",
    genres: ["Comedy", "Romance"],
    overview:
      "A marine veterinarian falls for a woman with short-term memory loss and must win her over anew every single day.",
    ratings: { imdb: "6.8", rt: "45%", metacritic: "48", tmdb: "6.8", letterboxd: "3.2" },
    offers: [{ service: "netflix", type: "free" }, { service: "hulu", type: "free" }],
    trailerId: "tRUR-Cw6Wro",
    keywords: ["romance", "comedy", "memory", "feel-good", "beach"],
    cast: ["Adam Sandler", "Drew Barrymore", "Rob Schneider"],
    setting: ["Hawaii", "Oahu", "United States", "island", "beach"],
  },
  {
    id: "imdb:tt0325980",
    title: "Pirates of the Caribbean: The Curse of the Black Pearl",
    mediaType: "movie",
    year: 2003,
    runtime: "2h 23m",
    genres: ["Action", "Adventure", "Fantasy"],
    overview:
      "Blacksmith Will Turner teams up with eccentric pirate Jack Sparrow to save his love from cursed pirates.",
    ratings: { imdb: "8.1", rt: "79%", metacritic: "63", tmdb: "7.8", letterboxd: "3.9" },
    offers: [{ service: "disney", type: "free" }],
    trailerId: "i5jTt8T0zjw",
    keywords: ["pirates", "adventure", "fantasy", "caribbean", "swashbuckler"],
    cast: ["Johnny Depp", "Orlando Bloom", "Keira Knightley"],
    setting: ["Caribbean", "Hawaii", "island", "high seas"],
  },
];
