import {
  isGenericEpisodeTitle,
  pickPreferredEpisodeTitle,
} from "../../lib/episode-title.ts";

export type PickerEpisodeTitle = {
  season: number;
  episode: number;
  name?: string | null;
};

export type PickerEpisodeTitleSource = {
  season?: number | null;
  episode?: number | null;
  number?: number | null;
  name?: string | null;
  title?: string | null;
};

export type PickerEpisodeTitleResolution<T extends PickerEpisodeTitle> = {
  episode: T | undefined;
  resolveEpisode: () => Promise<T | undefined>;
  settleEpisode: () => Promise<T | undefined>;
};

export type PickerEpisodeTitleResolutionOptions = {
  /** Maximum extra time an action waits; background resolution is not cancelled. */
  actionWaitMs?: number;
};

function matchesEpisode(
  episode: PickerEpisodeTitle,
  source: PickerEpisodeTitleSource,
): boolean {
  const number = source.episode ?? source.number;
  return source.season === episode.season && number === episode.episode;
}

export function mergePickerEpisodeTitle<T extends PickerEpisodeTitle>(
  episode: T,
  sources: readonly PickerEpisodeTitleSource[] | null | undefined,
): T {
  const matches = (sources ?? []).filter((source) => matchesEpisode(episode, source));
  const name = pickPreferredEpisodeTitle(
    episode.episode,
    episode.name,
    ...matches.flatMap((source) => [source.name, source.title]),
  );
  return name != null && name !== episode.name ? { ...episode, name } : episode;
}

/**
 * Builds one lazy, shared settlement for every action originating from a picker.
 * A failed or empty provider lookup is deliberately successful settlement with
 * the original episode, so playback is never blocked by title enrichment.
 */
export function createPickerEpisodeTitleResolution<T extends PickerEpisodeTitle>(
  episode: T | undefined,
  sources: readonly PickerEpisodeTitleSource[] | null | undefined,
  loadSources?: () => Promise<readonly PickerEpisodeTitleSource[]>,
  options: PickerEpisodeTitleResolutionOptions = {},
): PickerEpisodeTitleResolution<T> {
  const initial = episode ? mergePickerEpisodeTitle(episode, sources) : undefined;
  let resolutionPromise: Promise<T | undefined> | null = null;
  let settledPromise: Promise<T | undefined> | null = null;
  let resolutionDone = false;

  const resolveEpisode = (): Promise<T | undefined> => {
    if (resolutionPromise) return resolutionPromise;
    if (!initial || !isGenericEpisodeTitle(initial.name, initial.episode) || !loadSources) {
      resolutionDone = true;
      resolutionPromise = Promise.resolve(initial);
      return resolutionPromise;
    }

    resolutionPromise = Promise.resolve()
      .then(loadSources)
      .then((loaded) => mergePickerEpisodeTitle(initial, loaded))
      .catch(() => initial)
      .then((resolved) => {
        resolutionDone = true;
        return resolved;
      });
    return resolutionPromise;
  };

  const settleEpisode = (): Promise<T | undefined> => {
    const resolution = resolveEpisode();
    if (resolutionDone) return resolution;
    if (settledPromise) return settledPromise;
    const waitMs = options.actionWaitMs;
    if (waitMs == null) {
      settledPromise = resolution;
      return settledPromise;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const fallback =
      waitMs <= 0
        ? Promise.resolve(initial)
        : new Promise<T | undefined>((resolve) => {
            timeoutId = setTimeout(() => resolve(initial), waitMs);
          });
    settledPromise = Promise.race([resolution, fallback]).finally(() => {
      if (timeoutId != null) clearTimeout(timeoutId);
    });
    return settledPromise;
  };

  return { episode: initial, resolveEpisode, settleEpisode };
}
