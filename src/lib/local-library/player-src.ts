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
  const imdbId = /^tt\d+$/.test(entry.imdbId ?? "") ? (entry.imdbId ?? undefined) : undefined;
  return {
    meta: {
      id: imdbId ?? `local:${entry.id}`,
      type: entry.type === "show" ? "series" : "movie",
      name: entry.title,
      poster: entry.poster ?? undefined,
      releaseInfo: entry.year ? String(entry.year) : undefined,
    },
    imdbId,
    imdbIdVerified: !!imdbId,
    tmdbId: entry.tmdbId ?? undefined,
    episode: epLabel
      ? {
          season: entry.season as number,
          episode: entry.episode as number,
          imdbId,
        }
      : undefined,
    url: entry.path,
    title: entry.title,
    subtitle: epLabel ?? (entry.year ? String(entry.year) : entry.filename),
    notWebReady: true,
    subtitleHints: {
      filename: entry.filename,
      release: entry.filename,
      resolution: entry.resolution ?? null,
    },
  };
}
