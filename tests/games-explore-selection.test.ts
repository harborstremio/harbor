import test from "node:test";
import assert from "node:assert/strict";
import { decodeExploreHistory, rotateExplorePage, selectExploreGames, type ExploreHistory } from "../src/lib/games/explore-selection.ts";

const now = Date.UTC(2026, 9, 1);
const game = (id: number) => ({ id: `steam:${id}`, steamId: id, name: `Game ${id}`, capsule: "art", platforms: ["Windows"] });
const played = Array.from({ length: 60 }, (_, i) => ({ ...game(i + 1), chartRank: i + 1 }));
const sellers = Array.from({ length: 50 }, (_, i) => game(i + 31));
const releases = Array.from({ length: 30 }, (_, i) => ({ ...game(i + 81), releaseTimestamp: now / 1000 - (i + 1) * 86400, reviews: { positive: 85, count: 1200 } }));
const feeds = { played, sellers, releases };

test("current sources supply nine unique picks with chart leaders and recent-release space", () => {
  const picks = selectExploreGames(feeds, "one", [], now), ids = picks.map(pick => pick.game.steamId);
  assert.equal(picks.length, 9); assert.equal(new Set(ids).size, 9);
  assert.ok(ids.includes(1)); assert.ok(ids.includes(31));
  assert.ok(picks.filter(pick => pick.source === "new_releases").length >= 2);
  assert.ok(picks.every(pick => pick.source !== "most_played" || pick.rank <= 40));
  assert.deepEqual(selectExploreGames(feeds, "one", [], now), picks);
  assert.equal(played[0].chartRank, 1);
});

test("successive visits avoid the last three opening games and rotate most of the deck", () => {
  let history: ExploreHistory = [];
  const leads = new Set<number>(); let overlap = 0;
  for (let i = 0; i < 30; i++) {
    const picks = selectExploreGames(feeds, `visit-${i}`, history, now), lead = picks[0].game.steamId!;
    assert.ok(!history.slice(0, 3).some(visit => visit.lead === lead));
    if (history.length) overlap += picks.filter(pick => history[0].games.includes(pick.game.steamId!)).length;
    leads.add(lead); history = [{ at: now, lead, games: picks.map(pick => pick.game.steamId!) }, ...history].slice(0, 6);
  }
  assert.ok(leads.size > 15); assert.ok(overlap / 29 < 4, `average repeated cards: ${overlap / 29}`);
});

test("partial sources still work, upcoming and old releases cannot fill the fresh lane", () => {
  const picks = selectExploreGames({ played: [], sellers: [], releases: [
    releases[0], { ...releases[1], comingSoon: true }, { ...game(999), releaseTimestamp: now / 1000 + 1 },
    { ...game(998), releaseTimestamp: now / 1000 - 91 * 86400 }, game(997),
    { ...releases[2], reviews: { positive: 99, count: 5 } }, { ...releases[3], reviews: { positive: 40, count: 5000 } },
  ] }, "partial", [], now);
  assert.deepEqual(picks.map(pick => pick.game.steamId), [81]);
  assert.deepEqual(selectExploreGames({ played: [], sellers: [], releases: [] }, "empty", [], now), []);
  assert.equal(selectExploreGames({ played: played.slice(0, 1), sellers: [], releases: [] }, "tiny", [{ at: now, lead: 1, games: [1] }], now).length, 1);
});

test("a two-game catalog alternates greetings rather than exhausting the cooldown", () => {
  const picks = selectExploreGames({ played: played.slice(0, 2), sellers: [], releases: [] }, "tiny", [{ at: now, lead: 1, games: [1, 2] }, { at: now, lead: 2, games: [2, 1] }], now);
  assert.equal(picks[0].game.steamId, 2);
});

test("row variation preserves anchors and the complete provider page, without mutation", () => {
  const page = sellers.slice(0, 30), order = rotateExplorePage(page, "visit-a", 0);
  assert.equal(order[0], page[0]); assert.notDeepEqual(order, page);
  assert.deepEqual(new Set(order.map(game => game.id)), new Set(page.map(game => game.id)));
  assert.deepEqual(order, rotateExplorePage(page, "visit-a", 0));
  assert.notDeepEqual(order, rotateExplorePage(page, "visit-b", 0));
  assert.equal(page[1].steamId, 32);
  assert.deepEqual(rotateExplorePage(page, "", 0), page);
});

test("history is bounded and rejects malformed, future and expired entries", () => {
  assert.deepEqual(decodeExploreHistory(null, now), []);
  assert.deepEqual(decodeExploreHistory([{ at: now + 1, lead: 1, games: [1] }, { at: now - 31 * 86400_000, lead: 2, games: [2] }, { at: now, lead: "3", games: [] }, { at: now, lead: 4, games: [4, 4, null, -1, "5", 6] }], now), [{ at: now, lead: 4, games: [4, 6] }]);
});


test("top-20 chart games own seven slots and the greeting across visits", () => {
  for (let i = 0; i < 100; i++) {
    const picks = selectExploreGames(feeds, `chart-${i}`, [{ at: now, lead: 1, games: played.slice(0,20).map(g=>g.steamId) }], now);
    assert.equal(picks.filter(p => p.source !== "new_releases" && p.rank <= 20).length, 7);
    assert.equal(picks.filter(p => p.source === "new_releases").length, 2);
    assert.notEqual(picks[0].source, "new_releases");
    assert.ok(picks[0].rank <= 20);
  }
});


test("overlapping feeds retain chart eligibility and never duplicate a game", () => {
  const overlapping = played.slice(0,20).map(g=>({...g, releaseTimestamp:now/1000-86400,reviews:{positive:90,count:10000}}));
  for(let i=0;i<20;i++) {
    const picks=selectExploreGames({played,sellers:played.slice(0,20),releases:[...overlapping,...releases]},`overlap-${i}`,[],now);
    assert.equal(new Set(picks.map(p=>p.game.steamId)).size,picks.length);
    assert.ok(picks.filter(p=>p.source!=="new_releases" && p.rank<=20).length>=7);
  }
});
