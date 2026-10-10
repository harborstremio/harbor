const authByBase = new Map<string, string>();
const baseBySourceId = new Map<string, string>();
const knownBases = new Set<string>();

function clean(base: string): string {
  return base.replace(/\/+$/, "");
}

export function registerSuwayomiAuth(base: string, authHeader?: string): void {
  const key = clean(base);
  if (!key) return;
  knownBases.add(key);
  if (authHeader) authByBase.set(key, authHeader);
}

export function clearSuwayomiAuth(base: string): void {
  authByBase.delete(clean(base));
}

export function registerSuwayomiSourceBase(sourceId: string, base: string): void {
  const key = clean(base);
  if (!sourceId || !key) return;
  baseBySourceId.set(sourceId, key);
}

export function suwayomiBaseForSource(sourceId: string): string | undefined {
  return baseBySourceId.get(sourceId);
}

export function soleSuwayomiBase(): string | undefined {
  return knownBases.size === 1 ? [...knownBases][0] : undefined;
}

export function suwayomiAuthFor(url: string): string | undefined {
  if (!url || authByBase.size === 0) return undefined;
  let best: string | undefined;
  let bestLen = -1;
  for (const [base, header] of authByBase) {
    if ((url.startsWith(base + "/") || url === base) && base.length > bestLen) {
      best = header;
      bestLen = base.length;
    }
  }
  return best;
}

export function isSuwayomiServerUrl(url: string): boolean {
  if (!url || knownBases.size === 0) return false;
  for (const base of knownBases) {
    if (url.startsWith(base + "/") || url === base) return true;
  }
  return false;
}
