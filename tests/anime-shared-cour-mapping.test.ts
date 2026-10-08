// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { sharedCourRedirectTarget } from "../src/lib/providers/anime-mapping.ts";

// You and I Are Polar Opposites: one IMDb id (tt36034547) and one TMDB id
// (278043) are claimed by both Kitsu 49372 (S1) and Kitsu 50634 (S2).
// AniZip answers the shared id with the S2 mapping (kitsu_id: null), which
// used to flip TMDB detail pages onto S2E1 while calling it S1E1.
const S2_MAPPING = { kitsu_id: null, anidb_id: 19983, imdb_id: "tt36034547", themoviedb_id: 278043 };
const S1_MAPPING = { kitsu_id: 49372, anidb_id: 19010, imdb_id: "tt36034547", themoviedb_id: 278043 };

test("shared IMDb id redirects a later cour to the earlier cour", () => {
  assert.equal(sharedCourRedirectTarget(S2_MAPPING, 50634, 49372, S1_MAPPING), 49372);
});

test("shared TMDB id redirects even without an IMDb match", () => {
  assert.equal(
    sharedCourRedirectTarget(
      { kitsu_id: null, themoviedb_id: 278043 },
      50634,
      49372,
      { kitsu_id: 49372, themoviedb_id: 278043 },
    ),
    49372,
  );
});

test("explicit kitsu_id hits are trusted (later cour with its own IMDb id)", () => {
  assert.equal(
    sharedCourRedirectTarget(
      { kitsu_id: 50634, imdb_id: "tt36034547" },
      50634,
      49372,
      S1_MAPPING,
    ),
    null,
  );
});

test("no redirect when already on the first cour or without a resolution", () => {
  assert.equal(sharedCourRedirectTarget(S2_MAPPING, 49372, 49372, S1_MAPPING), null);
  assert.equal(sharedCourRedirectTarget(S2_MAPPING, null, 49372, S1_MAPPING), null);
  assert.equal(sharedCourRedirectTarget(S2_MAPPING, 50634, null, S1_MAPPING), null);
});

test("no redirect when the earlier cour does not share the provider id", () => {
  assert.equal(
    sharedCourRedirectTarget(S2_MAPPING, 50634, 11111, { kitsu_id: 11111, imdb_id: "tt0000000" }),
    null,
  );
  assert.equal(
    sharedCourRedirectTarget(
      { kitsu_id: null, themoviedb_id: 278043 },
      50634,
      11111,
      { kitsu_id: 11111, themoviedb_id: 999 },
    ),
    null,
  );
});

test("imdb/tmdb resolvers route ambiguous shared ids through the first-cour check", () => {
  const src = readFileSync(
    new URL("../src/lib/providers/anime-mapping.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /preferFirstCour\(k, az\)/);
  assert.match(src, /preferFirstCour\(fallback, \{ imdb_id: imdbId \}\)/);
  assert.match(src, /sharedCourRedirectTarget\(originalMappings, resolved, root/);
});
