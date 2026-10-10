import test from "node:test";
import assert from "node:assert/strict";
import { gameReleaseCalendar } from "../src/lib/games/release-calendar.ts";
import { releaseWindow, steamSavedRelease, type SavedReleaseInfo } from "../src/lib/games/saved-releases.ts";
const game = (id: string, name = id) => ({ id, name, capsule: "", platforms: ["PC"] });
const release = (label: string, platform = "PC", region = "Worldwide", cancelled = false) => ({ label, platform, region, cancelled, window: releaseWindow(label) });
const info = (...releases: ReturnType<typeof release>[]): SavedReleaseInfo => ({ source: "IGDB", releases });

test("calendar keeps a weekend date and exact platform/region records without shifting to Monday", () => {
  const g = game("igdb:1");
  const data = info(release("Oct 3, 2026"), release("Oct 3, 2026", "Switch", "Japan"), release("Oct 11, 2026", "PC", "Europe"));
  const view = gameReleaseCalendar([g], { [g.id]: { info: data, failed: false } }, 2026, 9);
  assert.deepEqual([...view.days.keys()], ["2026-10-03", "2026-10-11"]);
  assert.equal(view.days.get("2026-10-03")!.length, 2);
  assert.equal(view.days.get("2026-10-03")![1].release!.region, "Japan");
});
test("all overlapping release windows remain approximate across month and year boundaries", () => {
  const g = game("igdb:2"), data = { [g.id]: { info: info(release("Q4 2026"), release("2026"), release("November 2026")), failed: false } };
  for (const month of [9, 10, 11]) {
    const view = gameReleaseCalendar([g], data, 2026, month);
    assert.equal(view.days.size, 0);
    assert.deepEqual(view.windows.map(entry => entry.release!.label).sort(), (month === 10 ? ["2026", "November 2026", "Q4 2026"] : ["2026", "Q4 2026"]));
  }
  assert.equal(gameReleaseCalendar([g], data, 2027, 0).windows.length, 0);
});
test("calendar deduplicates identical records, never same-title editions or platforms", () => {
  const a = game("steam:3", "Same title"), b = game("igdb:3", "Same title");
  const data = { [a.id]: { info: info(release("Oct 4, 2026"), release("Oct 4, 2026")), failed: false }, [b.id]: { info: info(release("Oct 4, 2026", "SNES")), failed: false } };
  const entries = gameReleaseCalendar([a, b], data, 2026, 9).days.get("2026-10-04")!;
  assert.deepEqual(entries.map(entry => entry.game.id), [a.id, b.id]);
  assert.equal(new Set(entries.map(entry => entry.key)).size, 2);
});
test("cancelled ports are absent from dates and TBA; failed and unchecked entries stay distinguishable", () => {
  const games = [game("igdb:4"), game("igdb:5"), game("steam:6"), game("steam:7")];
  const data = { "igdb:4": { info: info(release("Oct 4, 2026", "PC", "Worldwide", true)), failed: false }, "igdb:5": { info: info(release("TBD")), failed: false }, "steam:6": { failed: true } };
  const view = gameReleaseCalendar(games, data, 2026, 9);
  assert.equal(view.days.size, 0); assert.equal(view.cancelled, 1);
  assert.deepEqual(view.undated.map(entry => [entry.game.id, entry.checked, entry.failed]), [["igdb:5", true, false], ["steam:6", true, true], ["steam:7", false, false]]);
});
test("failed refresh preserves the previous date and its saved-information marker", () => {
  const g = game("steam:8"), record = steamSavedRelease("Oct 5, 2026", true);
  const view = gameReleaseCalendar([g], { [g.id]: { info: record, failed: true } }, 2026, 9);
  const entry = view.days.get("2026-10-05")![0];
  assert.equal(entry.retained, true); assert.equal(entry.source, "Steam"); assert.equal(entry.release!.region, "US");
});
test("search and platform filters apply to actual release records and do not change membership", () => {
  const a = game("igdb:9", "Pokémon"), b = game("igdb:10", "Other"), data = { [a.id]: { info: info(release("Oct 5, 2026", "PC"), release("Oct 6, 2026", "Switch")), failed: false } };
  const view = gameReleaseCalendar([a, b], data, 2026, 9, "pokemon", "Switch");
  assert.deepEqual([...view.days.keys()], ["2026-10-06"]);
  assert.equal(view.undated.length, 0); assert.deepEqual(view.platforms, ["PC", "Switch"]);
  assert.equal(gameReleaseCalendar([b], data, 2026, 9).days.size, 0);
});
test("UTC civil date keys stay stable at DST and year boundaries", () => {
  const g = game("steam:11"), result = (label: string) => ({ [g.id]: { info: steamSavedRelease(label, true), failed: false } });
  assert.equal(gameReleaseCalendar([g], result("Dec 31, 2026"), 2027, 0).days.size, 0);
  assert.equal(gameReleaseCalendar([g], result("Jan 1, 2027"), 2027, 0).days.has("2027-01-01"), true);
  assert.equal(gameReleaseCalendar([g], result("Nov 1, 2026"), 2026, 10).days.has("2026-11-01"), true);
  assert.equal(gameReleaseCalendar([g], result("Feb 29, 2028"), 2028, 1).days.has("2028-02-29"), true);
});

test("only actual release platforms are offered and disappearing filters recover", () => {
  const g = { ...game("steam:12"), platforms: ["Windows", "macOS"] };
  assert.deepEqual(gameReleaseCalendar([g], {}, 2026, 9).platforms, []);
  const data = { [g.id]: { info: steamSavedRelease("Oct 3, 2026", true), failed: false } };
  const view = gameReleaseCalendar([g], data, 2026, 9, "", "Windows");
  assert.equal(view.platform, "");
  assert.deepEqual(view.platforms, ["PC"]);
  assert.equal(view.days.get("2026-10-03")!.length, 1);
  assert.equal(gameReleaseCalendar([], data, 2026, 9, "", "PC").platform, "");
});
