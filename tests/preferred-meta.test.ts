// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  mergePreferredMeta,
  preferredEpisodeName,
  preferredEpisodeOverview,
  preferredEpisodeVideo,
} from "../src/lib/preferred-meta.ts";

test("custom metadata replaces display fields without changing the route identity", () => {
  const base = { id: "tmdb:tv:125988", type: "series" as const, name: "Silo" };
  const preferred = {
    id: "tt14688458",
    type: "series" as const,
    name: "A siló",
    description: "Magyar leírás",
    addonOrigin: { id: "custom", name: "Custom" },
  };

  const merged = mergePreferredMeta(base, preferred);
  assert.equal(merged.id, base.id);
  assert.equal(merged.type, base.type);
  assert.equal(merged.name, "A siló");
  assert.equal(merged.description, "Magyar leírás");
  assert.deepEqual(merged.addonOrigin, preferred.addonOrigin);
});

test("custom episode titles and descriptions are selected by season and episode", () => {
  const videos = [
    {
      season: 1,
      episode: 1,
      name: "A szabadság napja",
      overview: "Becker seriff tervei veszélybe kerülnek.",
    },
  ];
  const episode = preferredEpisodeVideo(videos, 1, 1);

  assert.equal(preferredEpisodeName(episode), "A szabadság napja");
  assert.equal(preferredEpisodeOverview(episode), "Becker seriff tervei veszélybe kerülnek.");
  assert.equal(preferredEpisodeVideo(videos, 1, 2), undefined);
});
