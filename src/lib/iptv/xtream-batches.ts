export type BatchProgress = {
  processed: number;
  total: number;
};

type BatchOptions<T, R> = {
  batchSize: number;
  map: (value: T, index: number) => R | null | undefined;
  onBatch?: (batch: readonly R[], progress: BatchProgress) => boolean | void;
  yieldControl?: () => Promise<void>;
};

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const hidden = typeof document !== "undefined" && document.hidden;
    if (!hidden && typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export async function processInBatches<T, R>(
  values: readonly T[],
  options: BatchOptions<T, R>,
): Promise<R[]> {
  const batchSize = Math.max(1, Math.floor(options.batchSize));
  const result: R[] = [];

  for (let start = 0; start < values.length; start += batchSize) {
    const end = Math.min(start + batchSize, values.length);
    const batch: R[] = [];
    for (let index = start; index < end; index += 1) {
      const mapped = options.map(values[index], index);
      if (mapped == null) continue;
      batch.push(mapped);
      result.push(mapped);
    }

    const keepGoing = options.onBatch?.(batch, { processed: end, total: values.length });
    if (keepGoing === false) break;
    if (end < values.length) await (options.yieldControl ?? yieldToBrowser)();
  }

  return result;
}
