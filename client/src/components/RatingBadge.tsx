import type { Rating } from "@/lib/types";
import { Star } from "lucide-react";

// Compact rating chip. Color-codes the value so good/bad reads at a glance,
// while keeping the source label clear (IMDb, Rotten Tomatoes, Metacritic...).

function toneFor(rating: Rating): string {
  // Normalize to 0..100 for coloring.
  let pct = 0;
  const v = rating.value.replace("%", "");
  const num = parseFloat(v);
  if (rating.value.includes("%")) pct = num;
  else if (rating.sourceId === "imdb" || rating.sourceId === "tmdb") pct = num * 10;
  else if (rating.sourceId === "letterboxd") pct = num * 20;
  else pct = num; // metacritic already 0-100

  if (pct >= 75) return "text-emerald-400";
  if (pct >= 55) return "text-amber-400";
  return "text-rose-400";
}

const SOURCE_ABBR: Record<string, string> = {
  imdb: "IMDb",
  rt: "RT",
  metacritic: "MC",
  tmdb: "TMDB",
  letterboxd: "LBd",
};

export function RatingBadge({ rating }: { rating: Rating }) {
  const tone = toneFor(rating);
  const abbr = SOURCE_ABBR[rating.sourceId] ?? rating.label;
  return (
    <div
      className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1"
      title={`${rating.label}: ${rating.value}`}
      data-testid={`rating-${rating.sourceId}`}
    >
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {abbr}
      </span>
      <span className={`text-xs font-semibold tabular-nums ${tone}`}>
        {rating.value}
      </span>
      {rating.sourceId === "imdb" && (
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      )}
    </div>
  );
}
