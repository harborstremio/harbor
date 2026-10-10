import assert from "node:assert/strict";
import test from "node:test";
import { formatSportsEventDate } from "../src/lib/sports/event-date.ts";
import { matchCardContext } from "../src/lib/sports/card-context.ts";
import { reconcileSportsGames } from "../src/lib/sports/hub-cache.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";
import { dueReminderChannels } from "../src/lib/sports/reminder-state.ts";
import {
  readSportsReminders,
  reminderId,
  saveSportsReminder,
  syncSportsReminders,
} from "../src/lib/sports/reminders.ts";

const game: SportsGame = {
  id: "calendar-event",
  league: "BOXING",
  state: "pre",
  detail: "",
  startMs: new Date(2026, 8, 19, 12).getTime(),
  dateOnly: "2026-09-19",
  home: { id: "", name: "Published event", abbr: "", logo: "", score: "", winner: false },
  away: { id: "", name: "", abbr: "", logo: "", score: "", winner: false },
};

test("date-only events display their published calendar date without the sort-anchor time", () => {
  assert.equal(formatSportsEventDate(game.startMs, "en-US", false, game.dateOnly), "Sat, Sep 19");
  assert.equal(formatSportsEventDate(0, "en-US", true, game.dateOnly), "Sep 19");
  assert.equal(formatSportsEventDate(NaN, "en-US", false, "2028-02-29"), "Tue, Feb 29");
  const oldTimezone = process.env.TZ;
  try {
    for (const timezone of ["Pacific/Kiritimati", "Pacific/Honolulu"]) {
      process.env.TZ = timezone;
      assert.equal(
        formatSportsEventDate(game.startMs, "en-US", false, game.dateOnly),
        "Sat, Sep 19",
      );
    }
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});

test("invalid dates cannot roll over or leak a fabricated noon start time", () => {
  for (const date of [
    "2026-02-29",
    "2026-02-30",
    "2026-13-19",
    "2026-00-19",
    "2026-09-00",
    "2026-9-19",
    "2026-09-19T12:00:00Z",
    "",
    "not a date",
  ]) {
    assert.equal(formatSportsEventDate(game.startMs, "en-US", false, date), "");
  }
  for (const ms of [NaN, Infinity, -Infinity, 9e15, 0]) {
    assert.equal(formatSportsEventDate(ms, "en-US"), "");
  }
});

test("events with a published time retain the existing localized date and time", () => {
  const expected = new Date(game.startMs).toLocaleString("fr-FR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  assert.equal(formatSportsEventDate(game.startMs, "fr-FR"), expected);
});

test("date-only events do not show a kickoff countdown and new time precision refreshes cached rows", () => {
  assert.deepEqual(matchCardContext(game, game.startMs - 60_000), []);
  const timed = { ...game, dateOnly: undefined };
  assert.deepEqual(matchCardContext(timed, game.startMs - 60_000), [
    { kind: "start", value: game.startMs },
  ]);
  assert.equal(reconcileSportsGames([game], [timed])[0], timed);
  assert.equal(reconcileSportsGames([timed], [game])[0], game);
  assert.equal(reconcileSportsGames([game], [{ ...game }])[0], game);
});

test("saved reminders pause without losing settings until a fresh start time is published", () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    const startMs = Date.now() + 15 * 60_000;
    saveSportsReminder({
      id: reminderId(game),
      name: "Calendar event",
      league: game.league,
      startMs,
      leadMinutes: 15,
      channels: ["discord", "telegram"],
      sent: {},
      attempted: {},
      failed: [],
    });
    syncSportsReminders([game]);
    const paused = readSportsReminders()[0];
    assert.equal(paused.awaitingStartTime, true);
    assert.equal(paused.startMs, startMs);
    assert.equal(paused.leadMinutes, 15);
    assert.deepEqual(paused.channels, ["discord", "telegram"]);
    assert.deepEqual(dueReminderChannels(paused, startMs), []);
    const timed = { ...game, dateOnly: undefined, startMs };
    syncSportsReminders([{ ...timed, savedAt: Date.now() - 3_600_000 }]);
    assert.equal(readSportsReminders()[0].awaitingStartTime, true);
    syncSportsReminders([timed]);
    const resumed = readSportsReminders()[0];
    assert.equal(resumed.awaitingStartTime, undefined);
    assert.equal(resumed.startMs, startMs);
    assert.deepEqual(dueReminderChannels(resumed, startMs), ["discord", "telegram"]);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
