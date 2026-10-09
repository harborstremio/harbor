import type { Meta } from "@/lib/cinemeta";
import type { PeopleDept, TopTitle } from "@/lib/harbor-rank";
import type { KnownForEntry } from "@/lib/rankings";

export const DEPT_LABEL: Record<PeopleDept, string> = {
  Acting: "Actor",
  Directing: "Director",
  Production: "Producer",
  Writing: "Writer",
};

export function profilePhoto(path: string | null, size: 185 | 342): string | undefined {
  return path ? `https://image.tmdb.org/t/p/w${size}${path}` : undefined;
}

export function bandImage(person: { profilePath: string | null } | undefined): string | undefined {
  if (!person) return undefined;
  const withTitles = person as { topTitles?: Array<{ posterPath: string | null }> };
  const withKnown = person as { knownFor?: Array<{ posterPath: string | null }> };
  const path =
    withTitles.topTitles?.find((t) => t.posterPath)?.posterPath ??
    withKnown.knownFor?.find((k) => k.posterPath)?.posterPath ??
    person.profilePath;
  return path ? `https://image.tmdb.org/t/p/w780${path}` : undefined;
}

export function titleToMeta(tt: TopTitle): Meta {
  const isSeries = tt.mediaType === "tv" || tt.metaId.includes(":tv:") || tt.metaId.includes(":series:");
  const id = tt.metaId || (tt.tmdbId ? `tmdb:${isSeries ? "tv" : "movie"}:${tt.tmdbId}` : "");
  return {
    id,
    type: isSeries ? "series" : "movie",
    name: tt.title,
    poster: tt.posterPath ? `https://image.tmdb.org/t/p/w500${tt.posterPath}` : undefined,
    releaseInfo: tt.year !== null ? String(tt.year) : undefined,
  };
}

export function knownToMeta(k: KnownForEntry): Meta {
  return {
    id: `tmdb:${k.mediaType}:${k.id}`,
    type: k.mediaType === "tv" ? "series" : "movie",
    name: k.title,
    poster: k.posterPath ? `https://image.tmdb.org/t/p/w500${k.posterPath}` : undefined,
    releaseInfo: k.releaseInfo ?? undefined,
  };
}
