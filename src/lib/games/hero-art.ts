import type { GameDetail } from "./types";

/** CK3's microtrailer ends on a Starter Edition sales collage, unsuitable behind hero copy. */
export function gameHeroPreviewAllowed(steamId: number): boolean {
  return steamId !== 1158310;
}

/** Keep publisher corrections ahead of artwork from an already cached visit. */
export function gameHeroSources(game: Pick<GameDetail, "steamId" | "libraryHero" | "hero">): string[] {
  if (game.steamId === 1158310) return [
    // Original CK3 key art from Paradox's game page, without promotional panels or titles.
    "https://images.ctfassets.net/u73tyf0fa8v1/ILvL75mZNtImSfKerDXnp/3d4edf403c1c502bc7aa5936e94f37a4/Web_Header_2540x13002__1_.webp?fm=webp&q=85&w=1920",
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1158310/library_hero_2x.jpg",
  ];
  return [...new Set([game.libraryHero, game.hero].filter((source): source is string => !!source))];
}
