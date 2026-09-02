const FAIL_LIMIT = 3;
const COOLDOWN_MS = 10 * 60 * 1000;

type HostState = { fails: number; downUntil: number };

const hosts = new Map<string, HostState>();

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, location.href).host;
  } catch {
    return null;
  }
}

function state(host: string): HostState {
  const found = hosts.get(host);
  if (found) return found;
  const fresh: HostState = { fails: 0, downUntil: 0 };
  hosts.set(host, fresh);
  return fresh;
}

export function noteArtFailure(url: string | undefined): void {
  const host = hostOf(url);
  if (!host) return;
  const s = state(host);
  s.fails += 1;
  if (s.fails >= FAIL_LIMIT) s.downUntil = Date.now() + COOLDOWN_MS;
}

export function noteArtSuccess(url: string | undefined): void {
  const host = hostOf(url);
  if (!host) return;
  const s = state(host);
  s.fails = 0;
  s.downUntil = 0;
}

export function isArtHostDown(url: string | undefined): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const s = hosts.get(host);
  return !!s && s.downUntil > Date.now();
}

export function artHostReport(): Record<string, { fails: number; down: boolean }> {
  const now = Date.now();
  const out: Record<string, { fails: number; down: boolean }> = {};
  for (const [host, s] of hosts) out[host] = { fails: s.fails, down: s.downUntil > now };
  return out;
}
