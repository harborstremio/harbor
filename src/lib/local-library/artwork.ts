import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { imageLangRank } from "@/lib/providers/tmdb/tmdb-image-lang";
import { fetchMovieAssets } from "@/lib/providers/tmdb/tmdb-images";

export type ArtworkPaths = { poster?: string; logo?: string; backdrop?: string };

function pickByLang<T extends { file_path?: string; iso_639_1?: string | null; vote_average?: number }>(
  entries: T[] | undefined,
  originalLang?: string | null,
): string | undefined {
  if (!entries?.length) return undefined;
  const ranked = entries
    .map((e) => ({ e, r: imageLangRank(e.iso_639_1 ?? null, originalLang) }))
    .sort((a, b) => b.r - a.r || (b.e.vote_average ?? 0) - (a.e.vote_average ?? 0));
  return ranked[0]?.e.file_path ?? undefined;
}

export async function resolveArtworkPaths(
  key: string,
  metaId: string,
  originalLang?: string | null,
): Promise<ArtworkPaths> {
  const assets = await fetchMovieAssets(key, metaId, originalLang);
  if (!assets) return {};
  const backdrop = (assets.backdrops ?? [])
    .slice()
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]?.file_path;
  return {
    poster: pickByLang(assets.posters, originalLang),
    logo: pickByLang(assets.logos, originalLang),
    backdrop,
  };
}

export function artworkUrl(filePath: string, size: string): string {
  return `${IMG}/${size}${filePath}`;
}
