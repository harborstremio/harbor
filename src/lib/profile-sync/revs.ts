import { setItemWithRecovery } from "@/lib/storage-recovery";
import { ACCOUNT_KEY, LAST_PULL_KEY, REVS_KEY, SENT_KEY, readJson, removeKey } from "./keys";

type RevMap = Record<string, number>;
type SentMap = Record<string, string>;

/**
 * The hydration gate is in memory and is NEVER persisted. A cold TV must always pull
 * before it is allowed to push, or a second device signing in with an empty local store
 * overwrites the account. publishCollections does exactly that today with no gate, and
 * collections have been push-only ever since.
 */
const hydrated = new Set<string>();

export function isHydrated(key: string): boolean {
  return hydrated.has(key);
}

export function markHydrated(key: string): void {
  hydrated.add(key);
}

export function resetHydration(): void {
  hydrated.clear();
}

export function hydratedCount(): number {
  return hydrated.size;
}

export function readRevs(): RevMap {
  return readJson<RevMap>(REVS_KEY, {});
}

function writeRevs(map: RevMap): void {
  setItemWithRecovery(REVS_KEY, JSON.stringify(map));
}

export function revOf(key: string): number {
  const v = readRevs()[key];
  return typeof v === "number" ? v : 0;
}

export function setRev(key: string, rev: number): void {
  const map = readRevs();
  if (map[key] === rev) return;
  map[key] = rev;
  writeRevs(map);
}

export function forgetRev(key: string): void {
  const map = readRevs();
  if (!(key in map)) return;
  delete map[key];
  writeRevs(map);
}

/**
 * A 32 bit FNV-1a over the serialized section. The push path refuses to send a section
 * whose serialization is byte identical to the last accepted one, which makes the
 * phantom push loop impossible even while readState in profiles.tsx still rewrites
 * avatar and colour on every single read.
 */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function sentHash(key: string): string | null {
  return readJson<SentMap>(SENT_KEY, {})[key] ?? null;
}

export function markSent(key: string, serialized: string): void {
  const map = readJson<SentMap>(SENT_KEY, {});
  const next = hash(serialized);
  if (map[key] === next) return;
  map[key] = next;
  setItemWithRecovery(SENT_KEY, JSON.stringify(map));
}

export function matchesSent(key: string, serialized: string): boolean {
  const known = sentHash(key);
  return known != null && known === hash(serialized);
}

export function boundAccount(): string {
  try {
    return localStorage.getItem(ACCOUNT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function bindAccount(accountId: string): void {
  setItemWithRecovery(ACCOUNT_KEY, accountId);
}

export function lastPullAt(): number {
  try {
    return Number(localStorage.getItem(LAST_PULL_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markPulledNow(): void {
  setItemWithRecovery(LAST_PULL_KEY, String(Date.now()));
}

export function clearRevState(): void {
  resetHydration();
  removeKey(REVS_KEY);
  removeKey(SENT_KEY);
  removeKey(LAST_PULL_KEY);
}
