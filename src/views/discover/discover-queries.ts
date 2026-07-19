import type { QueryClient } from "@tanstack/react-query";
import { selectDailyRows } from "@/lib/feed";
import { buildFeaturedFast } from "@/lib/feed/featured";
import { getStore } from "@/lib/discover/store";
import type { Settings } from "@/lib/settings/types";

const STALE_MS = 5 * 60_000;
const ROW_COUNT = 14;

/** Day-scoped: daily row rotation must not mix yesterday's cached pages. */
export function discoverScope(settings: Settings): string {
  const streaming = Object.entries(settings.streaming)
    .filter(([, on]) => on)
    .map(([id]) => id)
    .join(",");
  return [
    `tmdb:${settings.tmdbKey}`,
    settings.region,
    settings.tmdbLanguage,
    settings.feedLocaleBias ? "bias" : "nobias",
    settings.preferredLanguages.join(","),
    streaming,
    new Date().toDateString(),
  ].join(":");
}

export const discoverKeys = {
  featuredFast: (scope: string) => ["harbor", "discover", "featured-fast", scope] as const,
  featured: (scope: string) => ["harbor", "discover", "featured", scope] as const,
  critics: (scope: string) => ["harbor", "discover", "critics", scope] as const,
  rail: (scope: string, railId: string, page: number) =>
    ["harbor", "discover", "rail", scope, railId, page] as const,
};

export function discoverDailyRows(settings: Settings) {
  return selectDailyRows(settings.tmdbKey, getStore().affinity, settings, ROW_COUNT);
}

/** Warm the banner + first rails so Discover paints from cache on open. */
export function prefetchDiscoverPage(queryClient: QueryClient, settings: Settings, limit = 6) {
  if (!settings.tmdbKey) return;
  const scope = discoverScope(settings);
  void queryClient.prefetchQuery({
    queryKey: discoverKeys.featuredFast(scope),
    queryFn: () => buildFeaturedFast(settings.tmdbKey, settings),
    staleTime: STALE_MS,
  });
  for (const def of discoverDailyRows(settings).slice(0, limit)) {
    void queryClient.prefetchQuery({
      queryKey: discoverKeys.rail(scope, def.id, 1),
      queryFn: () => def.fetch(1),
      staleTime: STALE_MS,
    });
  }
}
