/** A complete local roster belongs to one JL account. Profile data stays under its original IDs. */
export const WORKSPACE_OWNER = "jl.account.workspace.owner.v1";
const PREFIX = "jl.account.workspace.v1.";
const KEYS = [
  "harbor.profiles.v1", "harbor.settings.shared", "harbor.settings",
  // Old install-wide blobs must not be re-imported into the next account's primary profile.
  "harbor.auth", "harbor.installed-addons", "harbor.addons.disabled", "harbor.addonOrder", "harbor.addonOrderBackups",
  "harbor.watchlist.v1", "harbor.watchlist.aggregate.v1", "harbor.localcw.v1",
  "harbor.playback-history.v1", "harbor.watchevents.v1",
] as const;
type Port = Pick<Storage, "getItem" | "setItem" | "removeItem" | "length" | "key">;
type Snapshot = Record<(typeof KEYS)[number], string | null>;

function capture(storage: Port): Snapshot {
  return Object.fromEntries(KEYS.map((key) => [key, storage.getItem(key)])) as Snapshot;
}
function restore(storage: Port, snapshot: Snapshot): void {
  for (const key of KEYS) {
    const value = snapshot[key];
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }
}
function empty(): Snapshot {
  return { ...Object.fromEntries(KEYS.map((key) => [key, null])), "harbor.settings.shared": "{}", "harbor.settings": "{}" } as Snapshot;
}
function parse(raw: string | null): Snapshot | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as Snapshot;
  if (!value || !KEYS.every((key) => value[key] === null || typeof value[key] === "string")) {
    throw new Error("JL account workspace is damaged. The existing data has been preserved.");
  }
  return value;
}

/** Called before publishing a new identity. Failure refuses the switch instead of mixing data. */
export function switchJlWorkspace(storage: Port, previousUser: string | null, nextUser: string | null): boolean {
  const oldOwner = storage.getItem(WORKSPACE_OWNER);
  const next = nextUser ?? "local";
  // The first JL sign-in adopts this device's existing local data once. Signing out
  // gets an empty local workspace, not a second copy of that account's private data.
  const knownOwners = new Set<string>();
  const keyOwner = storage.getItem("jl.account.keys.owner.v1");
  if (keyOwner) knownOwners.add(keyOwner);
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("jl.account.keys.base.v1.")) knownOwners.add(key.slice("jl.account.keys.base.v1.".length));
    if (key?.startsWith("jl.account.link.v2.")) {
      try { const link = JSON.parse(storage.getItem(key) ?? "null"); if (typeof link?.accountId === "string") knownOwners.add(link.accountId); } catch { /* Never infer ownership from damaged data. */ }
    }
  }
  const inferred = knownOwners.size === 1 ? [...knownOwners][0] : knownOwners.size > 1 ? "unclaimed" : "local";
  const previous = oldOwner ?? previousUser ?? inferred;
  if (previous === next) {
    if (oldOwner === null && previous !== "local") storage.setItem(WORKSPACE_OWNER, next);
    return false;
  }
  const current = capture(storage);
  const firstAdoption = !oldOwner && !previousUser && !!nextUser && knownOwners.size === 0;
  const target = firstAdoption ? current : parse(storage.getItem(PREFIX + next)) ?? empty();
  storage.setItem(PREFIX + previous, JSON.stringify(firstAdoption ? empty() : current));
  try {
    restore(storage, target);
    storage.setItem(WORKSPACE_OWNER, next);
  } catch (error) {
    restore(storage, current);
    if (oldOwner === null) storage.removeItem(WORKSPACE_OWNER);
    else storage.setItem(WORKSPACE_OWNER, oldOwner);
    throw error;
  }
  return true;
}

/** Restore the prior active workspace if publishing the corresponding session fails. */
export function stageJlWorkspace(storage: Port, previous: string | null, next: string | null): () => void {
  const snapshot = capture(storage);
  const owner = storage.getItem(WORKSPACE_OWNER);
  switchJlWorkspace(storage, previous, next);
  return () => {
    restore(storage, snapshot);
    if (owner === null) storage.removeItem(WORKSPACE_OWNER);
    else storage.setItem(WORKSPACE_OWNER, owner);
  };
}
