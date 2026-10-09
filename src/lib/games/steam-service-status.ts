import { safeFetchBytes } from '@/lib/safe-fetch';
export function steamMaintenanceDay(now: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return part('weekday') === 'Tue' ? `${part('year')}-${part('month')}-${part('day')}` : null;
}
export async function checkSteamServices(signal: AbortSignal): Promise<'reachable' | 'unreachable' | 'offline'> {
  if (!navigator.onLine) return 'offline';
  const results = await Promise.allSettled([
    'https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/',
    'https://store.steampowered.com/api/featured/?cc=us&l=english',
  ].map(async url => {
    const response = await safeFetchBytes(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]) }, 8_000, 512_000);
    if (!response.ok) throw Error('Steam unavailable');
    const body = await response.json();
    if (!body || (!Number.isSafeInteger(body.servertime) && !Array.isArray(body.featured_win))) throw Error('Unexpected Steam response');
  }));
  signal.throwIfAborted();
  return results.every(r => r.status === 'fulfilled') ? 'reachable' : 'unreachable';
}
