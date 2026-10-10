import { romFranchises, ROM_CLASSIC_PLATFORM_IDS, ROM_PLATFORMS, type RomFranchise } from "./rom-discovery";
import type { AtlasGame } from "./igdb-data";
import type { HackVideo } from "./hack-editorial";

// Editorial doorway order. Membership always comes from the provider's actual
// relationship IDs, and each destination queries the full classic catalog.
const preferredFranchises = [60, 596, 845, 4];
export function romCollections(games: readonly AtlasGame[]): RomFranchise[] {
  const distinct = [...new Map(games.map(game => [game.igdbId, game])).values()];
  // Prefer the parent franchise over several subseries featuring the same game.
  const groups = romFranchises(distinct.map(game => ({ ...game, series: game.franchises.length ? [] : game.series })));
  const priority = (group: RomFranchise) => group.kind === "franchise" && preferredFranchises.includes(group.id) ? preferredFranchises.indexOf(group.id) : 10;
  const names = new Set<string>(), members = new Set<string>();
  const families: Set<number>[] = [];
  const order = new Map(distinct.map((game,index) => [game.igdbId,index]));
  return groups.sort((a, b) => priority(a) - priority(b) || (order.get(a.games[0].igdbId) ?? 0) - (order.get(b.games[0].igdbId) ?? 0)).filter(group => {
    const name = group.name.toLocaleLowerCase(), key = group.games.map(game => game.igdbId).sort((a, b) => a - b).join(",");
    if (names.has(name) || members.has(key) || families.some(family => group.games.every(game => family.has(game.igdbId)))) return false;
    names.add(name); members.add(key); families.push(new Set(group.games.map(game => game.igdbId))); return true;
  }).map(group => {
    // Crossovers belong to several franchises. Prefer Pokémon Stadium over
    // Smash Bros. as Pokémon's identity when both records are available.
    const normalize = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = normalize(group.name);
    return { ...group, games: [...group.games].sort((a,b) => Number(!normalize(a.name).includes(name)) - Number(!normalize(b.name).includes(name))) };
  });
}

/** Reserve distinct scenes across tiles; image-size variants are the same art. */
export function romCollectionScenes(groups: readonly RomFranchise[]): Map<string, string> {
  const used = new Set<string>(), result = new Map<string, string>();
  for (const group of groups) {
    const scenes = group.games.flatMap(game => [...game.screenshots, game.hero, game.portrait ?? ""]);
    const image = scenes.find(src => src && !used.has(src.replace(/\/t_[^/]+\//, "/")));
    if (image) { used.add(image.replace(/\/t_[^/]+\//, "/")); result.set(`${group.kind}:${group.id}`, image); }
  }
  return result;
}
export function romPreview(game: AtlasGame): HackVideo | undefined {
  const videos = game.videos ?? [];
  const video = videos.find(item => /gameplay|walkthrough|longplay/i.test(item.title)) ?? videos[0];
  return video && { ...video, gameName: game.name, gameId: game.igdbId };
}

export function romConsoleNames(game: AtlasGame, platform?: number): string[] {
  const allowed = platform ? [platform] : ROM_CLASSIC_PLATFORM_IDS;
  const releases = [...(game.releaseHistory ?? [])].filter(release => allowed.includes(release.platform.id)).sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity));
  const ids = releases.length ? releases.map(release => release.platform.id) : game.platformLinks.filter(item => allowed.includes(item.id)).map(item => item.id);
  const fallback = ids.length ? ids : game.platformLinks.map(item => item.id);
  return [...new Set(fallback)].flatMap(id => { const system = ROM_PLATFORMS.find(item => item.id === id); return system ? [system.short] : []; }).slice(0, 3);
}
