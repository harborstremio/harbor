import assert from "node:assert/strict";
import test from "node:test";
import { isWarhammerGame, parseWarhammerFeed, warhammerTvUrl, warhammerTvImage } from "../src/lib/games/warhammer-universe-data.ts";
import type { AtlasGame } from "../src/lib/games/igdb-data.ts";

const episode = (id = "25015") => ({ id, title: "Abaddon", type: { value: "episodes" }, summary: "A history of the Warmaster.", link: { href: `https://zapp-gw.web.app/beacon/video-preload/${id}/streams/214?ageRating=2` }, media_group: [{ media_item: [{ src: "https://beacon.playback.api.brightcove.com/gamesworkshop/uploads/episodes/art.jpg" }] }], extensions: { series_id: 25010, season_original_name: "Warhammer 40,000", free: false, length: 18 } });
const feed = (entry: unknown[] = [episode()]) => ({ id: "25010-25815-episodes", extensions: { season_original_name: "Warhammer 40,000" }, entry });
test("Official lore remains scoped to its exact setting and series", () => {
  const data = parseWarhammerFeed(feed(), "40k", 100);
  assert.equal(data.items.length, 1); assert.equal(data.observedAt, 100); assert.equal(data.items[0].free, false);
  assert.equal(data.items[0].minutes, 18); assert.equal(data.partial, false);
  assert.throws(() => parseWarhammerFeed(feed(), "sigmar"));
  const wrong = episode("222"); wrong.extensions.series_id = 999;
  assert.equal(parseWarhammerFeed(feed([episode(), wrong]), "40k").items.length, 1);
  assert.match(warhammerTvUrl("heresy"), /seasonNum=3/);
});
test("Bad independent records are omitted; source errors do not become empty success", () => {
  const data = parseWarhammerFeed(feed([episode(), episode(), { id: "invalid" }]), "40k");
  assert.equal(data.items.length, 1); assert.equal(data.partial, true);
  assert.throws(() => parseWarhammerFeed({ error: "Unavailable" }, "40k"));
  assert.throws(() => parseWarhammerFeed(feed([{ id: "invalid" }]), "40k"));
  assert.deepEqual(parseWarhammerFeed(feed([]), "40k").items, []);
  assert.throws(() => parseWarhammerFeed(feed(Array.from({ length: 101 }, () => episode())), "40k"));
});
test("Links only reach the publisher's chosen item; art cannot introduce arbitrary hosts", () => {
  const wrong = episode("222"); wrong.link.href = "https://evil.example/beacon/video-preload/222/streams/214";
  const data = parseWarhammerFeed(feed([episode(), wrong]), "40k");
  assert.equal(data.items.length, 1);
  assert.equal(new URL(data.items[0].url).origin, "https://warhammertv.com");
  const target = new URL(new URL(data.items[0].url).searchParams.get("self-link")!);
  assert.equal(target.pathname, "/beacon/video-preload/25015/streams/214");
  assert.equal(warhammerTvImage("https://evil.example/art.jpg"), "");
  assert.equal(warhammerTvImage("javascript:alert(1)"), "");
});
test("Animations preserve their public catalog identity and do not imply free entitlement", () => {
  const source = { id: "34-assets", entry: [{ id: "24988", title: "Angels of Death", type: { value: "series" }, extensions: {} }] };
  const item = parseWarhammerFeed(source, "animations").items[0];
  assert.equal(item.url, "https://warhammertv.com/series/24988"); assert.equal(item.free, false);
  assert.throws(() => parseWarhammerFeed({ ...source, id: "5-assets" }, "animations"));
});
test("Universe detail entry requires a trusted game identity, not Warhammer in the title", () => {
  const game = { id: "steam:1", name: "Warhammer imitation", capsule: "", platforms: [] };
  assert.equal(isWarhammerGame(game), false);
  assert.equal(isWarhammerGame({ ...game, steamId: 2183900 }), true);
  assert.equal(isWarhammerGame(game, { igdbId: 123, franchises: [{ id: 6 }] } as AtlasGame), true);
  assert.equal(isWarhammerGame(game, { igdbId: 55189, franchises: [{ id: 509 }] } as AtlasGame), false);
  assert.equal(isWarhammerGame(game, { igdbId: 7241, franchises: [{ id: 6 }] } as AtlasGame), false);
});
