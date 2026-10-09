// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { addonBasesForOrigin, type Addon } from "../src/lib/addons.ts";
import { persistableAddonOrigin, persistableVideos } from "../src/lib/cinemeta.ts";

test("persisted addon origins never retain configured transport URLs", () => {
  const origin = persistableAddonOrigin({
    id: "community.addon",
    name: "Community addon",
    logo: "https://images.example/logo.png",
    base: "https://addon.example/secret-api-key/manifest.json",
  });

  assert.deepEqual(origin, {
    id: "community.addon",
    name: "Community addon",
    logo: "https://images.example/logo.png",
  });
  assert.doesNotMatch(JSON.stringify(origin), /secret-api-key/);
});

test("persisted video metadata strips playable streams and signed URLs", () => {
  const videos = persistableVideos([
    {
      id: "episode:1",
      season: 1,
      episode: 1,
      title: "Episode 1",
      streams: [
        {
          url: "https://stream.example/private-token/video.mkv",
          behaviorHints: { proxyHeaders: { request: { Authorization: "Bearer private-token" } } },
        },
      ],
    },
  ]);

  assert.deepEqual(videos, [{ id: "episode:1", season: 1, episode: 1, title: "Episode 1" }]);
  assert.doesNotMatch(JSON.stringify(videos), /private-token|stream\.example|Authorization/);
});

test("saved addon identity resolves against current installed addon instances", () => {
  const addons: Addon[] = [
    {
      manifest: { id: "community.addon", name: "First configuration" },
      transportUrl: "https://addon.example/current-key-one/manifest.json",
    },
    {
      manifest: { id: "community.addon", name: "Second configuration" },
      transportUrl: "https://addon.example/current-key-two/manifest.json",
    },
    {
      manifest: { id: "unrelated.addon", name: "Unrelated" },
      transportUrl: "https://unrelated.example/manifest.json",
    },
  ];

  assert.deepEqual(
    addonBasesForOrigin(addons, { id: "community.addon", name: "Community addon" }),
    ["https://addon.example/current-key-one", "https://addon.example/current-key-two"],
  );
});
