const NUMBERED_PLACEHOLDER = /^episode\s+0*(\d+)$/i;
const UNNUMBERED_PLACEHOLDER = /^(?:untitled|tbd|tba)$/i;

export function isGenericEpisodeTitle(
  title: string | null | undefined,
  episodeNumber?: number,
): boolean {
  const value = title?.trim();
  if (!value) return true;
  if (UNNUMBERED_PLACEHOLDER.test(value)) return true;
  const match = NUMBERED_PLACEHOLDER.exec(value);
  if (!match) return false;
  if (episodeNumber == null) return true;
  return Number(match[1]) === episodeNumber;
}

export function pickPreferredEpisodeTitle(
  episodeNumber: number,
  ...candidates: Array<string | null | undefined>
): string | null {
  const values = candidates
    .map((candidate) => candidate?.trim())
    .filter((candidate): candidate is string => !!candidate);
  return (
    values.find((candidate) => !isGenericEpisodeTitle(candidate, episodeNumber)) ??
    values[0] ??
    null
  );
}

type SeriesEpisodeTitleTarget = {
  seasonNumber: number;
  episodeNumber: number;
  name?: string | null;
};

type SeriesEpisodeTitleSource = {
  season?: number;
  episode?: number;
  number?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  name?: string | null;
  title?: string | null;
};

type SeriesEpisodeTitleSources = {
  tmdb?: readonly SeriesEpisodeTitleSource[] | null;
  tvdb?: readonly SeriesEpisodeTitleSource[] | null;
  cinemeta?: readonly SeriesEpisodeTitleSource[] | null;
};

function episodeTitleSourceKey(source: SeriesEpisodeTitleSource): string | null {
  const season = source.seasonNumber ?? source.season;
  const episode = source.episodeNumber ?? source.episode ?? source.number;
  if (season == null || episode == null || !Number.isFinite(season) || !Number.isFinite(episode)) {
    return null;
  }
  return `${season}:${episode}`;
}

function episodeTitleSourceMap(
  sources: readonly SeriesEpisodeTitleSource[] | null | undefined,
): Map<string, Array<string | null | undefined>> {
  const byEpisode = new Map<string, Array<string | null | undefined>>();
  for (const source of sources ?? []) {
    const key = episodeTitleSourceKey(source);
    if (!key) continue;
    const titles = byEpisode.get(key) ?? [];
    titles.push(source.name, source.title);
    byEpisode.set(key, titles);
  }
  return byEpisode;
}

export function mergeSeriesEpisodeTitles<T extends SeriesEpisodeTitleTarget>(
  episodes: readonly T[],
  sources: SeriesEpisodeTitleSources,
): T[] {
  const tmdb = episodeTitleSourceMap(sources.tmdb);
  const tvdb = episodeTitleSourceMap(sources.tvdb);
  const cinemeta = episodeTitleSourceMap(sources.cinemeta);

  return episodes.map((episode) => {
    const key = `${episode.seasonNumber}:${episode.episodeNumber}`;
    const preferred = pickPreferredEpisodeTitle(
      episode.episodeNumber,
      ...(tmdb.get(key) ?? []),
      ...(tvdb.get(key) ?? []),
      episode.name,
      ...(cinemeta.get(key) ?? []),
    );
    return preferred && preferred !== episode.name ? { ...episode, name: preferred } : episode;
  });
}

type PlaybackEpisodeTitle = {
  season: number;
  episode: number;
  name?: string;
};

export async function resolveEpisodeTitleOnDemand<T extends PlaybackEpisodeTitle>(
  episode: T,
  displayedTitle: string | null | undefined,
  loadSeasonEpisodes: () => Promise<readonly PlaybackEpisodeTitle[]>,
  maxWaitMs?: number,
): Promise<T> {
  const currentTitle = pickPreferredEpisodeTitle(
    episode.episode,
    episode.name,
    displayedTitle,
  );
  if (!isGenericEpisodeTitle(currentTitle, episode.episode)) {
    return currentTitle === episode.name ? episode : { ...episode, name: currentTitle ?? undefined };
  }

  const load = Promise.resolve()
    .then(loadSeasonEpisodes)
    .catch((): readonly PlaybackEpisodeTitle[] => []);
  let loaded: readonly PlaybackEpisodeTitle[];
  if (maxWaitMs == null) {
    loaded = await load;
  } else if (maxWaitMs <= 0) {
    loaded = [];
  } else {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<readonly PlaybackEpisodeTitle[]>((resolve) => {
      timeoutId = setTimeout(() => resolve([]), maxWaitMs);
    });
    try {
      loaded = await Promise.race([load, timeout]);
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId);
    }
  }
  const matching = loaded.find(
    (candidate) =>
      candidate.season === episode.season && candidate.episode === episode.episode,
  );
  const preferred = pickPreferredEpisodeTitle(
    episode.episode,
    currentTitle,
    matching?.name,
  );
  return preferred && preferred !== episode.name ? { ...episode, name: preferred } : episode;
}

export function waitForEpisodeTitles<T extends { number: number; title?: string | null }>(
  episodes: T[],
  enrichment: Promise<T[]>,
): Promise<T[]> {
  return episodes.some((episode) => isGenericEpisodeTitle(episode.title, episode.number))
    ? enrichment
    : Promise.resolve(episodes);
}
