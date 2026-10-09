import { setItemWithRecovery } from "@/lib/storage-recovery";
import { PARKED_PREFIX, readJson, removeKey } from "./keys";
import { docKey, parseDocKey } from "./sections";
import type { SectionKey } from "./types";

export type ParkedWrite = {
  key: string;
  section: SectionKey;
  value: unknown;
  parkedAt: number;
  lostToRev: number;
};

/**
 * A rejected write loses to the online device, which is deliberate: clock skew on cheap
 * TV hardware is real, and two orderings cannot be merged into a third one either person
 * chose. The loser is parked locally instead of destroyed, so the user can re-push it
 * once. Parked values are LOCAL ONLY and are never uploaded by the normal push path.
 */
export function park(key: string, value: unknown, lostToRev: number): void {
  setItemWithRecovery(
    PARKED_PREFIX + key,
    JSON.stringify({ value, parkedAt: Date.now(), lostToRev }),
  );
}

export function readParked(key: string): ParkedWrite | null {
  const parsed = parseDocKey(key);
  if (!parsed) return null;
  const raw = readJson<{ value?: unknown; parkedAt?: number; lostToRev?: number } | null>(
    PARKED_PREFIX + key,
    null,
  );
  if (!raw || !("value" in raw)) return null;
  return {
    key,
    section: parsed.section,
    value: raw.value,
    parkedAt: typeof raw.parkedAt === "number" ? raw.parkedAt : 0,
    lostToRev: typeof raw.lostToRev === "number" ? raw.lostToRev : 0,
  };
}

export function clearParked(key: string): void {
  removeKey(PARKED_PREFIX + key);
}

export function parkedForSection(section: SectionKey, syncId: string): ParkedWrite | null {
  return readParked(docKey(section, syncId));
}

export function allParked(): ParkedWrite[] {
  const out: ParkedWrite[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PARKED_PREFIX)) continue;
      const entry = readParked(k.slice(PARKED_PREFIX.length));
      if (entry) out.push(entry);
    }
  } catch {
    return out;
  }
  return out;
}

export function clearAllParked(): void {
  const doomed: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PARKED_PREFIX)) doomed.push(k);
    }
  } catch {
    return;
  }
  for (const k of doomed) removeKey(k);
}
