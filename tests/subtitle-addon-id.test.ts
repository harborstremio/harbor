// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { routeSubtitleAddonIds } from "../src/lib/subtitles/addon-routing.ts";

test("subtitle addons receive the first content ID each manifest supports", () => {
  const addons = [
    { name: "IMDb subtitles", prefix: "tt" },
    { name: "TMDB subtitles", prefix: "tmdb:" },
  ];
  const routed = routeSubtitleAddonIds(
    addons,
    {
      imdbId: "tt1234567",
      stremioId: "tmdb:tv:123",
      season: 1,
      episode: 3,
    },
    (addon, id) => id.startsWith(addon.prefix),
  );

  assert.deepEqual(routed.ids, ["tt1234567:1:3", "tmdb:tv:123:1:3"]);
  assert.deepEqual(
    routed.matches.map(({ addon, id }) => [addon.name, id]),
    [
      ["IMDb subtitles", "tt1234567:1:3"],
      ["TMDB subtitles", "tmdb:tv:123:1:3"],
    ],
  );
});

test("subtitle addon routing deduplicates identical IMDb and Stremio IDs", () => {
  const routed = routeSubtitleAddonIds(
    [{ prefix: "tt" }],
    { imdbId: "tt7654321", stremioId: "tt7654321" },
    (addon, id) => id.startsWith(addon.prefix),
  );

  assert.deepEqual(routed.ids, ["tt7654321"]);
  assert.equal(routed.matches[0]?.id, "tt7654321");
});
