export type ReviewDiscoveryRow<Episode, Candidate> = {
  episode: Episode;
  candidates: Candidate[];
};

export type ReviewSelection<Episode, Candidate> = {
  episode: Episode;
  candidate: Candidate | null;
};

export type ReviewSelectionResult<Episode> = {
  episode: Episode;
  status: "queued" | "failed" | "skipped";
};

function limiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
    try {
      return await fn();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

export async function discoverReviewRows<Episode, Candidate>(
  episodes: Episode[],
  find: (episode: Episode) => Promise<Candidate[]>,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewDiscoveryRow<Episode, Candidate>[]> {
  const rows: ReviewDiscoveryRow<Episode, Candidate>[] = [];
  let done = 0;
  const limit = limiter(2);
  await Promise.all(
    episodes.map((episode, index) =>
      limit(async () => {
        if (signal.aborted) return;
        const candidates = await find(episode).catch(() => []);
        if (signal.aborted) return;
        rows[index] = { episode, candidates };
        onProgress?.(++done, episodes.length);
      }),
    ),
  );
  return signal.aborted ? [] : rows.filter(Boolean);
}

export async function resolveReviewSelections<Episode, Candidate>(
  selections: ReviewSelection<Episode, Candidate>[],
  resolveAndQueue: (episode: Episode, candidate: Candidate) => Promise<void>,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewSelectionResult<Episode>[]> {
  const selected = selections.filter(
    (selection): selection is ReviewSelection<Episode, Candidate> & { candidate: Candidate } =>
      selection.candidate !== null,
  );
  const results: ReviewSelectionResult<Episode>[] = selections
    .filter((selection) => selection.candidate === null)
    .map(({ episode }) => ({ episode, status: "skipped" }));
  let done = 0;
  const limit = limiter(2);
  const resolved = await Promise.all(
    selected.map(({ episode, candidate }) =>
      limit(async () => {
        if (signal.aborted) return null;
        let status: ReviewSelectionResult<Episode>["status"] = "failed";
        try {
          await resolveAndQueue(episode, candidate);
          if (signal.aborted) return null;
          status = "queued";
        } catch {
          status = "failed";
        }
        if (signal.aborted) return null;
        onProgress?.(++done, selected.length);
        return { episode, status } satisfies ReviewSelectionResult<Episode>;
      }),
    ),
  );
  results.push(
    ...resolved.filter((result): result is NonNullable<typeof result> => result !== null),
  );
  return results;
}
