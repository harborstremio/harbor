import { sourceMatch, type SourceRelease } from './sources';
import { downloadGame, type DownloadGame } from './transfers';
import type { GameSummary } from './types';
import { sourceNeedsPlatformIdentity, sourcePlatformId, sourcePlatformMatches } from './source-platform';
import { sourceDownloadTitle } from './source-title';
export { sourceDownloadTitle } from './source-title';

type Detail = GameSummary & { artwork?: string; logo?: string };
type Providers = {
  search: (title: string, signal: AbortSignal, platform?: string) => Promise<GameSummary[]>;
  detail: (game: GameSummary, signal: AbortSignal) => Promise<Detail | undefined>;
};
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const titleKey = (value: string) => value.replace(/[™®©]/g, '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function uniqueSourceDownloadGame(release: SourceRelease, candidates: readonly GameSummary[]): GameSummary | undefined {
  if (release.kind !== 'game' || release.steamId !== undefined || release.igdbId !== undefined) return;
  const title = sourceDownloadTitle(release.title), normalized = titleKey(title);
  if (normalized.length < 3) return;
  const scoped = candidates.map(game => sourceNeedsPlatformIdentity(release.platform) && positive(game.igdbId) ? { ...game, id: `igdb:${game.igdbId}`, steamId: undefined } : game);
  const exact = scoped.filter(game => titleKey(game.name) === normalized && sourceMatch({ ...release, title: normalized }, { ...game, name: titleKey(game.name) }) === 'title');
  const unique = new Map<string, GameSummary>();
  for (const game of exact) {
    if (!positive(game.steamId) && !positive(game.igdbId)) continue;
    const key = positive(game.steamId) ? `steam:${game.steamId}` : `igdb:${game.igdbId}`;
    const existing = unique.get(key);
    if (existing?.igdbId && game.igdbId && existing.igdbId !== game.igdbId) return;
    unique.set(key, existing ? { ...game, ...existing, igdbId: existing.igdbId ?? game.igdbId } : game);
  }
  return unique.size === 1 ? unique.values().next().value : undefined;
}

/** Lookup is intentionally action-driven; rendering a large source catalog performs no requests. */
export function createSourceDownloadContext(providers: Providers, timeoutMs = 6_000) {
  const cache = new Map<string, { until: number; promise: Promise<DownloadGame | undefined> }>();
  const waiting: (() => void)[] = [];
  let running = 0;
  const acquire = async (signal: AbortSignal) => {
    if (running < 2) { running++; return; }
    if (waiting.length >= 6) throw Error('Context lookup queue is full');
    await new Promise<void>((resolve, reject) => {
      const start = () => { signal.removeEventListener('abort', abort); running++; resolve(); };
      const abort = () => { const at = waiting.indexOf(start); if (at >= 0) waiting.splice(at, 1); reject(signal.reason); };
      waiting.push(start); signal.addEventListener('abort', abort, { once: true });
    });
  };
  const resolve = async (release: SourceRelease, signal: AbortSignal): Promise<DownloadGame | undefined> => {
    if (release.kind !== 'game' || release.title.length > 500 || !release.title.trim()) return;
    if (release.steamId !== undefined && !positive(release.steamId) || release.igdbId !== undefined && !positive(release.igdbId)) return;
    let candidate: GameSummary | undefined;
    if (release.steamId || release.igdbId) candidate = { id: release.steamId ? `steam:${release.steamId}` : `igdb:${release.igdbId}`, steamId: release.steamId, igdbId: release.igdbId, name: release.title, capsule: '', platforms: [] };
    else {
      const title = sourceDownloadTitle(release.title);
      if (titleKey(title).length < 3) return;
      candidate = uniqueSourceDownloadGame(release, await providers.search(title, signal, release.platform));
    }
    signal.throwIfAborted();
    if (!candidate) return;
    // A Steam search identity is fully verifiable through Steam; incidental cross-provider
    // enrichment must not add another mandatory network lookup to opening a download.
    if (candidate.steamId && !release.igdbId) candidate = { ...candidate, igdbId: undefined };
    const detail = await providers.detail(candidate, signal);
    signal.throwIfAborted();
    if (!detail || candidate.steamId && candidate.steamId !== detail.steamId || candidate.igdbId && candidate.igdbId !== detail.igdbId) return;
    // Search responses and details must describe the same exact title; explicit IDs permit publisher renames.
    if (!release.steamId && !release.igdbId && (titleKey(detail.name) !== titleKey(candidate.name) || !sourcePlatformMatches(release.platform, { ...detail, id: candidate.id, steamId: candidate.steamId }))) return;
    return downloadGame({ id: candidate.steamId ? `steam:${candidate.steamId}` : `igdb:${candidate.igdbId}`, name: detail.name, artwork: detail.artwork, logo: detail.logo });
  };
  return async (release: SourceRelease, sourceName: string, supplied?: DownloadGame): Promise<DownloadGame | undefined> => {
    const existing = downloadGame(supplied);
    if (existing && (!sourceNeedsPlatformIdentity(release.platform) || !existing.id.startsWith('steam:') || existing.id === `steam:${release.steamId}`)) return downloadGame({...existing,contentKind:release.kind});
    const key = JSON.stringify([release.kind, release.steamId, release.igdbId, release.title, release.platform]);
    let entry = cache.get(key);
    if (!entry || entry.until <= Date.now()) {
      const controller = new AbortController();
      const work = (async () => {
        await acquire(controller.signal);
        try { return await resolve(release, controller.signal); }
        finally { running--; waiting.shift()?.(); }
      })();
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<undefined>(done => { timer = setTimeout(() => { controller.abort(); done(undefined); }, Math.max(1, timeoutMs)); });
      const promise = Promise.race([work, deadline]).catch(() => undefined).finally(() => clearTimeout(timer));
      entry = { promise, until: Date.now() + 10 * 60_000 }; cache.delete(key); cache.set(key, entry);
      void promise.then(game => { if (!game && cache.get(key)?.promise === promise) cache.get(key)!.until = Date.now() + 30_000; });
      while (cache.size > 96) cache.delete(cache.keys().next().value!);
    }
    const game = await entry.promise;
    return game ? downloadGame({ ...game, sourceName, contentKind:release.kind }) : undefined;
  };
}

export const resolveSourceDownloadContext = createSourceDownloadContext({
  search: async (title, signal, platform) => {
    if (!sourceNeedsPlatformIdentity(platform)) {
      const { searchGames } = await import('./catalog');
      const steam = await searchGames(title);
      signal.throwIfAborted();
      if (steam.some(game => titleKey(game.name) === titleKey(title) && sourcePlatformMatches(platform, game))) return steam;
    }
    const [{ queryIgdb }, { parseAtlasSummary }] = await Promise.all([import('./atlas'), import('./igdb-data')]);
    const term = title.slice(0, 160).replace(/["\\\x00-\x1f]/g, ' ');
    const platformId = sourcePlatformId(platform);
    const rows = await queryIgdb(`search "${term}"; fields name,cover.image_id,screenshots.image_id,platforms.name,external_games.external_game_source,external_games.uid; where game_type = (0,8,9)${platformId ? ` & platforms = (${platformId})` : ''}; limit 30;`, signal, false, true);
    return rows.map(parseAtlasSummary).filter((game): game is GameSummary => !!game);
  },
  detail: async (game, signal) => {
    let atlas: Awaited<ReturnType<typeof import('./atlas')['loadAtlasGame']>> = null;
    if (game.igdbId) {
      const { loadAtlasGame } = await import('./atlas');
      atlas = await loadAtlasGame(game, signal);
      if (!atlas || ![0, 8, 9].includes(atlas.gameType ?? -1)) return;
    }
    if (game.steamId) {
      const { loadGameDetail } = await import('./catalog');
      const detail = await loadGameDetail(game.steamId);
      signal.throwIfAborted();
      return { ...detail, igdbId: atlas?.igdbId ?? detail.igdbId, artwork: detail.libraryHero || detail.hero };
    }
    return atlas ? { ...atlas, artwork: atlas.hero } : undefined;
  },
});
