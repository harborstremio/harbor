import { atlasQuery, ATLAS_PAGE_SIZE, DEFAULT_ATLAS_FILTERS, parseAtlasGame } from "./igdb-data";
import { isRomHack } from "./hack-catalog";
import { hackVideos } from "./hack-editorial";

export function hackVideoQuery(offset = 0, baseId?: number) {
  if (baseId !== undefined && (!Number.isSafeInteger(baseId) || baseId <= 0)) throw Error("Invalid original game");
  const baseGame = baseId ? { id: `igdb:${baseId}`, igdbId: baseId, name: "", capsule: "", platforms: [] } : undefined;
  return atlasQuery({ kind: "romhacks", name: "", baseGame }, DEFAULT_ATLAS_FILTERS, offset).replace("where ", "where videos != null & ");
}
export function hackVideoPage(rows: unknown[], offset: number, baseId?: number) {
  const games = rows.map(parseAtlasGame).filter(game => isRomHack(game) && (!baseId || game.parent?.igdbId === baseId));
  const byGame = games.map(game => hackVideos(game).filter(video => /^[\w-]{11}$/.test(video.id)));
  // Show different projects first, then their additional footage.
  const videos = [];
  for (let i = 0; i < Math.max(0, ...byGame.map(clips => clips.length)); i++) for (const clips of byGame) if (clips[i]) videos.push(clips[i]);
  return { games: [...new Map(videos.map(video => [video.id, video])).values()], nextOffset: rows.length === ATLAS_PAGE_SIZE ? offset + ATLAS_PAGE_SIZE : null };
}
