import { EMULATION_SYSTEMS } from './emulation';
import { GAME_PLATFORMS } from './platforms';

const key = (value: string) => value.trim().toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
const platformIds = new Map<string, number>();
for (const platform of [...EMULATION_SYSTEMS, ...GAME_PLATFORMS]) {
  platformIds.set(key(platform.name), platform.id);
  platformIds.set(key(platform.short), platform.id);
}
// Community codes differ from the existing display names for these systems.
for (const [alias, id] of Object.entries({ gc: 21, gb: 33, windows: 6, win: 6, win32: 6, win64: 6, linux: 3, mac: 14, macos: 14, macosx: 14, osx: 14 })) platformIds.set(alias, id);
const desktop = new Set([6, 3, 14]);

export const sourcePlatformId = (platform?: string) => platform ? platformIds.get(key(platform)) : undefined;
export const sourceNeedsPlatformIdentity = (platform?: string) => !!platform?.trim() && !desktop.has(sourcePlatformId(platform) ?? -1);
export type SourcePlatformGame = { id?: string; steamId?: number; platforms?: readonly string[] };

/** Platform evidence constrains title matches; it never overrides an explicit provider identity. */
export function sourcePlatformMatches(platform: string | undefined, game: SourcePlatformGame): boolean {
  if (!platform?.trim()) return true;
  const id = sourcePlatformId(platform);
  // A Steam page/identity describes the PC release, even when a related IGDB row lists ports.
  if (sourceNeedsPlatformIdentity(platform) && (game.steamId || game.id?.startsWith('steam:'))) return false;
  const available = game.platforms ?? [];
  if (id === undefined) return available.some(value => key(value) === key(platform));
  return available.some(value => sourcePlatformId(value) === id);
}
