import type { Meta } from "@/lib/cinemeta";

import type { AnilistMedia, AnilistMediaEntry } from "./types";

export function anilistMediaToMeta(m: AnilistMedia): Meta | null {
  const name = m.title.english || m.title.userPreferred || m.title.romaji;
  if (!name) return null;
  const id = m.idMal != null ? `mal:${m.idMal}` : `anilist:${m.id}`;
  return {
    id,
    type: m.format === "MOVIE" ? "movie" : "series",
    name,
    poster: m.coverImage.extraLarge ?? m.coverImage.large ?? undefined,
    background: m.bannerImage ?? undefined,
    releaseInfo: m.seasonYear != null ? String(m.seasonYear) : undefined,
    imdbRating: m.averageScore != null ? (m.averageScore / 10).toFixed(1) : undefined,
  };
}

export function anilistEntryToMeta(entry: AnilistMediaEntry): Meta | null {
  return anilistMediaToMeta(entry.media);
}
