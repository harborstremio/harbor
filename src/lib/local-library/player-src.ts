import type { LocalEntry } from "@/lib/local-library";
import type { PlayerSrc } from "@/lib/view";
import { isKnownLanguage, normalizeLang } from "@/lib/subtitles/language";
import { episodeSpanLabel, parseEpisodeSpan } from "@/lib/episode-span";

export function episodeLabel(e: LocalEntry): string | null {
  if (e.type === "show" && e.season != null && e.episode != null) {
    return episodeSpanLabel({
      season: e.season,
      episode: e.episode,
      episodeEnd: e.episodeEnd ?? parseEpisodeSpan(e.filename)?.episodeEnd,
    });
  }
  return null;
}

function fileStem(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? "";
  const extensionAt = name.lastIndexOf(".");
  return extensionAt > 0 ? name.slice(0, extensionAt) : name;
}

export function subtitleLanguage(videoPath: string, subtitlePath: string): string | undefined {
  const videoStem = fileStem(videoPath);
  const subtitleStem = fileStem(subtitlePath);
  if (subtitleStem === videoStem) return undefined;
  if (!subtitleStem.startsWith(`${videoStem}.`)) return undefined;
  const candidate = subtitleStem
    .slice(videoStem.length + 1)
    .split(".")[0]
    ?.trim()
    .toLowerCase();
  return candidate && /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(candidate) && isKnownLanguage(candidate)
    ? normalizeLang(candidate)
    : undefined;
}

export function localPlayerSrc(
  entry: LocalEntry,
  isAnimeHint?: boolean,
  selectedEpisode?: { season: number; episode: number },
): PlayerSrc {
  const epLabel = episodeLabel(entry);
  const inferred = parseEpisodeSpan(entry.filename);
  const episodeSpan =
    entry.season != null && entry.episode != null
      ? {
          season: entry.season,
          episode: entry.episode,
          episodeEnd: entry.episodeEnd ?? inferred?.episodeEnd ?? entry.episode,
        }
      : undefined;
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
          season: selectedEpisode?.season ?? (entry.season as number),
          episode: selectedEpisode?.episode ?? (entry.episode as number),
          imdbId: entry.imdbId ?? undefined,
        }
      : undefined,
    episodeEnd: episodeSpan?.episodeEnd,
    episodeSpan,
    url: entry.path,
    title: entry.title,
    subtitle: ["Local", epLabel ?? (entry.year ? String(entry.year) : entry.filename)]
      .filter(Boolean)
      .join(" · "),
    notWebReady: true,
    isAnime: isAnimeHint || entry.isAnime,
    subtitles: entry.subtitlePaths?.map((url) => ({
      url,
      lang: subtitleLanguage(entry.path, url),
      trustedSource: true,
    })),
    streamRef: { resolvedFilename: entry.filename },
  };
}
