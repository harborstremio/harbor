import type { AtlasGame } from "./igdb-data";

// Exact IGDB identities, checked against each project's own release page.
// These are editorial starting points, not a live popularity ranking.
export const HACK_SPOTLIGHT_IDS = [141663, 314536, 191278, 42525, 165374, 129819, 138847] as const;
export type HackVideo = { id: string; title: string; creator?: string; gameName: string; gameId: number };
export const HACK_CREATOR_VIDEOS: readonly HackVideo[] = [
  { gameId: 141663, gameName: "Pokémon Unbound", id: "DCO3cJw2lQo", title: "Pokemon Unbound 1 Year Later", creator: "HoodlumCallum" },
  { gameId: 191278, gameName: "B3313", id: "a4FSvdQCYog", title: 'B3313 (Super Mario 64 Internal Plexus) · Part 1', creator: "SimpleClips: Full Streams" },
  { gameId: 314536, gameName: "Pokémon Emerald Seaglass", id: "syTLWoJ_0rE", title: "The Hoenn Saga! | Let's Play Pokémon Emerald Seaglass #01", creator: "OGRagebreak Gaming" },
  { gameId: 42525, gameName: "Super Mario World: Return to Dinosaur Land", id: "kj-FRgXaLzk", title: "Super Mario World: Return to Dinosaur Land · All exits", creator: "xRavenXP" },
];
export function hackVideos(game: AtlasGame): HackVideo[] {
  const creators = HACK_CREATOR_VIDEOS.filter(video => video.gameId === game.igdbId);
  return [...creators, ...(game.videos ?? []).filter(video => !creators.some(item => item.id === video.id)).map(video => ({ ...video, gameId: game.igdbId, gameName: game.name }))];
}
export function hackGameplaySearch(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name.slice(0,180)} ROM hack gameplay`)}`;
}
export function spotlightGames(games: AtlasGame[], baseId?: number): AtlasGame[] {
  return HACK_SPOTLIGHT_IDS.flatMap(id => {
    const game = games.find(game => game.igdbId === id && game.gameType === 5 && (!baseId || game.parent?.igdbId === baseId));
    return game ? [game] : [];
  });
}
export const HACK_COMMUNITIES = [
  { name: "PokéCommunity", url: "https://www.pokecommunity.com/forums/rom-hacks-showcase.184/", system: "Pokémon" },
  { name: "SMW Central", url: "https://www.smwcentral.net/?p=section&s=smwhacks", system: "Super Mario World" },
  { name: "Romhacking.com", url: "https://romhacking.com/", system: "Super Mario 64" },
  { name: "Metroid Construction", url: "https://metroidconstruction.com/hacks.php", system: "Metroid" },
] as const;
