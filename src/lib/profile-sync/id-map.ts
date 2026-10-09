import { setItemWithRecovery } from "@/lib/storage-recovery";
import { IDMAP_KEY, readJson, removeKey } from "./keys";

type IdMap = Record<string, string>;

/**
 * Profile.id is minted per device by newId() in profiles.tsx and namespaces roughly
 * fifteen localStorage keys, so two devices can never agree on it and re-issuing it
 * would mean migrating every one of those keys at once. syncId is a second, additive
 * identity that only this map and the wire ever see. Local ids stay local forever.
 */
export function readIdMap(): IdMap {
  return readJson<IdMap>(IDMAP_KEY, {});
}

function write(map: IdMap): void {
  setItemWithRecovery(IDMAP_KEY, JSON.stringify(map));
}

export function syncIdFor(localId: string): string | null {
  return readIdMap()[localId] ?? null;
}

export function localIdFor(syncId: string): string | null {
  for (const [local, remote] of Object.entries(readIdMap())) {
    if (remote === syncId) return local;
  }
  return null;
}

export function setMapping(localId: string, syncId: string): void {
  const map = readIdMap();
  if (map[localId] === syncId) return;
  map[localId] = syncId;
  write(map);
}

export function setMappings(pairs: Record<string, string>): void {
  const map = readIdMap();
  let changed = false;
  for (const [localId, syncId] of Object.entries(pairs)) {
    if (map[localId] === syncId) continue;
    map[localId] = syncId;
    changed = true;
  }
  if (changed) write(map);
}

export function dropLocalMapping(localId: string): void {
  const map = readIdMap();
  if (!(localId in map)) return;
  delete map[localId];
  write(map);
}

export function knownSyncIds(): string[] {
  return [...new Set(Object.values(readIdMap()))];
}

export function clearIdMap(): void {
  removeKey(IDMAP_KEY);
}
