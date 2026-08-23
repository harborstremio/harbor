import { isGenericEpisodeTitle } from "../episode-title.ts";

export type AniZipEpisodeTitleFields = {
  episodeNumber?: number;
  title?: Record<string, string | null | undefined>;
  titles?: Record<string, string | null | undefined>;
};

const LANGUAGE_ORDER = ["en", "x-jat", "ja"] as const;

export function pickEpisodeTitle(ep: AniZipEpisodeTitleFields | undefined): string | null {
  if (!ep) return null;
  const candidates: string[] = [];
  for (const titles of [ep.title, ep.titles]) {
    for (const language of LANGUAGE_ORDER) {
      const value = titles?.[language]?.trim();
      if (value) candidates.push(value);
    }
  }
  return candidates.find((candidate) => !isGenericEpisodeTitle(candidate, ep.episodeNumber)) ?? null;
}
