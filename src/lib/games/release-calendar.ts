import type { GameSummary } from "./types";
import type { SavedRelease, SavedReleaseResult } from "./saved-releases";

export type GameCalendarRelease = {
  key: string;
  game: GameSummary;
  release?: SavedRelease;
  source?: "Steam" | "IGDB";
  retained: boolean;
  failed: boolean;
  checked: boolean;
};

const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();

/** Scheduling uses every actual edition/platform record, not the watchlist summary date. */
export function gameReleaseCalendar(games: GameSummary[], results: Record<string, SavedReleaseResult>, year: number, month: number, query = "", platform = "") {
  const start = Date.UTC(year, month, 1), end = Date.UTC(year, month + 1, 1);
  const days = new Map<string, GameCalendarRelease[]>(), windows: GameCalendarRelease[] = [], undated: GameCalendarRelease[] = [];
  const platforms = new Set<string>(), seen = new Set<string>(), search = normalize(query);
  for (const game of games) for (const release of results[game.id]?.info?.releases ?? []) if (release.platform) platforms.add(release.platform);
  const selectedPlatform = platforms.has(platform) ? platform : "";
  let cancelled = 0;
  for (const game of games) {
    const result = results[game.id], info = result?.info;
    if (!normalize(game.name).includes(search)) continue;
    const releases = info?.releases.length ? info.releases : [undefined];
    for (const release of releases) {
      if (selectedPlatform && release?.platform !== selectedPlatform) continue;
      const key = JSON.stringify([game.id, info?.source, release?.label, release?.platform, release?.region]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (release?.cancelled) { cancelled++; continue; }
      const entry: GameCalendarRelease = { key, game, release, source: info?.source, retained: info?.cachedAt !== undefined || !!(info && result?.failed), failed: !!result?.failed, checked: !!result };
      const window = release?.window;
      if (!window) { undated.push(entry); continue; }
      if (window.start >= end || window.end <= start) continue;
      if (window.precision !== "day") { windows.push(entry); continue; }
      const date = new Date(window.start).toISOString().slice(0, 10);
      days.set(date, [...(days.get(date) ?? []), entry]);
    }
  }
  for (const entries of days.values()) entries.sort((a, b) => a.game.name.localeCompare(b.game.name));
  windows.sort((a, b) => a.release!.window!.start - b.release!.window!.start || a.game.name.localeCompare(b.game.name));
  return { days, windows, undated, cancelled, platform: selectedPlatform, platforms: [...platforms].sort((a, b) => a.localeCompare(b)) };
}
