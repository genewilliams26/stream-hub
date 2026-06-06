import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SettingsData } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function Settings() {
  const { data: settings } = useQuery<SettingsData>({ queryKey: ["/api/settings"] });

  const save = useMutation({
    mutationFn: async (next: SettingsData) => apiRequest("PUT", "/api/settings", next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/search"] });
    },
  });

  function patch(p: Partial<SettingsData>) {
    if (!settings) return;
    save.mutate({ ...settings, ...p });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            data-testid="link-back"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure which services, ratings, and trailer sources power your search.
        </p>

        {!settings ? (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* AI search */}
            <Section
              title="AI search"
              desc="Use natural-language understanding to interpret queries. Falls back to keyword matching when offline."
            >
              <Row
                label={
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Natural-language search
                  </span>
                }
              >
                <Switch
                  checked={settings.aiSearch}
                  onCheckedChange={(v) => patch({ aiSearch: v })}
                  data-testid="toggle-ai"
                />
              </Row>
            </Section>

            {/* Streaming services */}
            <Section
              title="Streaming services"
              desc="Toggle the services you have accounts for. The deep-link template opens each title’s page on that service. {q} is replaced with the title."
            >
              <div className="space-y-3">
                {settings.services.map((svc, i) => (
                  <div
                    key={svc.id}
                    className="rounded-lg border border-card-border bg-card/50 p-3"
                    data-testid={`svc-${svc.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: svc.color }}
                        />
                        <span className="text-sm font-medium text-foreground">{svc.name}</span>
                      </div>
                      <Switch
                        checked={svc.enabled}
                        onCheckedChange={(v) => {
                          const services = [...settings.services];
                          services[i] = { ...svc, enabled: v };
                          patch({ services });
                        }}
                        data-testid={`svc-toggle-${svc.id}`}
                      />
                    </div>
                    <Input
                      value={svc.searchUrlTemplate}
                      onChange={(e) => {
                        const services = [...settings.services];
                        services[i] = { ...svc, searchUrlTemplate: e.target.value };
                        patch({ services });
                      }}
                      className="mt-2 h-8 border-card-border bg-card font-mono text-xs"
                      placeholder="https://service.com/search?q={q}"
                      data-testid={`svc-url-${svc.id}`}
                    />
                  </div>
                ))}
              </div>
            </Section>

            {/* Rating sources */}
            <Section
              title="Ratings shown"
              desc="Pick which rating providers appear on each result bar. Defaults: IMDb, Rotten Tomatoes, Metacritic."
            >
              <div className="space-y-2">
                {settings.ratingSources.map((r, i) => (
                  <Row key={r.id} label={r.name}>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => {
                        const ratingSources = [...settings.ratingSources];
                        ratingSources[i] = { ...r, enabled: v };
                        patch({ ratingSources });
                      }}
                      data-testid={`rating-toggle-${r.id}`}
                    />
                  </Row>
                ))}
              </div>
            </Section>

            {/* Trailer sources */}
            <Section
              title="Trailer sources"
              desc="Preferred sources for finding a playable trailer, in priority order."
            >
              <div className="space-y-2">
                {settings.trailerSources
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map((t) => {
                    const idx = settings.trailerSources.findIndex((x) => x.id === t.id);
                    return (
                      <Row key={t.id} label={`${t.name}`}>
                        <Switch
                          checked={t.enabled}
                          onCheckedChange={(v) => {
                            const trailerSources = [...settings.trailerSources];
                            trailerSources[idx] = { ...t, enabled: v };
                            patch({ trailerSources });
                          }}
                          data-testid={`trailer-toggle-${t.id}`}
                        />
                      </Row>
                    );
                  })}
              </div>
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}
