import assert from "node:assert/strict";
import test from "node:test";
import { hotEvents, hotEventCalendarParts } from "../src/lib/sports/hot-events.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";
const now = Date.UTC(2026, 8, 14);
const side = { id: "1", name: "Team", abbr: "T", logo: "", score: "", winner: false };
const game = (id: string, league = "MLB", extra: Partial<SportsGame> = {}): SportsGame => ({
  id,
  league,
  state: "pre",
  detail: "Scheduled",
  startMs: now + 86400000,
  home: side,
  away: side,
  ...extra,
});
test("highlights exclude completed, expired, far-future and stale live events", () => {
  const result = hotEvents(
    [
      game("next"),
      game("done", "MLB", { state: "post" }),
      game("past", "MLB", { startMs: now - 1 }),
      game("distant", "MLB", { startMs: now + 31 * 86400000 }),
      game("old-live", "NBA", { state: "in", savedAt: now - 1 }),
    ],
    now,
  );
  assert.deepEqual(
    result.map((item) => item.game.id),
    ["next"],
  );
});
test("a fight card is one highlight, and an entire league cannot crowd out other sports", () => {
  const fight = game("main", "UFC", {
    startMs: now + 5 * 86400000,
    context: {
      id: "card",
      name: "UFC 331: Van vs Pantoja 2",
      round: "",
      draw: "",
      venue: "",
      major: false,
    },
    home: { ...side, name: "Joshua Van" },
    away: { ...side, name: "Alexandre Pantoja" },
  });
  const result = hotEvents(
    [
      ...Array.from({ length: 40 }, (_, index) => game(`baseball-${index}`)),
      fight,
      {
        ...fight,
        id: "prelim",
        startMs: fight.startMs - 3600000,
        home: { ...side, name: "Other fighter" },
        away: { ...side, name: "Another fighter" },
      },
      game("race", "F1"),
    ],
    now,
  );
  assert.equal(result.filter((item) => item.game.league === "UFC").length, 1);
  assert.equal(result.find((item) => item.game.league === "UFC")?.game.id, "main");
  assert.ok(result.some((item) => item.game.league === "F1"));
  assert.equal(result.filter((item) => item.group === "baseball").length, 6);
});
test("highlight reasons follow explicit event signals rather than invented popularity", () => {
  const final = game("final", "NBA", {
    context: {
      id: "f",
      name: "Championship final",
      round: "Final",
      draw: "",
      venue: "",
      major: true,
    },
  });
  const results = hotEvents(
    [final, game("followed"), game("ordinary")],
    now,
    (game) => game.id === "followed",
  );
  assert.equal(results[0].reason, "Championship stage");
  assert.equal(results[1].reason, "Your team");
});

test("date-only events remain eligible after their noon anchor until the published day ends", () => {
  const late = new Date(2026, 8, 14, 23).getTime();
  const result = hotEvents(
    [
      game("today", "BOXING", {
        dateOnly: "2026-09-14",
        startMs: new Date(2026, 8, 14, 12).getTime(),
      }),
      game("yesterday", "BOXING", {
        dateOnly: "2026-09-13",
        startMs: new Date(2026, 8, 13, 12).getTime(),
      }),
      game("timed-past", "BOXING", { startMs: late - 1 }),
    ],
    late,
  );
  assert.deepEqual(
    result.map((item) => item.game.id),
    ["today"],
  );
});

test("weekly date labels use the published calendar day, not a converted anchor timestamp", () => {
  const parts = hotEventCalendarParts(
    game("date", "BOXING", { dateOnly: "2026-09-14", startMs: Date.UTC(2026, 8, 13) }),
    "en-US",
  );
  assert.deepEqual(parts, { dateTime: "2026-09-14", day: 14, month: "Sep" });
});
