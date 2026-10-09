import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { steamLibraryLogo } from "./hero-logo-data";

const pool = new GameRequestPool(2);
const cache = new Map<number, { src?: string; at: number }>();

export async function loadSteamHeroLogo(appId: number, signal: AbortSignal): Promise<string | undefined> {
  if (!Number.isSafeInteger(appId) || appId <= 0) return;
  signal.throwIfAborted();
  const held = cache.get(appId);
  if (held && Date.now()-held.at < (held.src ? 86_400_000 : 600_000)) return held.src;
  return pool.run(async () => {
    const response = await safeFetchBytes(`https://api.steamcmd.net/v1/info/${appId}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) }, 10_000, 2*1024*1024);
    if (!response.ok) throw Error("Game logo unavailable");
    const src = steamLibraryLogo(await response.json(), appId);
    signal.throwIfAborted();
    cache.delete(appId); cache.set(appId, { src, at: Date.now() });
    if (cache.size > 128) cache.delete(cache.keys().next().value!);
    return src;
  }, signal);
}
