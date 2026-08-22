type CwIdentity = { _id: string };

export function dedupeCwFranchises<T extends CwIdentity>(
  items: readonly T[],
  rootOf: (id: string) => string | null,
): T[] {
  const seenRoots = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const root = rootOf(item._id);
    if (root && seenRoots.has(root)) continue;
    if (root) seenRoots.add(root);
    output.push(item);
  }
  return output;
}

export function cwRowKey(items: readonly CwIdentity[]): string {
  return items[0] ? `home:cw:${items[0]._id}` : "home:cw";
}
