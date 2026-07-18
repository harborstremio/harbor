export const CATALOG_REQUEST_TIMEOUT_MS = 5_000;

export function upsertOrdered<T extends { key: string }>(
  rows: T[],
  row: T,
  order: readonly string[],
): T[] {
  const next = rows.filter((item) => item.key !== row.key);
  next.push(row);
  const rank = (key: string) => {
    const index = order.indexOf(key);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  next.sort((a, b) => rank(a.key) - rank(b.key));
  return next;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Catalog request timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
