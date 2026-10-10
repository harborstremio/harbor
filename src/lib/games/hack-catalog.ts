import { ROM_HACK_PLATFORMS, type AtlasGame } from './igdb-data';

/** Console association alone also includes unofficial ports of unrelated PC games. */
export function isRomHack(game: AtlasGame): boolean {
  if (game.gameType !== 5 || !game.parent) return false;
  if (!game.platformLinks.some(p => (ROM_HACK_PLATFORMS as readonly number[]).includes(p.id))) return false;
  return !/\b(?:unofficial|homebrew|fan[- ]made)\s+port\b|\bport (?:of .{0,80} )?for (?:the )?(?:psp|playstation|wii|game boy)\b/i.test(game.description);
}

export type HackRelease = { page: string; download?: string; method: 'patch' | 'modpack'; base?: string };
// Creator release pages, never pre-patched game mirrors. Hosted files are resolved on demand.
export const HACK_RELEASES: Readonly<Record<number, HackRelease>> = {
  141663: { page: 'https://www.pokecommunity.com/threads/pok%C3%A9mon-unbound-completed.382178/', download: 'https://www.mediafire.com/file/1utikbeymc5b2by/Pokemon_Unbound_Official_Patch_2.1.1%252B.zip/file', method: 'patch', base: 'Pokémon FireRed (USA, v1.0)' },
  314536: { page: 'https://ko-fi.com/s/4a1535f351', method: 'patch', base: 'Pokémon Emerald (USA)' },
};

export function hackRelease(game: { igdbId?: number; name: string; projectUrl?: string; links?: {url:string}[] }): HackRelease | undefined {
  if (game.igdbId && HACK_RELEASES[game.igdbId]) return HACK_RELEASES[game.igdbId];
  // These projects distribute SD/Dolphin packs, not BPS/IPS/UPS patches.
  if (/^Project\+$/.test(game.name)) return { page: 'https://projectplusgame.com/download/', method: 'modpack', base: 'Super Smash Bros. Brawl (NTSC-U)' };
  if (/^Project M$/.test(game.name)) return { page: 'https://pmunofficial.com/en/download/', method: 'modpack', base: 'Super Smash Bros. Brawl (NTSC-U)' };
  // The creator distributes an 811MB patcher bundle, not a BPS/IPS/UPS file.
  if (game.name === 'Sonic Riders Enhanced') return { page: 'https://sonicfangameshq.com/forums/showcase/sonic-riders-enhanced-version-1-0.3193/', download: 'https://drive.google.com/file/d/1lFnxUqnJUl-bDxEqZd2UyhljoFKJcx8t/view', method: 'modpack', base: 'Sonic Riders (GameCube)' };
  const page = game.projectUrl || game.links?.find(link => {
    try { const url = new URL(link.url); return url.protocol === 'https:' && !url.username && !url.password && (
      url.hostname === 'github.com' && /^\/[^/]+\/[^/]+(?:\/releases(?:\/.*)?)?\/?$/.test(url.pathname) ||
      ['www.pokecommunity.com','pokecommunity.com','sonicfangameshq.com','www.smwcentral.net','smwcentral.net','metroidconstruction.com','romhacking.com','gamebanana.com'].includes(url.hostname));
    } catch { return false; }
  })?.url;
  return page ? { page, method: 'patch' } : undefined;
}
