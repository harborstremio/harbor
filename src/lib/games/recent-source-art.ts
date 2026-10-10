import { loadGameHighlights, loadGameSearchSuggestions, loadSteamStoreSearch } from "./catalog";
import { sourceNeedsPlatformIdentity, sourcePlatformId } from "./source-platform";
import { createRecentSourceArtCache, recentArtworkKey } from './recent-source-art-cache';
import { matchSourceArtwork, sourceArtworkCandidates, sourceArtworkYear, type SourceGameArtwork } from "./source-display";
import { loadSourcePageData } from "./source-page-identity";
import { sourceDownloadTitle, sourceTitleKey } from "./source-title";
import { sourceUrl, type GameSource, type SourceRelease } from "./sources";
import { sourceListingId } from "./source-listing";
import type { GameSummary } from "./types";

const cache = createRecentSourceArtCache();
export function readRecentSourceArt(release: SourceRelease, source?: GameSource) {
  return cache.get(recentArtworkKey(release, source));
}
export async function loadRecentSourceArt(release: SourceRelease, signal: AbortSignal, source?: GameSource): Promise<SourceGameArtwork | undefined> {
  // A source-page link proves identity only for that source/release.
  signal.throwIfAborted();
  const key = recentArtworkKey(release,source);
  const held = cache.get(key);
  if (held) return held.art;
  let art: SourceGameArtwork | undefined, ambiguous = false;
  let published: ReturnType<typeof loadSourcePageData> | undefined;
  const sourcePage = () => published ??= source ? loadSourcePageData(source, release, signal) : Promise.resolve(undefined);
  const linkedSteamId = async () => (await sourcePage())?.steamId;
  const linkedGame = async (id: number) => (await loadGameHighlights([id])).find(game => game.steamId === id);
  // A failed catalog must not prevent the next provider or the release-page fallback.
  const attempt = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    try { return await work(); } catch { signal.throwIfAborted(); return undefined; }
  };
  const searchSteam = async (title: string, lookupSignal: AbortSignal) => {
    const suggestions = await attempt(() => loadGameSearchSuggestions(title, lookupSignal)) || [];
    const exact = sourceArtworkCandidates(release, title, suggestions);
    if (exact.length === 1 && !sourceArtworkYear(release.title)) return suggestions;
    // Autocomplete omits exact short titles and some adult/region-limited entries.
    const full = await attempt(() => loadSteamStoreSearch(title, "US", 0, lookupSignal));
    return [...new Map([...suggestions, ...(full?.games || [])].map(game => [game.id, game])).values()];
  };
  await attempt(async () => {
    if (release.steamId && !release.igdbId) {
      const game = (await loadGameHighlights([release.steamId])).find(item => item.steamId === release.steamId);
      if (game) art = { game, match: "exact" };
    } else if (!release.igdbId && !sourceNeedsPlatformIdentity(release.platform)) {
      const result = await matchSourceArtwork(release, { search: searchSteam, linkedSteamId, linkedGame }, signal);
      art = result.art; ambiguous = result.ambiguous;
    }
  });
  await attempt(async () => {
    if (!art && !ambiguous && (!release.steamId || release.igdbId)) {
      const [{ queryIgdb }, { parseAtlasSummary }] = await Promise.all([import("./atlas"), import("./igdb-data")]);
      const platform = sourcePlatformId(release.platform);
      const originals = new Map<string, GameSummary>();
      const fields = "fields name,alternative_names.name,first_release_date,cover.image_id,screenshots.image_id,platforms.name,external_games.external_game_source,external_games.uid;";
      const search = async (title: string) => {
        const term = title.slice(0, 160).replace(/["\\\x00-\x1f]/g, " ");
        const query = release.igdbId ? fields + " where id = " + release.igdbId + "; limit 1;" : 'search "' + term + '"; ' + fields + " where game_type = (0,8,9)" + (platform ? " & platforms = (" + platform + ")" : "") + "; limit 20;";
        return (await queryIgdb(query, signal, false, true)).flatMap(row => {
          const game = parseAtlasSummary(row);
          if (!game) return [];
          originals.set(game.id, game);
          if (game.igdbId) originals.set("igdb:" + game.igdbId, game);
          const names = (row as { alternative_names?: { name?: string }[] }).alternative_names;
          const aliases = Array.isArray(names) ? names : [];
          return [{ ...game, name: aliases.some(alias => typeof alias.name === "string" && sourceTitleKey(alias.name) === sourceTitleKey(title)) ? title : game.name }];
        });
      };
      if (release.igdbId) {
        const game = (await search(release.title)).find(item => item.igdbId === release.igdbId);
        if (game) art = { game, match: "exact" };
      } else art = (await matchSourceArtwork(release, { search, linkedSteamId }, signal)).art;
      if (art) {
        const original = originals.get(art.game.id);
        if (original && original.name !== art.game.name) art = {game:{...art.game,name:original.name},match:"artwork"};
      }
      // Retain Steam's actual content flags when IGDB links to a Steam record.
      if (art?.game.steamId) {
        const verified = (await loadGameHighlights([art.game.steamId])).find(item => item.steamId === art?.game.steamId);
        if (verified) art = { ...art, game: { ...art.game, adultContent: verified.adultContent } };
      }
    }
  });
  signal.throwIfAborted();
  if (art && release.steamId && release.steamId !== art.game.steamId) art = undefined;
  if (art && release.igdbId) art = { ...art, game: { ...art.game, id: "igdb:" + release.igdbId, steamId: undefined } };
  if (!art && source && release.kind === "game" && !release.steamId && !release.igdbId) {
    const retro = sourceNeedsPlatformIdentity(release.platform) ? await attempt(async () => {
      const { loadSourceRomArtwork } = await import("./source-rom-artwork");
      return loadSourceRomArtwork(release, signal);
    }) : undefined;
    const page = retro ? undefined : await attempt(sourcePage);
    signal.throwIfAborted();
    const url = page?.page || sourceUrl(release.sourcePage) || sourceUrl(source.homepage) || sourceUrl(source.url);
    if (url) art = { match: "artwork", game: {
      id: await sourceListingId(source.id, url, release.title), name: sourceDownloadTitle(release.title), capsule: retro || page?.portrait || "", portrait: retro || page?.portrait,
      platforms: release.platform ? [release.platform] : [],
      sourceListing: { page: url, sourceName: source.name, description: page?.description || "", screenshots: page?.screenshots || [] },
    } };
  }
  signal.throwIfAborted();
  cache.remember(key, art);
  return art;
}
