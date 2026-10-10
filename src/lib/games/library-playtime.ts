import { customPlaytime } from "./custom-library";
import type { UnifiedLibraryGame } from "./unified-library";

export const LIBRARY_PLAYTIME_FILTERS = ["all", "zero", "short", "played", "unknown"] as const;
export type LibraryPlaytimeFilter = typeof LIBRARY_PLAYTIME_FILTERS[number];
export type LibraryPlaytime = { seconds: number; source: "steam" | "harbor" | "adjusted" | "hydra" };

/** A launch date is not a duration. Never borrow another installation's playtime. */
export function libraryPlaytime(game: UnifiedLibraryGame): LibraryPlaytime | undefined {
  let seconds: number, source: LibraryPlaytime["source"];
  if (game.quick?.source === "custom") {
    seconds = customPlaytime(game.quick.custom);
    source = game.quick.custom.playtimeCorrection ? "adjusted" : game.quick.custom.hydra ? "hydra" : "harbor";
  } else if (game.source === "steam" && game.owned) {
    seconds = game.owned.minutes * 60;
    source = "steam";
  } else if (game.quick?.source === "launcher" && game.quick.install.activity?.seconds !== undefined) {
    seconds = game.quick.install.activity.seconds;
    source = "harbor";
  } else return undefined;
  return Number.isSafeInteger(seconds) && seconds >= 0 ? { seconds, source } : undefined;
}

export function matchesLibraryPlaytime(time: LibraryPlaytime | undefined, filter: LibraryPlaytimeFilter = "all") {
  if (filter === "all") return true;
  if (filter === "unknown") return time === undefined;
  if (!time) return false;
  if (filter === "zero") return time.seconds === 0;
  if (filter === "short") return time.seconds < 7200;
  return time.seconds > 0;
}

/** Unknown totals stay last in both directions, rather than masquerading as zero. */
export function compareLibraryPlaytime(a: LibraryPlaytime | undefined, b: LibraryPlaytime | undefined, descending: boolean) {
  if (!a || !b) return Number(!a) - Number(!b);
  return descending ? b.seconds - a.seconds : a.seconds - b.seconds;
}
