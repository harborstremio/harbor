import { rowKey, type RemoteFavoriteRow } from "./mapping.ts";

/** Membership changes since the last acknowledged state; a missing base preserves both sets. */
export function mergeFavoriteRows(base: RemoteFavoriteRow[] | null, local: RemoteFavoriteRow[], remote: RemoteFavoriteRow[]): RemoteFavoriteRow[] {
  const result = new Map(remote.map((row) => [rowKey(row), row]));
  const previous = new Set((base ?? []).map(rowKey));
  const current = new Set(local.map(rowKey));
  for (const row of local) if (!previous.has(rowKey(row))) result.set(rowKey(row), row);
  if (base) for (const key of previous) if (!current.has(key)) result.delete(key);
  return [...result.values()];
}

export function favoriteRowsEqual(a: RemoteFavoriteRow[], b: RemoteFavoriteRow[]): boolean {
  const keys = new Set(a.map(rowKey));
  return keys.size === b.length && b.every((row) => keys.has(rowKey(row)));
}

export type FavoriteSyncPorts = {
  assertCurrent: () => void;
  readBase: () => RemoteFavoriteRow[] | null;
  writeBase: (rows: RemoteFavoriteRow[]) => void;
  readLocal: () => RemoteFavoriteRow[];
  writeLocal: (rows: RemoteFavoriteRow[]) => void;
  pull: () => Promise<RemoteFavoriteRow[]>;
  push: (desired: RemoteFavoriteRow[], remote: RemoteFavoriteRow[]) => Promise<void>;
};

/**
 * Local favorites are the durable pending values. Persist the merge before sending its diff;
 * keep the old base on failure so additions/removals survive reloads and partially sent batches.
 * This uses the existing row API, not the separate revisioned /sync/v1 backend.
 */
export async function syncFavoriteRows(ports: FavoriteSyncPorts): Promise<void> {
  ports.assertCurrent();
  const remote = await ports.pull();
  ports.assertCurrent();
  const local = ports.readLocal();
  const desired = mergeFavoriteRows(ports.readBase(), local, remote);
  if (!favoriteRowsEqual(local, desired)) ports.writeLocal(desired);
  ports.assertCurrent();
  await ports.push(desired, remote);
  ports.assertCurrent();
  ports.writeBase(desired);
  // A local edit during the push stays in the local store, different from this base, for retry.
}
