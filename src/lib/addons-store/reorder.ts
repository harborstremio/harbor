import { getUserAddonsRaw, setUserAddonsRaw, type Addon } from "@/lib/addons";

const BACKUP_KEY = "harbor.addonOrderBackups";
const ORDER_KEY = "harbor.addonOrder";
const MAX_BACKUPS = 5;

export type ReorderInvalid = "empty" | "length" | "null-item" | "url-multiset" | "item-identity";

export type AddonOrderBackup = { at: number; urls: string[]; names: string[]; items?: Addon[] };

export type SaveStep = "checking" | "saving" | "verifying";

export type SaveResult =
  | { ok: true; items: Addon[] }
  | { ok: false; stage: "validate"; reason: ReorderInvalid }
  | { ok: false; stage: "fetch" }
  | { ok: false; stage: "stale"; current: Addon[] }
  | { ok: false; stage: "write" }
  | { ok: false; stage: "verify"; current: Addon[] | null };

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function urlCountsMatch(a: Array<{ transportUrl: string }>, b: Array<{ transportUrl: string }>): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const item of a) counts.set(item.transportUrl, (counts.get(item.transportUrl) ?? 0) + 1);
  for (const item of b) {
    const c = counts.get(item.transportUrl) ?? 0;
    if (c === 0) return false;
    counts.set(item.transportUrl, c - 1);
  }
  return true;
}

function bijectiveItemMatch(a: Addon[], b: Addon[]): boolean {
  if (a.length !== b.length) return false;
  const aJson = a.map((x) => JSON.stringify(x));
  const used = new Array<boolean>(a.length).fill(false);
  for (const item of b) {
    const json = JSON.stringify(item);
    let matched = false;
    for (let i = 0; i < a.length; i++) {
      if (used[i]) continue;
      if (a[i] === item || aJson[i] === json) {
        used[i] = true;
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

export function validateReorder(
  original: Addon[],
  next: Addon[],
): { ok: true } | { ok: false; reason: ReorderInvalid } {
  if (!Array.isArray(original) || original.length === 0) return { ok: false, reason: "empty" };
  if (!Array.isArray(next) || next.length !== original.length) return { ok: false, reason: "length" };
  for (const item of next) {
    if (!item || typeof item !== "object" || typeof item.transportUrl !== "string" || !item.transportUrl) {
      return { ok: false, reason: "null-item" };
    }
  }
  if (!urlCountsMatch(original, next)) return { ok: false, reason: "url-multiset" };
  if (!bijectiveItemMatch(original, next)) return { ok: false, reason: "item-identity" };
  return { ok: true };
}

export function collectionDrifted(baseline: Addon[], fresh: Addon[]): boolean {
  return !bijectiveItemMatch(baseline, fresh);
}

export function sequencesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function applyOrderToItems<T extends { transportUrl: string }>(items: T[], urls: string[]): T[] {
  const used = new Array<boolean>(items.length).fill(false);
  const out: T[] = [];
  for (const url of urls) {
    const idx = items.findIndex((item, i) => !used[i] && item.transportUrl === url);
    if (idx === -1) continue;
    used[idx] = true;
    out.push(items[idx]);
  }
  items.forEach((item, i) => {
    if (!used[i]) out.push(item);
  });
  return out;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (from < 0 || from >= list.length || from === target) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

export function loadBackups(): AddonOrderBackup[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is AddonOrderBackup =>
        b != null &&
        typeof b === "object" &&
        typeof (b as AddonOrderBackup).at === "number" &&
        Array.isArray((b as AddonOrderBackup).urls) &&
        Array.isArray((b as AddonOrderBackup).names),
    );
  } catch {
    return [];
  }
}

export function pushBackup(items: Addon[]): void {
  let clone: Addon[] | undefined;
  try {
    clone = JSON.parse(JSON.stringify(items)) as Addon[];
  } catch {
    clone = undefined;
  }
  const snapshot: AddonOrderBackup = {
    at: Date.now(),
    urls: items.map((i) => i.transportUrl),
    names: items.map((i) => i.manifest?.name ?? hostOf(i.transportUrl)),
    items: clone,
  };
  const slim: AddonOrderBackup = { ...snapshot, items: undefined };
  const attempts = [
    [snapshot, ...loadBackups()].slice(0, MAX_BACKUPS),
    [slim, ...loadBackups()].slice(0, MAX_BACKUPS),
    [slim],
  ];
  for (const list of attempts) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(list));
      return;
    } catch {
      continue;
    }
  }
  console.warn("[addons] couldn't persist addon order backup");
}

export function saveDisplayOrder(urls: string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(urls));
  } catch (e) {
    console.warn("[addons] couldn't persist addon display order", e);
  }
}

export function loadDisplayOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === "string");
  } catch {
    return [];
  }
}

export async function saveCollectionOrder(
  authKey: string,
  baseline: Addon[],
  next: Addon[],
  alreadyBackedUp: boolean,
  onStep?: (step: SaveStep) => void,
): Promise<SaveResult> {
  onStep?.("checking");
  const valid = validateReorder(baseline, next);
  if (!valid.ok) return { ok: false, stage: "validate", reason: valid.reason };
  const fresh = await getUserAddonsRaw(authKey);
  if (fresh == null) return { ok: false, stage: "fetch" };
  if (collectionDrifted(baseline, fresh)) return { ok: false, stage: "stale", current: fresh };
  if (!alreadyBackedUp) pushBackup(baseline);
  onStep?.("saving");
  const wrote = await setUserAddonsRaw(authKey, next);
  if (!wrote) return { ok: false, stage: "write" };
  onStep?.("verifying");
  const readBack = await getUserAddonsRaw(authKey);
  if (readBack == null) return { ok: false, stage: "verify", current: null };
  if (
    !sequencesEqual(
      readBack.map((a) => a.transportUrl),
      next.map((a) => a.transportUrl),
    )
  ) {
    return { ok: false, stage: "verify", current: readBack };
  }
  return { ok: true, items: readBack };
}
