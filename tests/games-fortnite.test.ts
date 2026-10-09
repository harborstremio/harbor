import assert from "node:assert/strict";
import test from "node:test";
import { fortniteCode, fortniteIslandUrl, fortniteRankingsUrl, localizeFortniteIsland, parseFortniteActivity, parseFortniteIsland, parseFortniteIslandBasics, parseFortniteRankings } from "../src/lib/games/fortnite-data.ts";

const code = "0148-0322-5437", snapshot = "2026-10-02T09:00:00.000Z";
const rankings = () => ({ meta: { count: 1, total: 80, snapshotAvailable: true, snapshot, page: { nextCursor: "MQ==", prevCursor: null } }, data: [{ islandCode: code, rank: 1 }] });
const island = () => ({ status: 200, mnemonic: code, data: { mnemonic: code, linkType: "valkyrie:application", title: "Island", description: "Original description", creator: "Creator",
  images: { full: "https://cdn-0001.qstv.on.epicgames.com/asset/image/landscape_comp.jpeg" }, metadata: { code, moderationStatus: "Approved", alt_title: { de: "Insel" }, alt_introduction: { de: "Beschreibung", "pt-BR": "Descrição" } }, matchmaking: { v2: { maxPlayers: 4 } } } });

test("Fortnite links use only exact island codes and pinned ranking cursors", () => {
  assert.equal(fortniteIslandUrl(code), `https://play.fn.gg/island/${code}`);
  for (const bad of ["../islands", "0148-0322-5437?a=b", "https://example.com", "playlist_defaultsolo"]) { assert.equal(fortniteCode(bad), false); assert.throws(() => fortniteIslandUrl(bad)); }
  const url = new URL(fortniteRankingsUrl("shooter", { cursor: "MQ==", snapshot }));
  assert.equal(url.searchParams.get("at"), snapshot); assert.equal(url.searchParams.get("after"), "MQ=="); assert.equal(url.searchParams.get("size"), "6");
  assert.throws(() => fortniteRankingsUrl("../shooter")); assert.throws(() => fortniteRankingsUrl("shooter", { cursor: "https://other.test", snapshot }));
});
test("Ranking gaps remain distinct from an empty published snapshot", () => {
  const value = rankings(); assert.equal(parseFortniteRankings(value).rows[0]?.code, code);
  value.data = []; value.meta.count = 0; value.meta.total = 0;
  assert.equal(parseFortniteRankings(value).available, true);
  value.meta.snapshotAvailable = false; assert.equal(parseFortniteRankings(value).available, false);
  assert.equal(parseFortniteRankings({ ...value, meta: { ...value.meta, snapshot: null } }).snapshot, null);
  assert.throws(() => parseFortniteRankings({ ...rankings(), meta: { ...rankings().meta, snapshotAvailable: false } }));
});
test("Malformed counts, repeated islands and conflicting ranks cannot look like valid charts", () => {
  assert.throws(() => parseFortniteRankings({ ...rankings(), meta: { ...rankings().meta, count: 2 } }));
  assert.throws(() => parseFortniteRankings({ ...rankings(), data: [{ islandCode: code, rank: 90 }] }));
  assert.throws(() => parseFortniteRankings({ ...rankings(), meta: { ...rankings().meta, count: 2 }, data: [{ islandCode: code, rank: 1 }, { islandCode: code, rank: 2 }] }));
});
test("Media requires matching code and approved type, with bounded original image origins", () => {
  assert.equal(parseFortniteIslandBasics({ code, title: "Epic title", creatorCode: "Creator" }, code).title, "Epic title");
  assert.throws(() => parseFortniteIslandBasics({ code: "0000-0000-0000", title: "Wrong island" }, code));
  const value = parseFortniteIsland(island(), code); assert.equal(value.players, 4); assert.ok(value.image);
  assert.throws(() => parseFortniteIsland(island(), "0000-0000-0000"));
  const bad = island(); bad.data.metadata.code = "0000-0000-0000"; assert.throws(() => parseFortniteIsland(bad, code));
  bad.data.metadata.code = code; bad.data.metadata.moderationStatus = "Rejected"; assert.throws(() => parseFortniteIsland(bad, code));
  for (const image of ["http://cdn-0001.qstv.on.epicgames.com/x", "https://cdn-0001.qstv.on.epicgames.com.evil.test/x", "https://user:password@cdn-0001.qstv.on.epicgames.com/x", "javascript:alert(1)"]) {
    const raw = island(); raw.data.images.full = image; assert.equal(parseFortniteIsland(raw, code).image, undefined);
  }
});
test("Provider localization is selected without translating codes or making more requests", () => {
  const value = parseFortniteIsland(island(), code);
  assert.equal(localizeFortniteIsland(value, "de").title, "Insel"); assert.equal(localizeFortniteIsland(value, "pt").description, "Descrição");
  assert.equal(localizeFortniteIsland(value, "hi").title, "Island"); assert.equal(value.title, "Island");
});
test("Activity excludes partial today and old dates, preserving real zeroes and withheld values", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  const raw = { peakCCU: [{ timestamp: "2026-10-01T00:00:00Z", value: 0 }, { timestamp: "2026-10-02T00:00:00Z", value: 999 }], uniquePlayers: [{ timestamp: "2026-10-01T00:00:00Z", value: null }] };
  assert.deepEqual(parseFortniteActivity(raw, now), { date: Date.parse("2026-10-01T00:00:00Z"), peak: 0, players: null });
  assert.equal(parseFortniteActivity(raw, now + 8 * 86_400_000), null);
  assert.equal(parseFortniteActivity({ peakCCU: [], uniquePlayers: [] }, now), null);
  assert.throws(() => parseFortniteActivity({ error: "unavailable" }, now));
});
