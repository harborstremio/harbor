// @ts-expect-error Node test types are outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser-only tsconfig.
import test from "node:test";
import type { Meta } from "../src/lib/cinemeta.ts";
import { isAddonNativeMeta, metaIdentityKeys, metaImdbId } from "../src/lib/meta-identity.ts";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";
import { loadTsModule } from "./helpers/load-ts-module.ts";

const native: Meta = {
  id: "cnative:tt35316225",
  type: "series",
  name: "逐玉",
  imdb_id: "tt35316225",
  tmdb_id: 279388,
};

test("metadata ownership and IMDb identity remain separate", () => {
  const card = { ...native };
  assert.equal(metaImdbId(card), "tt35316225");
  assert.equal(card.id, "cnative:tt35316225");
  assert.equal(isAddonNativeMeta(card), true);
  assert.ok(metaIdentityKeys(card).includes("series:tmdb:279388"));
});

test("opaque metadata IDs from other addons can carry external IMDb IDs", () => {
  const card = { ...native, id: "another-provider:123" };
  assert.equal(metaImdbId(card), "tt35316225");
  assert.equal(isAddonNativeMeta(card), true);
  assert.equal(
    isAddonNativeMeta({ id: "tt35316225", type: "series", name: "Pursuit of Jade" }),
    false,
  );
});

test("invalid external IMDb IDs are ignored without altering metadata IDs", () => {
  for (const imdb_id of ["bad", "tt123", "tt35316225:1:1", "https://example.test"]) {
    assert.equal(metaImdbId({ ...native, imdb_id }), undefined);
  }
});

test("bare and scoped TMDB IDs have the same external identity", () => {
  const bare = metaIdentityKeys({ id: "tmdb:279388", type: "series", name: native.name });
  const scoped = metaIdentityKeys({ id: "tmdb:tv:279388", type: "series", name: native.name });
  assert.ok(bare.includes("series:tmdb:279388"));
  assert.ok(scoped.includes("series:tmdb:279388"));
});

test("cNative episode streams use standard IDs with or without an explicit video ID", () => {
  for (const videoId of [undefined, "tt35316225:1:2", "cnative:tt35316225:1:2"]) {
    assert.deepEqual(
      buildStreamIds(native.id, { season: 1, episode: 2, videoId }, metaImdbId(native) ?? null),
      ["tt35316225:1:2"],
    );
  }
  assert.equal(native.id, "cnative:tt35316225");
});

test("generic addon IDs retain their own stream path and also query IMDb", () => {
  assert.deepEqual(
    buildStreamIds("another-provider:123", { season: 1, episode: 2 }, "tt35316225"),
    ["another-provider:123:1:2", "tt35316225:1:2"],
  );
});

test("cNative TMDB fallback and default video IDs remain standard", () => {
  assert.deepEqual(buildStreamIds("cnative:tmdb:279388", { season: 1, episode: 2 }, null), [
    "tmdb:279388:1:2",
  ]);
  assert.deepEqual(buildStreamIds(native.id, undefined, "tt35316225", "cnative:tt35316225"), [
    "tt35316225",
  ]);
});

test("playback resolves supplied IMDb IDs synchronously without another metadata provider", () => {
  const unexpected = () => {
    throw new Error("external metadata lookup must not run");
  };
  const { useImdbId } = loadTsModule<typeof import("../src/views/play-picker/use-imdb-id.ts")>(
    "src/views/play-picker/use-imdb-id.ts",
    {
      react: {
        useEffect: (effect: () => void) => effect(),
        useState: (value: unknown) => [value, () => {}],
      },
      "@/lib/cinemeta": {
        isAddonNativeMeta,
        narrowMediaType: (type: string) => (type === "series" ? "series" : "movie"),
      },
      "@/lib/providers/anime-kitsu-addon": { animeKitsuMeta: unexpected },
      "@/lib/providers/anime-mapping": { externalToKitsu: unexpected, kitsuToImdb: unexpected },
      "@/lib/providers/tmdb": { tmdbImdbId: unexpected },
      "./picker-utils": { cinemetaImdbFallback: unexpected },
    },
  );
  assert.deepEqual(useImdbId(native, undefined), { id: "tt35316225", verified: true });
  assert.equal(native.name, "逐玉");
});

test("rating providers receive the external IMDb ID while native metadata stays intact", async () => {
  const requests: Array<[string, string | undefined | null]> = [];
  const { useImdbRating } = loadTsModule<typeof import("../src/lib/imdb-rating.ts")>(
    "src/lib/imdb-rating.ts",
    {
      react: {
        useEffect: (effect: () => void) => effect(),
        useState: (value: unknown) => [value, () => {}],
      },
      "@/lib/cinemeta": {
        narrowMediaType: (type: string) => type,
        meta: async (_type: string, id: string) => {
          requests.push(["cinemeta", id]);
          return { name: "Pursuit of Jade", imdbRating: "8.2" };
        },
      },
      "@/lib/providers/omdb": {
        useOmdbScores: (id: string | undefined) => {
          requests.push(["omdb", id]);
          return null;
        },
      },
      "@/lib/providers/harbor-imdb": {
        harborImdbTitle: async (id: string) => {
          requests.push(["harbor", id]);
          return 8.2;
        },
      },
    },
  );
  useImdbRating(native);
  await Promise.resolve();
  assert.deepEqual(requests, [
    ["omdb", "tt35316225"],
    ["cinemeta", "tt35316225"],
    ["harbor", "tt35316225"],
  ]);
  assert.equal(native.id, "cnative:tt35316225");
  assert.equal(native.name, "逐玉");
});
