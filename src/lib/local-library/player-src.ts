import type { LocalEntry } from "@/lib/local-library";
import type { PlayerSrc } from "@/lib/view";

export function episodeLabel(e: LocalEntry): string | null {
  if (e.type === "show" && e.season != null && e.episode != null) {
    return `S${String(e.season).padStart(2, "0")}E${String(e.episode).padStart(2, "0")}`;
  }
  return null;
}

export function localPlayerSrc(entry: LocalEntry): PlayerSrc {
  const epLabel = episodeLabel(entry);
  return {
    meta: {
      id: entry.imdbId ?? `local:${entry.id}`,
      type: entry.type === "show" ? "series" : "movie",
      name: entry.title,
      poster: entry.poster ?? undefined,
      releaseInfo: entry.year ? String(entry.year) : undefined,
    },
    imdbId: entry.imdbId ?? undefined,
    episode: epLabel
      ? {
          season: entry.season as number,
          episode: entry.episode as number,
          imdbId: entry.imdbId ?? undefined,
        }
      : undefined,
    url: entry.path,
    title: entry.title,
    subtitle: epLabel ?? (entry.year ? String(entry.year) : entry.filename),
    notWebReady: true,
  };
}
