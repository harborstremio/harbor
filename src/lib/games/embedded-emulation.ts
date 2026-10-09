import type { Emulator, LocalGame } from './emulation';
const cores: Record<number, string> = { 24: 'mgba', 33: 'gambatte', 22: 'gambatte', 18: 'fceumm', 19: 'snes9x', 29: 'genesis_plus_gx', 64: 'genesis_plus_gx', 35: 'genesis_plus_gx', 4: 'mupen64plus_next' };
export const embeddedCore = (system: number): string | null => cores[system] ?? null;
export function embeddedSystemForPath(path: string): number | null {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
  return ({ gba: 24, gb: 33, gbc: 22, nes: 18, sfc: 19, smc: 19, gen: 29, md: 29, smd: 29, sms: 64, gg: 35, n64: 4, z64: 4, v64: 4 } as Record<string, number>)[extension] ?? null;
}
export type EmbeddedGame = LocalGame & { root: string; sessionId: string; profile: string };
export type EmbeddedRuntime = { installed: boolean; bytes: number; version: string };
export type EmbeddedSession = { id: string; url: string };

/** A configured external player is an explicit user choice, including incomplete setup. */
export function romPlayerMode(game: Pick<LocalGame, 'system' | 'format'>, player?: Emulator): 'external' | 'embedded' | 'setup' {
  if (player) return player.kind === 'retroarch' && !player.corePath ? 'setup' : 'external';
  return embeddedCore(game.system) && game.format.toLowerCase() !== 'fds' ? 'embedded' : 'setup';
}
