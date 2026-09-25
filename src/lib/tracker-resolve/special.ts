import { movieMatches, normalizeTitle } from "./match";
import { hydrateIdentity } from "./resolve-default";
import { searchMovies, type MovieCandidate } from "./trakt-catalog";
import type { ExternalShowIds } from "./types";

export type ResolvedSpecialMovie = { ids: ExternalShowIds };

export type SpecialDeps = { searchMovies: (title: string) => Promise<MovieCandidate[]> };

const cache = new Map<string, ResolvedSpecialMovie | null>();
const MAX_ENTRIES = 200;

export async function resolveSpecialMovie(
  metaId: string,
  season: number,
  number: number,
  deps: SpecialDeps = { searchMovies },
): Promise<ResolvedSpecialMovie | null> {
  const identity = await hydrateIdentity(metaId, season, number);
  if (!identity) return null;
  const key = `${normalizeTitle(identity.showTitle)}|${identity.showYear ?? ""}|${normalizeTitle(identity.name)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let candidates: MovieCandidate[];
  try {
    candidates = await deps.searchMovies(identity.name ?? "");
  } catch {
    return null;
  }
  const hit = candidates.find((candidate) => movieMatches(identity, candidate));
  const result = hit ? { ids: hit.ids } : null;
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, result);
  return result;
}

export function clearSpecialMovieCache(): void {
  cache.clear();
}
