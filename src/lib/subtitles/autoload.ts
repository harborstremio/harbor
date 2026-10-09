export const SUBTITLE_PROVIDER_TIMEOUT_MS = 16_000;

export function subtitleSearchImdbId(
  imdbId: string | null | undefined,
  verified: boolean,
): string | undefined {
  return verified && imdbId ? imdbId : undefined;
}

export function canStartSubtitleAutoload(input: {
  imdbId: string | null | undefined;
  mediaReady: boolean;
}): boolean {
  return !!input.imdbId && input.mediaReady;
}

export function withSubtitleTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function loadFirstWorkingSubtitle<T>(
  candidates: T[],
  load: (candidate: T) => Promise<boolean>,
  limit = 5,
): Promise<T | null> {
  for (const candidate of candidates.slice(0, Math.max(0, limit))) {
    if (await load(candidate)) return candidate;
  }
  return null;
}
