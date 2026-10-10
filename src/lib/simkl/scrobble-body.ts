export type ScrobbleAction = "start" | "pause" | "stop";

export type EpisodeRef =
  | {
      season?: number;
      episode?: number;
      imdbId?: string;
      imdbSeason?: number;
      imdbEpisode?: number;
      kitsuStreamId?: string;
      sourceMetaId?: string;
    }
  | undefined;

export type ScrobbleInfo = { title?: string; year?: number | null; imdb?: string; tmdb?: number };

const ANIME_ENTRY = /^(kitsu|mal|anilist|anidb):(\d+)$/;

/**
 * The anime entry an episode belongs to, when the player knows one. A scoped
 * `kitsu:{entry}:{n}` stream or an explicit `sourceMetaId` names the cour that
 * aired the episode, which is often a different entry than the row's own meta —
 * Simkl keeps such cours as their own single-season anime entries.
 */
export function animeIdentity(
  episode: EpisodeRef,
): { scheme: string; id: number; number?: number } | null {
  const stream = /^kitsu:(\d+):(\d+)$/.exec(episode?.kitsuStreamId ?? "");
  const streamEntry = stream ? `kitsu:${stream[1]}` : null;
  const entry = ANIME_ENTRY.exec(episode?.sourceMetaId ?? "")?.[0] ?? streamEntry;
  if (!entry) return null;
  const [scheme, raw] = entry.split(":");
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  // A matching stream binds its number to this entry; otherwise the episode's
  // own number is already entry-relative.
  const number = stream && entry === streamEntry ? Number(stream[2]) : episode?.episode;
  return { scheme, id, number };
}

function node(
  ids: Record<string, unknown>,
  info?: ScrobbleInfo,
  opts?: { anime?: boolean },
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...ids };
  // An anime entry is named by its own ids only. The row's IMDb id can point at
  // a different Simkl entry entirely (another cour, or another season), so it
  // must never be merged into an anime node.
  if (!opts?.anime) {
    if (info?.imdb && /^tt\d+$/.test(info.imdb) && merged.imdb == null) merged.imdb = info.imdb;
    if (info?.tmdb != null && Number.isFinite(info.tmdb) && merged.tmdb == null)
      merged.tmdb = info.tmdb;
  }
  const out: Record<string, unknown> = { ids: merged };
  if (info?.title) out.title = info.title;
  if (info?.year != null) out.year = info.year;
  return out;
}

export function buildEpisodeBody(
  showIds: Record<string, unknown>,
  season: number,
  number: number,
  progress: number,
): Record<string, unknown> {
  const p = Math.min(100, Math.max(0, progress));
  // The resolved ids belong to the tracker entry; original-entry metadata can
  // point at a different show when a continuation is catalogued separately.
  return { progress: p, show: { ids: { ...showIds } }, episode: { season, number } };
}

/**
 * A resolved anime entry (its own single-season, entry-relative numbering) as a
 * Simkl scrobble body. The row's umbrella ids are deliberately omitted: Simkl
 * numbers anime by AniDB, so only the owning entry id can be matched.
 */
export function buildAnimeBody(
  ids: Record<string, number>,
  episode: number,
  progress: number,
): Record<string, unknown> {
  const p = Math.min(100, Math.max(0, progress));
  return { progress: p, anime: { ids }, episode: { season: 1, number: episode } };
}

export function buildBody(
  metaId: string,
  episode: EpisodeRef,
  progress: number,
  info?: ScrobbleInfo,
): Record<string, unknown> | null {
  const p = Math.min(100, Math.max(0, progress));
  // Provider (IMDb/TVDB) coordinates win when present: a season remap hands the
  // player an entry-relative number, but Simkl numbers an imdb/tv entry by the
  // season the provider aired.
  const ep = {
    season: episode?.imdbSeason ?? episode?.season ?? 1,
    number: episode?.imdbEpisode ?? episode?.episode,
  };
  const ids: ScrobbleInfo | undefined =
    episode?.imdbId && !info?.imdb ? { ...info, imdb: episode.imdbId } : info;

  // A named anime entry outranks the row's own meta. Simkl keeps split cours as
  // their own single-season entries numbered from 1, so the entry-relative
  // number is the one it can match — not the provider season.
  const anime = animeIdentity(episode);
  if (anime) {
    const animeNode = node({ [anime.scheme]: anime.id }, ids, { anime: true });
    return anime.number != null
      ? { progress: p, anime: animeNode, episode: { season: 1, number: anime.number } }
      : { progress: p, movie: animeNode };
  }

  if (metaId.startsWith("tt")) {
    const imdb = metaId.split(":")[0];
    if (!/^tt\d+$/.test(imdb)) return null;
    return episode?.episode != null
      ? { progress: p, show: node({ imdb }, ids), episode: ep }
      : { progress: p, movie: node({ imdb }, ids) };
  }

  if (metaId.startsWith("tmdb:movie:")) {
    const id = Number(metaId.split(":")[2]);
    if (!Number.isFinite(id)) return null;
    return { progress: p, movie: node({ tmdb: id }, ids) };
  }

  if (metaId.startsWith("tmdb:tv:")) {
    const id = Number(metaId.split(":")[2]);
    if (!Number.isFinite(id) || episode?.episode == null) return null;
    return { progress: p, show: node({ tmdb: id }, ids), episode: ep };
  }

  const animePrefix = ["kitsu:", "mal:", "anilist:", "anidb:"].find((pre) =>
    metaId.startsWith(pre),
  );
  if (animePrefix) {
    const num = Number(metaId.split(":")[1]);
    if (!Number.isFinite(num)) return null;
    const idKey = animePrefix.slice(0, -1);
    // A Simkl anime entry is single-season, numbered from 1 within the entry.
    const animeEp = { season: episode?.season ?? 1, number: episode?.episode };
    return episode?.episode != null
      ? { progress: p, anime: node({ [idKey]: num }, ids, { anime: true }), episode: animeEp }
      : { progress: p, movie: node({ [idKey]: num }, ids, { anime: true }) };
  }

  return null;
}
