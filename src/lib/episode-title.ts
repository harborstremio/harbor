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

export function waitForEpisodeTitles<T extends { number: number; title?: string | null }>(
  episodes: T[],
  enrichment: Promise<T[]>,
): Promise<T[]> {
  return episodes.some((episode) => isGenericEpisodeTitle(episode.title, episode.number))
    ? enrichment
    : Promise.resolve(episodes);
}
