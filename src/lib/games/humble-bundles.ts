import { safeFetchBytes } from '@/lib/safe-fetch';
import { GameRequestPool } from './request-pool';
import { humbleBundlePaths, parseHumbleBundle, type HumbleBundle } from './humble-bundle-data';
const pool = new GameRequestPool(2);
let cached: { at: number; bundles: HumbleBundle[]; partial: boolean } | undefined;
let pending: Promise<NonNullable<typeof cached>> | undefined;
async function page(path: string) {
  const response = await safeFetchBytes(`https://www.humblebundle.com${path}`, { signal: AbortSignal.timeout(15_000) }, 15_000, 4_000_000);
  if (!response.ok) throw Error(`Humble ${response.status}`);
  return response.text();
}
export function loadHumbleBundles() {
  if (cached && Date.now() - cached.at < 30 * 60_000) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const paths = humbleBundlePaths(await page('/bundles'));
    const result = await Promise.allSettled(paths.map(path => pool.run(async () => parseHumbleBundle(await page(path), path))));
    if (paths.length && result.every(r => r.status === 'rejected')) throw Error('Bundle contents unavailable');
    return cached = { at: Date.now(), bundles: result.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []), partial: result.some(r => r.status === 'rejected') };
  })().finally(() => { pending = undefined; });
  return pending;
}
