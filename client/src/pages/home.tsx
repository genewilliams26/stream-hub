import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Production, SettingsData, SearchResponse } from "@/lib/types";
import { ResultBar } from "@/components/ResultBar";
import { Logo } from "@/components/Logo";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Settings as SettingsIcon, Sparkles, Wand2, Clapperboard } from "lucide-react";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 400);

  const { data: settings } = useQuery<SettingsData>({ queryKey: ["/api/settings"] });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<SettingsData>) => {
      const next = { ...(settings as SettingsData), ...patch };
      return apiRequest("PUT", "/api/settings", next);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/search"] });
    },
  });

  const search = useQuery<SearchResponse>({
    queryKey: ["/api/search", debounced, settings?.includeSeen, settings?.includePay, settings?.payLimit],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(debounced)}`);
      return res.json();
    },
    enabled: !!settings,
  });

  const toggleSeen = useMutation({
    mutationFn: async ({ p, seen }: { p: Production; seen: boolean }) => {
      if (seen) {
        return apiRequest("POST", "/api/seen", {
          productionId: p.id,
          title: p.title,
          mediaType: p.mediaType,
          year: p.year,
        });
      }
      return apiRequest("DELETE", `/api/seen/${encodeURIComponent(p.id)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search"] });
    },
  });

  const results = search.data?.results ?? [];
  const payLimitValue = settings?.payLimit ? String(settings.payLimit) : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Settings"
            data-testid="link-settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8">
        {/* Search */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            What do you want to watch?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One AI search across every service you subscribe to.
          </p>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "mind-bending sci-fi" or "that movie with the spinning top"'
              className="h-14 rounded-2xl border-card-border bg-card pl-12 pr-4 text-base shadow-lg focus-visible:ring-primary"
              data-testid="input-search"
              autoFocus
            />
          </div>

          {/* Global toggles */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2.5 text-sm" data-testid="toggle-include-seen">
              <Switch
                checked={settings?.includeSeen ?? false}
                onCheckedChange={(v) => updateSettings.mutate({ includeSeen: v })}
                aria-label="Include seen"
              />
              <span className="font-medium text-foreground">Include seen</span>
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2.5 text-sm" data-testid="toggle-include-pay">
                <Switch
                  checked={settings?.includePay ?? false}
                  onCheckedChange={(v) => updateSettings.mutate({ includePay: v })}
                  aria-label="Include pay"
                />
                <span className="font-medium text-foreground">Include pay</span>
              </label>
              {/* "up to" price limit, coupled with include-pay */}
              <div
                className={`flex items-center gap-1.5 transition-opacity ${
                  settings?.includePay ? "opacity-100" : "pointer-events-none opacity-40"
                }`}
              >
                <span className="text-xs text-muted-foreground">up to</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.50"
                    inputMode="decimal"
                    value={payLimitValue}
                    placeholder="any"
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      updateSettings.mutate({ payLimit: isNaN(n) ? 0 : n });
                    }}
                    className="h-8 w-20 rounded-lg border-card-border bg-card pl-5 pr-2 text-sm tabular-nums"
                    data-testid="input-pay-limit"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AI interpretation note */}
          {search.data?.usedAi && search.data.interpreted && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span data-testid="text-interpreted">{search.data.interpreted}</span>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {search.isLoading || !settings ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[152px] w-full rounded-xl" />
            ))
          ) : results.length === 0 ? (
            <EmptyState query={debounced} />
          ) : (
            <>
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span data-testid="text-result-count">
                  {results.length} {results.length === 1 ? "result" : "results"}
                </span>
                {!search.data?.usedAi && debounced && (
                  <span className="inline-flex items-center gap-1">
                    <Wand2 className="h-3 w-3" /> Keyword match
                  </span>
                )}
              </div>
              {results.map((p) => (
                <ResultBar
                  key={p.id}
                  p={p}
                  onToggleSeen={(prod, seen) => toggleSeen.mutate({ p: prod, seen })}
                />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <Clapperboard className="h-10 w-10 text-muted-foreground/50" />
      <p className="mt-4 text-sm font-medium text-foreground">
        {query ? `Nothing found for "${query}"` : "No titles to show"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {query
          ? "Try a different phrase, or enable “Include seen” / “Include pay” to widen results."
          : "Adjust your enabled services in Settings, or turn on “Include seen”."}
      </p>
    </div>
  );
}
