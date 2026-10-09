/** JSON values only; every writer uses a schema-specific allowlist before reaching this module. */
export type SyncValues = Record<string, unknown>;
export type ProfileDocument = { revision: number; values: SyncValues };
export type SyncConflict = { key: string; local: unknown; remote: unknown };
const own = (o: SyncValues, key: string) => Object.prototype.hasOwnProperty.call(o, key);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
export const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Account wins a collision; untouched records and independent local edits are retained. */
export function mergeProfileValues(
  base: SyncValues | null,
  local: SyncValues,
  remote: SyncValues,
): { values: SyncValues; conflicts: SyncConflict[] } {
  const values: SyncValues = {};
  const conflicts: SyncConflict[] = [];
  for (const key of new Set([
    ...Object.keys(base ?? {}),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])) {
    const localChanged = base === null ? own(local, key) : !sameValue(local[key], base[key]);
    const remoteChanged = base === null ? own(remote, key) : !sameValue(remote[key], base[key]);
    const fromLocal = localChanged && !remoteChanged;
    if (localChanged && remoteChanged && !sameValue(local[key], remote[key])) {
      conflicts.push({ key, local: local[key] ?? null, remote: remote[key] ?? null });
    }
    const source = fromLocal ? local : remote;
    if (own(source, key)) values[key] = source[key];
  }
  return { values, conflicts };
}

export async function syncProfileDocument(ports: {
  assertCurrent: () => void;
  readLocal: () => SyncValues;
  apply: (values: SyncValues, expectedLocal: SyncValues) => void;
  readBase: () => SyncValues | null;
  checkpoint: (values: SyncValues) => void;
  conflicts: (values: SyncConflict[]) => void;
  pull: () => Promise<ProfileDocument>;
  compareAndSwap: (expected: ProfileDocument, values: SyncValues) => Promise<boolean>;
}): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    ports.assertCurrent();
    const remote = await ports.pull();
    ports.assertCurrent();
    const local = ports.readLocal();
    const result = mergeProfileValues(ports.readBase(), local, remote.values);
    if (!sameValue(result.values, remote.values)) {
      if (!(await ports.compareAndSwap(remote, result.values))) continue;
    }
    ports.assertCurrent();
    // Retain the losing value for recovery before applying the winning snapshot.
    if (result.conflicts.length) ports.conflicts(result.conflicts);
    ports.apply(result.values, local);
    ports.checkpoint(result.values);
    return;
  }
  throw new Error("JL profile changed on another device. Your local edits remain queued.");
}
