const owners = new Map<string, string>();

export function releaseUniqueArt(key: string): void {
  for (const [id, owner] of owners) {
    if (owner === key) owners.delete(id);
  }
}

export function claimUniqueArt<T>(
  key: string,
  items: T[],
  idOf: (item: T) => string,
  count: number,
): T[] {
  releaseUniqueArt(key);
  const out: T[] = [];
  for (const item of items) {
    const id = idOf(item);
    if (!id || owners.has(id)) continue;
    owners.set(id, key);
    out.push(item);
    if (out.length >= count) break;
  }
  return out;
}
