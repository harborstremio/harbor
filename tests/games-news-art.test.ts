import assert from "node:assert/strict";
import test from "node:test";
import { newsImageIdentity, selectNewsArtwork } from "../src/lib/games/news-art";

const shot = (id: number) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/000000${id}.1920x1080.jpg?t=123`;
const post = (id: number) => `https://clan.akamai.steamstatic.com/images/42/update-${id}.png`;
const posts = (count: number) => Array.from({ length: count }, () => ({ image: "" }));

test("imageless updates each get distinct game screenshots, excluding product and hero art", () => {
  const capsule = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg";
  const screenshots = Array.from({ length: 13 }, (_, n) => shot(n));
  const result = selectNewsArtwork(posts(6), [capsule, ...screenshots], [capsule, shot(0)]);
  assert.deepEqual(result.map(item => item.primary), screenshots.slice(1, 7));
  assert.deepEqual(result.map(item => item.backup), screenshots.slice(7));
  assert.equal(new Set(result.flatMap(item => [item.primary, item.backup])).size, 12);
  assert.deepEqual(selectNewsArtwork(posts(6), [capsule, ...screenshots], [capsule, shot(0)]).slice(0, 4), result.slice(0, 4));
});

test("post-specific art takes priority and is reserved before assigning fallback screenshots", () => {
  const result = selectNewsArtwork([{ image: "" }, { image: shot(1) }, { image: post(1) }, { image: `${post(1)}?size=small` }], [shot(1), shot(2), shot(3), shot(4)]);
  assert.deepEqual(result.map(item => item.primary), [shot(2), shot(1), post(1), shot(3)]);
  assert.equal(result[0].backup, shot(4));
  assert.ok(result.slice(1).every(item => !item.backup));
});

test("Steam and IGDB resized images and CDN aliases do not duplicate artwork", () => {
  const legacy = "https://cdn.akamai.steamstatic.com/steam/apps/10/0000001.600x338.jpg?cache=2#image";
  const igdb = "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/sc123.jpg";
  assert.equal(newsImageIdentity(legacy), newsImageIdentity(shot(1)));
  assert.equal(newsImageIdentity(igdb), newsImageIdentity(igdb.replace("screenshot_huge", "screenshot_med")));
  assert.deepEqual(selectNewsArtwork(posts(3), [shot(1), legacy, igdb, igdb.replace("screenshot_huge", "screenshot_med")]).map(item => item.primary), [shot(1), igdb, undefined]);
});

test("scarce artwork stays absent instead of repeating capsules or accepting arbitrary URLs", () => {
  const invalid = ["http://clan.akamai.steamstatic.com/images/42/post.png", "https://example.com/game.png", "https://user@clan.akamai.steamstatic.com/images/42/post.png", "javascript:alert(1)"];
  const capsule = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/hash/header.jpg";
  assert.deepEqual(selectNewsArtwork(posts(3), [...invalid, capsule, shot(1)]), [{ primary: shot(1), backup: undefined }, { primary: undefined }, { primary: undefined }]);
  assert.deepEqual(selectNewsArtwork([{ image: post(1) }], [], [post(1)]), [{ primary: undefined }]);
});
