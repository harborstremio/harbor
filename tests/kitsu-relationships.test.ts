// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";
import { isOrphanAnimeCandidate } from "../src/lib/anime-detect.ts";

test("isOrphanAnimeCandidate excludes western animation and requires East Asian origin", () => {
  // Western animation with US origin
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation", "Adventure"],
      country: "United States",
      originalLanguage: "en",
      productionCountries: ["US"],
    }),
    false,
    "US animation must not be treated as an orphan anime candidate",
  );

  // Missing metadata (unknown origin)
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation"],
    }),
    false,
    "Animation with unknown origin must not be treated as anime",
  );

  // Live action (even if from Japan)
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Drama", "Action"],
      country: "Japan",
      originalLanguage: "ja",
      productionCountries: ["JP"],
    }),
    false,
    "Live-action work must not be treated as anime",
  );

  // Japanese anime via country name
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation"],
      country: "Japan",
    }),
    true,
    "Japanese animation by country must be recognized",
  );

  // Japanese anime via language
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation"],
      originalLanguage: "ja",
    }),
    true,
    "Japanese animation by language must be recognized",
  );

  // Japanese anime via production country ISO
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation"],
      productionCountries: ["JP"],
    }),
    true,
    "Japanese animation by country ISO must be recognized",
  );

  // Chinese donghua via language or country
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation"],
      originalLanguage: "zh",
      country: "China",
    }),
    true,
    "Chinese animation must be recognized",
  );

  // Korean animation via language
  assert.equal(
    isOrphanAnimeCandidate({
      genres: ["Animation"],
      originalLanguage: "ko",
    }),
    true,
    "Korean animation must be recognized",
  );

  // Explicit type bypasses origin check
  assert.equal(
    isOrphanAnimeCandidate({
      type: "anime",
      genres: ["Animation"],
      country: "United States",
    }),
    true,
    "Explicit anime type must bypass origin check",
  );

  // Explicit animeFormat bypasses origin check
  assert.equal(
    isOrphanAnimeCandidate({
      animeFormat: "TV",
      genres: ["Animation"],
      country: "United States",
    }),
    true,
    "Explicit animeFormat must bypass origin check",
  );
});

test("kitsuMainTvSeries only follows parent_story or full_story, ignoring spinoffs", async () => {
  let requestedUrl = "";
  let mockPayload: unknown = null;

  const mocks: Record<string, unknown> = {
    "@/lib/cache": { lruSet: () => ({ has: () => false, add: () => {} }) },
    "@/lib/cinemeta": {},
    "@/lib/maintenance": { registerEvictable: () => {} },
    "@/lib/safe-fetch": {
      safeFetch: async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          json: async () => mockPayload,
        };
      },
    },
    "@/lib/addons-store/adult-filter": { adultContentHidden: () => false },
  };

  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/providers/kitsu.ts", import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText;

  const exportsObj: { kitsuMainTvSeries?: (id: number) => Promise<number | null> } = {};
  new Function("require", "exports", code)((id: string) => mocks[id] ?? {}, exportsObj);

  const { kitsuMainTvSeries } = exportsObj;
  assert.ok(typeof kitsuMainTvSeries === "function");

  // Case 1: Spinoff relationship (e.g. Adventure Time: Side Quests pointing to Adventure Time 2010)
  mockPayload = {
    data: [
      {
        id: "rel-1",
        attributes: { role: "spinoff" },
        relationships: {
          destination: { data: { id: "13760", type: "anime" } },
        },
      },
    ],
    included: [
      {
        id: "13760",
        type: "anime",
        attributes: { subtype: "TV", episodeCount: 26 },
      },
    ],
  };

  const spinoffResult = await kitsuMainTvSeries(50809);
  assert.equal(spinoffResult, null, "kitsuMainTvSeries must ignore spinoff relationships");
  assert.match(requestedUrl, /\/anime\/50809\/media-relationships/);

  // Case 2: Parent story relationship (e.g. OVA pointing to main series)
  mockPayload = {
    data: [
      {
        id: "rel-2",
        attributes: { role: "parent_story" },
        relationships: {
          destination: { data: { id: "100", type: "anime" } },
        },
      },
    ],
    included: [
      {
        id: "100",
        type: "anime",
        attributes: { subtype: "TV", episodeCount: 25 },
      },
    ],
  };

  const parentResult = await kitsuMainTvSeries(1);
  assert.equal(parentResult, 100, "kitsuMainTvSeries must follow parent_story relationships");

  // Case 3: Full story relationship
  mockPayload = {
    data: [
      {
        id: "rel-3",
        attributes: { role: "full_story" },
        relationships: {
          destination: { data: { id: "200", type: "anime" } },
        },
      },
    ],
    included: [
      {
        id: "200",
        type: "anime",
        attributes: { subtype: "TV", episodeCount: 12 },
      },
    ],
  };

  const fullResult = await kitsuMainTvSeries(2);
  assert.equal(fullResult, 200, "kitsuMainTvSeries must follow full_story relationships");
});
