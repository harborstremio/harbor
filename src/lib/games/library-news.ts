import type { GameNews } from "./community";
import type { GameSummary } from "./types";
import type { UnifiedLibraryGame } from "./unified-library";

export const LIBRARY_NEWS_BATCH = 12;
export const LIBRARY_NEWS_WINDOW = 90 * 86400_000;
export type LibraryNewsFeed = { game: GameSummary; items: GameNews[]; unavailable: boolean };
export type LibraryNewsItem = GameNews & { game: GameSummary; unavailable: boolean; key: string };

/** A library match is authority; similar names and store search results are not. */
export function libraryNewsGames(items: UnifiedLibraryGame[]): GameSummary[] {
  const seen = new Set<number>();
  return [...items].filter(item => !item.hidden && item.game && Number.isSafeInteger(item.game.steamId)
    && item.game.steamId! > 0 && item.game.steamId! <= 0xffffffff)
    .sort((a,b) => Number(b.favorite)-Number(a.favorite) || b.lastPlayed-a.lastPlayed || a.id.localeCompare(b.id))
    .flatMap(item => {
      const game = item.game!;
      if (seen.has(game.steamId!)) return [];
      seen.add(game.steamId!);
      return [game];
    });
}

/** One failed feed cannot erase successful feeds, or masquerade as a quiet week. */
export function mergeLibraryNews(games: GameSummary[], results: PromiseSettledResult<GameNews[]>[], previous: LibraryNewsFeed[] = []): LibraryNewsFeed[] {
  return games.map((game,index) => {
    const result = results[index];
    return { game, unavailable: result?.status !== "fulfilled", items: result?.status === "fulfilled"
      ? result.value : previous.find(feed => feed.game.steamId === game.steamId)?.items ?? [] };
  });
}

export function libraryNewsItems(feeds: LibraryNewsFeed[], now = Date.now()): LibraryNewsItem[] {
  const seen = new Set<string>();
  return feeds.flatMap(feed => [...feed.items].sort((a,b) => b.date-a.date).filter(item => {
    const key = `${feed.game.steamId}:${item.id}`;
    if (seen.has(key) || !Number.isSafeInteger(item.date) || item.date * 1000 < now-LIBRARY_NEWS_WINDOW || item.date * 1000 > now+300_000) return false;
    seen.add(key);
    return true;
  }).slice(0,1).map(item => ({...item,game:feed.game,unavailable:feed.unavailable,key:`${feed.game.steamId}:${item.id}`})))
    .sort((a,b) => b.date-a.date || a.key.localeCompare(b.key));
}

const preferenceKey = (profile:string) => `harbor:game-library-news:${profile}`;
export function libraryNewsCollapsed(profile:string): boolean {
  try { return localStorage.getItem(preferenceKey(profile)) === "collapsed"; } catch { return false; }
}
export function saveLibraryNewsCollapsed(profile:string, collapsed:boolean) {
  try { localStorage.setItem(preferenceKey(profile),collapsed?"collapsed":"expanded"); } catch { /* The current view remains usable without preference storage. */ }
}
