import type { PlayerSrc } from "../view";

export function playerLoadIdentity(src: PlayerSrc, url: string, season?: number, episode?: number) {
  return JSON.stringify([
    url,
    src.meta.id,
    season,
    episode,
    src.attempt ?? 0,
    Object.entries(src.headers ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}
