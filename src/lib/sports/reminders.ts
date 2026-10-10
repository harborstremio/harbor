import { useSyncExternalStore } from "react";
import type { SportsGame } from "./espn-types";
import type { SportsReminder } from "./reminder-state";
export type { SportsReminder } from "./reminder-state";
const KEY = "harbor.sports.reminders.v1";
const subscribers = new Set<() => void>();
function read(): SportsReminder[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(values)
      ? values
          .filter(
            (entry): entry is SportsReminder =>
              entry &&
              typeof entry.id === "string" &&
              typeof entry.name === "string" &&
              Number.isFinite(entry.startMs) &&
              Number.isFinite(entry.leadMinutes) &&
              Array.isArray(entry.channels) &&
              entry.channels.every((c: unknown) => c === "discord" || c === "telegram") &&
              entry.sent &&
              entry.attempted &&
              Array.isArray(entry.failed) &&
              (entry.awaitingStartTime === true || entry.startMs > Date.now() - 7 * 86400_000),
          )
          .slice(-200)
      : [];
  } catch {
    return [];
  }
}
let cache = read();
function emit() {
  for (const fn of subscribers) fn();
}
export function reminderId(game: SportsGame) {
  return `${game.source || "espn"}:${game.league}:${game.context?.id || game.id}`;
}
export function readSportsReminders() {
  return read();
}
export function saveSportsReminder(entry: SportsReminder | null, id = entry?.id): boolean {
  if (!id) return false;
  const next = read().filter((item) => item.id !== id);
  if (entry) next.push(entry);
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(-200)));
    cache = next.slice(-200);
    emit();
    return true;
  } catch {
    return false;
  }
}
function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) {
      cache = read();
      emit();
    }
  });
export function useSportsReminders() {
  return useSyncExternalStore(subscribe, () => cache);
}
export function syncSportsReminders(games: SportsGame[]) {
  for (const reminder of read()) {
    const game = games.find((game) => reminderId(game) === reminder.id);
    if (!game || game.state !== "pre") continue;
    if (game.dateOnly !== undefined) {
      if (!reminder.awaitingStartTime) saveSportsReminder({ ...reminder, awaitingStartTime: true });
      continue;
    }
    if (game.savedAt !== undefined || !Number.isFinite(game.startMs) || game.startMs <= 0) continue;
    if (reminder.awaitingStartTime || game.startMs !== reminder.startMs)
      saveSportsReminder({
        ...reminder,
        startMs: game.startMs,
        awaitingStartTime: undefined,
        sent: {},
        attempted: {},
        failed: [],
      });
  }
}
