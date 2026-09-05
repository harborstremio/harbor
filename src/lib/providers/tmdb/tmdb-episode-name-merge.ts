import { isGenericEpisodeName } from "../anime-episode-build";

export type TmdbEpisodeText = {
  name: string;
  overview: string;
  still?: string;
};

export type NamedEpisode = {
  episode: number;
  name?: string;
  overview?: string;
  still?: string;
};

export function pickEpisodeName(
  addonName: string | undefined | null,
  tmdbName: string | undefined | null,
): string | undefined {
  const addon = addonName?.trim() ?? "";
  const tmdb = tmdbName?.trim() ?? "";
  if (!tmdb || isGenericEpisodeName(tmdb)) return addon || undefined;
  if (addon && !isGenericEpisodeName(addon)) return addon;
  return tmdb;
}

export function needsTmdbEpisodeNames(eps: readonly NamedEpisode[]): boolean {
  return eps.some((e) => !e.name?.trim() || isGenericEpisodeName(e.name));
}

export function applyTmdbEpisodeNames<T extends NamedEpisode>(
  eps: T[],
  names: ReadonlyMap<number, TmdbEpisodeText>,
): T[] {
  if (names.size === 0 || eps.length === 0) return eps;
  let changed = false;
  const out = eps.map((ep) => {
    const hit = names.get(ep.episode);
    if (!hit) return ep;
    const name = pickEpisodeName(ep.name, hit.name);
    const wantName = !!name && name !== ep.name;
    const wantOverview = !ep.overview?.trim() && !!hit.overview;
    const wantStill = !ep.still && !!hit.still;
    if (!wantName && !wantOverview && !wantStill) return ep;
    changed = true;
    return {
      ...ep,
      name: wantName ? name : ep.name,
      overview: wantOverview ? hit.overview : ep.overview,
      still: wantStill ? hit.still : ep.still,
    };
  });
  return changed ? out : eps;
}
