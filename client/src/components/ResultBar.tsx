import { useState } from "react";
import type { Production } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { RatingBadge } from "./RatingBadge";
import { SourceChip } from "./SourceChip";
import { TrailerDialog } from "./TrailerDialog";
import { posterGradient, initials } from "@/lib/poster";
import { Play, Film, Tv } from "lucide-react";

// A single horizontal search-result bar:
//  poster · title/meta/overview · ratings · source chips · trailer thumb · play · seen toggle
export function ResultBar({
  p,
  onToggleSeen,
}: {
  p: Production;
  onToggleSeen: (p: Production, seen: boolean) => void;
}) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const grad = posterGradient(p.title);
  // Primary play target: the cheapest/free offer's deep link (already sorted).
  const primary = p.availability[0];

  return (
    <article
      className="group flex items-stretch gap-3 rounded-xl border border-card-border bg-card p-3 transition-colors hover:border-primary/40 sm:gap-4 sm:p-4"
      data-testid={`bar-${p.id}`}
    >
      {/* Poster */}
      <div
        className="relative hidden h-[120px] w-20 shrink-0 overflow-hidden rounded-lg sm:block"
        style={{
          backgroundImage: p.posterUrl
            ? `url(${p.posterUrl})`
            : `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!p.posterUrl && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/90">
            {p.mediaType === "series" ? (
              <Tv className="h-5 w-5 opacity-70" />
            ) : (
              <Film className="h-5 w-5 opacity-70" />
            )}
            <span className="text-lg font-bold tracking-tight">{initials(p.title)}</span>
          </div>
        )}
      </div>

      {/* Main info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3
              className="truncate text-base font-semibold text-foreground"
              data-testid={`title-${p.id}`}
            >
              {p.title}
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {p.year}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="uppercase tracking-wide">
              {p.mediaType === "series" ? "Series" : "Movie"}
            </span>
            {p.runtime && <span>· {p.runtime}</span>}
            {p.genres.length > 0 && (
              <span className="truncate">· {p.genres.join(", ")}</span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90 sm:line-clamp-2">
            {p.overview}
          </p>
        </div>

        {/* Ratings + sources */}
        <div className="flex flex-wrap items-center gap-1.5">
          {p.ratings.map((r) => (
            <RatingBadge key={r.sourceId} rating={r} />
          ))}
          <span className="mx-0.5 hidden h-4 w-px bg-border sm:inline-block" />
          {p.availability.map((a) => (
            <SourceChip key={a.serviceId} a={a} />
          ))}
        </div>
      </div>

      {/* Trailer thumbnail */}
      {p.trailerUrl && (
        <button
          onClick={() => setTrailerOpen(true)}
          className="relative hidden aspect-video h-[68px] shrink-0 overflow-hidden rounded-lg ring-1 ring-card-border transition hover:ring-primary md:block"
          aria-label={`Play ${p.title} trailer`}
          data-testid={`trailer-${p.id}`}
          style={{
            backgroundImage: p.trailerThumb ? `url(${p.trailerThumb})` : undefined,
            backgroundColor: "#000",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/20">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-black">
              <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
            </span>
          </span>
          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[0.6rem] font-medium text-white">
            Trailer
          </span>
        </button>
      )}

      {/* Actions: Play (deep link) + Seen toggle */}
      <div className="flex shrink-0 flex-col items-center justify-between gap-2 pl-1">
        {primary && (
          <a
            href={primary.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95"
            aria-label={`Play ${p.title} on ${primary.serviceName}`}
            title={`Play on ${primary.serviceName}`}
            data-testid={`play-${p.id}`}
          >
            <Play className="h-5 w-5 translate-x-px fill-current" />
          </a>
        )}
        <div className="flex flex-col items-center gap-1">
          <Switch
            checked={p.seen}
            onCheckedChange={(v) => onToggleSeen(p, v)}
            aria-label="Mark as seen"
            data-testid={`seen-${p.id}`}
          />
          <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            Seen
          </span>
        </div>
      </div>

      <TrailerDialog
        open={trailerOpen}
        onOpenChange={setTrailerOpen}
        title={p.title}
        trailerUrl={p.trailerUrl}
      />
    </article>
  );
}
