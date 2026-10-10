// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { rankSubtitleCandidates } from "../src/lib/subtitles/candidate-ranking.ts";
import { subtitleSourceQueryKey } from "../src/lib/subtitles/autosync/sub-source-contract.ts";
import { deduplicateAndRankSubtitleResults } from "../src/lib/subtitles/search.ts";
import type { SubResult } from "../src/lib/subtitles/types.ts";

function candidate(id: string, overrides: Partial<SubResult> = {}): SubResult {
  return {
    id,
    url: `https://example.test/${id}.srt`,
    lang: "en",
    source: "subdl",
    release: "Show.S01E02.1080p.WEB-DL-GROUP",
    ...overrides,
  };
}

const hints = {
  release: "Show.S01E02.1080p.WEB-DL-GROUP",
  source: "WEB-DL",
  resolution: "1080p",
  season: 1,
  episode: 2,
};

test("global auto-ranking keeps verified movie hash ahead of provider filename evidence", () => {
  const providerFilename = candidate("provider", {
    providerMatch: {
      score: 1,
      confidence: "exact",
      matchedBy: ["filename"],
      reasons: ["provider filename match"],
    },
    downloads: 100000,
  });
  const movieHash = candidate("hash", {
    lang: "ar",
    hash: "moviehash",
    providerMatch: { confidence: "low", score: 0.1 },
  });

  assert.deepEqual(
    rankSubtitleCandidates([providerFilename, movieHash], ["en", "ar"], hints).map(
      (item) => item.id,
    ),
    ["hash", "provider"],
  );
});

test("global auto-ranking applies preferred language before provider confidence", () => {
  const preferred = candidate("preferred", {
    providerMatch: { confidence: "low", score: 0.2 },
  });
  const providerExact = candidate("provider-exact", {
    lang: "ar",
    providerMatch: { confidence: "exact", score: 1, matchedBy: ["filename"] },
  });

  assert.deepEqual(
    rankSubtitleCandidates([providerExact, preferred], ["en", "ar"], hints).map((item) => item.id),
    ["preferred", "provider-exact"],
  );
});

test("preferred language stays ahead of a lower-priority naturally aligned track", () => {
  const preferred = candidate("arabic-fixed", { lang: "ar", timingStatus: "fixed-offset" });
  const aligned = candidate("english-aligned", { lang: "en", timingStatus: "aligned" });

  assert.deepEqual(
    rankSubtitleCandidates([aligned, preferred], ["ar", "en"], hints).map((item) => item.id),
    ["arabic-fixed", "english-aligned"],
  );
});

test("local exact release evidence outranks weak provider confidence", () => {
  const localExact = candidate("local-exact");
  const providerMedium = candidate("provider-medium", {
    release: "Unrelated.Release.720p",
    providerMatch: { confidence: "medium", score: 0.9, reasons: ["provider title match"] },
  });

  assert.deepEqual(
    rankSubtitleCandidates([providerMedium, localExact], ["en"], hints).map((item) => item.id),
    ["local-exact", "provider-medium"],
  );
});

test("global auto-ranking rejects explicit wrong episodes and forced or foreign-only tracks", () => {
  const valid = candidate("valid");
  const wrongEpisode = candidate("wrong", { episode: 3 });
  const forced = candidate("forced", { forced: true });
  const foreignOnly = candidate("foreign", { foreignOnly: true });

  assert.deepEqual(
    rankSubtitleCandidates([wrongEpisode, forced, foreignOnly, valid], ["en"], hints).map(
      (item) => item.id,
    ),
    ["valid"],
  );
});

test("global auto-ranking has a stable final key independent of input completion order", () => {
  const a = candidate("a");
  const b = candidate("b");
  const forward = rankSubtitleCandidates([a, b], ["en"], hints).map((item) => item.id);
  const reverse = rankSubtitleCandidates([b, a], ["en"], hints).map((item) => item.id);

  assert.deepEqual(forward, ["a", "b"]);
  assert.deepEqual(reverse, forward);
});

test("provider cache identity changes with release filename, byte size, and API version", () => {
  const base = {
    imdbId: "tt1234567",
    type: "series" as const,
    season: 1,
    episode: 2,
    langs: ["ar", "en"],
    videoHash: "hash",
    videoSize: 123,
    filename: "Show.S01E02.1080p.WEB-DL-GROUP.mkv",
  };
  const key = subtitleSourceQueryKey(base, "subdl-v1");

  assert.notEqual(
    key,
    subtitleSourceQueryKey({ ...base, filename: "Show.S01E02.1080p.BluRay-GROUP.mkv" }, "subdl-v1"),
  );
  assert.notEqual(key, subtitleSourceQueryKey({ ...base, videoSize: 124 }, "subdl-v1"));
  assert.notEqual(key, subtitleSourceQueryKey(base, "subdl-v2"));
  assert.equal(
    key,
    subtitleSourceQueryKey({ ...base, langs: ["en", "ar"] }, "subdl-v1"),
    "language ordering must not fragment the same cache entry",
  );
});

test("duplicate merging is deterministic under reversed provider completion", async () => {
  const rich = candidate("rich", {
    url: "https://example.test/shared.srt",
    title: "Shared",
    hash: "moviehash",
    author: "trusted-uploader",
    downloadAuth: { kind: "subsource-api-key", credentialId: "opaque-handle" },
    providerMatch: {
      confidence: "exact",
      score: 1,
      matchedBy: ["hash"],
      reasons: ["exact provider hash"],
    },
  });
  const plain = candidate("plain", {
    source: "addon",
    url: rich.url,
    title: rich.title,
    providerMatch: {
      confidence: "low",
      matchedBy: ["title"],
      reasons: ["title only"],
    },
  });
  const completeIn = async (first: SubResult, second: SubResult) => {
    const completed: SubResult[] = [];
    await Promise.all([
      Promise.resolve().then(() => completed.push(first)),
      Promise.resolve().then(() => completed.push(second)),
    ]);
    return deduplicateAndRankSubtitleResults(completed, ["en"], hints);
  };

  const forward = await completeIn(rich, plain);
  const reverse = await completeIn(plain, rich);
  assert.deepEqual(reverse, forward);
  assert.equal(forward.length, 1);
  assert.equal(forward[0].id, "rich");
  assert.equal(forward[0].downloadAuth?.credentialId, "opaque-handle");
  assert.deepEqual(forward[0].providerMatch?.matchedBy, ["hash", "title"]);
  assert.deepEqual(forward[0].providerMatch?.reasons, ["exact provider hash", "title only"]);
});
