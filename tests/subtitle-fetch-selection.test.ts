// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { fetchSubtitlesIntoPlayer } from "../src/lib/subtitles/fetch-into-player.ts";
import { SUBTITLE_PROVIDER_TIMEOUT_MS } from "../src/lib/subtitles/autoload.ts";
import type { PreparedSubtitle, SubtitlePreparationInput } from "../src/lib/subtitles/prepare.ts";
import type { SubResult } from "../src/lib/subtitles/types.ts";

const top: SubResult = {
  id: "top",
  url: "https://subs.test/top.srt",
  lang: "en",
  source: "opensubtitles",
  format: "srt",
  title: "Top release",
  providerMatch: { confidence: "exact", score: 1 },
};

const fallback: SubResult = {
  id: "fallback",
  url: "https://subs.test/fallback.srt",
  lang: "en",
  source: "wyzie",
  format: "srt",
  title: "Fallback release",
  providerMatch: { confidence: "high", score: 0.8 },
};

const secondAligned: SubResult = {
  id: "second-aligned",
  url: "https://subs.test/second-aligned.srt",
  lang: "en",
  source: "podnapisi",
  format: "srt",
  title: "Second aligned release",
  providerMatch: { confidence: "medium", score: 0.6 },
};

function prepared(url: string): PreparedSubtitle {
  return {
    originalUrl: url,
    playableUrl: `memory:${url}`,
    format: "srt",
    cues: [
      { start: 1, end: 2, text: "one" },
      { start: 5, end: 6, text: "two" },
      { start: 10, end: 11, text: "three" },
      { start: 15, end: 16, text: "four" },
    ],
    text: "",
    encoding: "utf-8",
    encodingHealth: 1,
    encodingDiagnostics: [],
    archive: false,
    cleanup: () => {},
  };
}

async function runSelection(order: SubResult[], delays: Record<string, number>) {
  let selectedUrl: string | null = null;
  const calls: Array<{ url: string; select: boolean }> = [];
  const result = await fetchSubtitlesIntoPlayer(
    {
      bridge: {
        addSubtitle: async (_url, _lang, _title, select, metadata) => {
          const originalUrl = metadata?.originalUrl ?? "";
          calls.push({ url: originalUrl, select: select === true });
          if (originalUrl === top.url) return false;
          if (select === true) selectedUrl = originalUrl;
          return true;
        },
      } as never,
      src: {
        url: "https://media.test/episode.mkv",
        meta: { id: "tt123", type: "series", name: "Show" },
      } as never,
      settings: { subProvidersEnabled: {} } as never,
      addons: [],
      langs: ["en"],
      searchImdbId: "tt123",
      candidateIds: ["tt123:1:1"],
      season: 1,
      episode: 1,
      durationSec: 120,
      isActive: () => true,
      shouldAutoSelect: () => true,
    },
    {
      search: async () => order,
      prepare: async (input: SubtitlePreparationInput) => {
        await new Promise((resolve) => setTimeout(resolve, delays[input.url] ?? 0));
        return prepared(input.url);
      },
    },
  );
  return { calls, selectedUrl, result };
}

test("provider completion order and top-candidate add failure select the same fallback", async () => {
  const first = await runSelection([fallback, top], { [top.url]: 20, [fallback.url]: 1 });
  const second = await runSelection([top, fallback], { [top.url]: 1, [fallback.url]: 20 });

  assert.equal(first.selectedUrl, fallback.url);
  assert.equal(second.selectedUrl, fallback.url);
  assert.equal(first.result.selected?.url, fallback.url);
  assert.equal(second.result.selected?.url, fallback.url);
  assert.deepEqual(
    first.calls.map((call) => call.url),
    [top.url, fallback.url],
  );
  assert.deepEqual(
    second.calls.map((call) => call.url),
    [top.url, fallback.url],
  );
});

test("a user selection made after the first add failure revokes delayed fallback selection", async () => {
  let leaseValid = true;
  let selectedUrl = "embedded:user-choice";
  const selectFlags: boolean[] = [];
  const result = await fetchSubtitlesIntoPlayer(
    {
      bridge: {
        addSubtitle: async (_url, _lang, _title, select, metadata) => {
          selectFlags.push(select === true);
          if (metadata?.originalUrl === top.url) {
            leaseValid = false;
            return false;
          }
          if (select === true) selectedUrl = metadata?.originalUrl ?? null;
          return true;
        },
      } as never,
      src: {
        url: "https://media.test/episode.mkv",
        meta: { id: "tt123", type: "series", name: "Show" },
      } as never,
      settings: { subProvidersEnabled: {} } as never,
      addons: [],
      langs: ["en"],
      searchImdbId: "tt123",
      candidateIds: ["tt123:1:1"],
      durationSec: 120,
      isActive: () => true,
      shouldAutoSelect: () => leaseValid,
    },
    {
      search: async () => [top, fallback],
      prepare: async (input: SubtitlePreparationInput) => prepared(input.url),
    },
  );

  assert.deepEqual(selectFlags, [true, false]);
  assert.equal(selectedUrl, "embedded:user-choice");
  assert.equal(result.selected, null);
});

test("an aligned fallback is selected before a higher-ranked mistimed candidate", async () => {
  const calls: Array<{ url: string; select: boolean }> = [];
  const result = await fetchSubtitlesIntoPlayer(
    {
      bridge: {
        addSubtitle: async (_url, _lang, _title, select, metadata) => {
          const originalUrl = metadata?.originalUrl ?? "";
          calls.push({ url: originalUrl, select: select === true });
          return originalUrl !== top.url;
        },
      } as never,
      src: {
        url: "https://media.test/episode.mkv",
        meta: { id: "tt123", type: "series", name: "Show" },
      } as never,
      settings: { subProvidersEnabled: {} } as never,
      addons: [],
      langs: ["en"],
      searchImdbId: "tt123",
      candidateIds: ["tt123:1:1"],
      durationSec: 120,
      isActive: () => true,
      shouldAutoSelect: () => true,
    },
    {
      search: async () => [secondAligned, fallback, top],
      prepare: async (input: SubtitlePreparationInput) => prepared(input.url),
      preflightProbe: async (item) =>
        item.originalUrl === fallback.url
          ? {
              status: "measured",
              value: { ncc: 0.2, coverage: 0.3, z: 2 },
              best: { ncc: 0.82, coverage: 0.8, z: 7 },
              bestTransform: { offsetSec: 3.5, ratio: 1 },
              method: "bounded-audio-preflight",
            }
          : {
              status: "measured",
              value: { ncc: 0.9, coverage: 0.85, z: 8 },
              method: "identity-audio-preflight",
            },
    },
  );

  assert.deepEqual(calls, [
    { url: top.url, select: true },
    { url: secondAligned.url, select: true },
    { url: fallback.url, select: false },
  ]);
  assert.equal(result.selected?.url, secondAligned.url);
});

test("default settings expose free Podnapisi to an exact MovieHash enrichment run", async () => {
  const exactHash: SubResult = {
    id: "podnapisi:hash-match",
    url: "https://subs.test/hash-match.srt",
    lang: "ar",
    source: "podnapisi",
    format: "srt",
    hash: "moviehash",
    providerMatch: {
      confidence: "exact",
      score: 1,
      matchedBy: ["hash"],
    },
  };
  let selectedUrl: string | null = null;
  const result = await fetchSubtitlesIntoPlayer(
    {
      bridge: {
        addSubtitle: async (_url, _lang, _title, select, metadata) => {
          if (select) selectedUrl = metadata?.originalUrl ?? null;
          return true;
        },
      } as never,
      src: {
        url: "https://media.test/movie.mkv",
        meta: { id: "tt456", type: "movie", name: "Movie" },
      } as never,
      settings: {
        subProvidersEnabled: {},
        subdlApiKey: "",
        subsourceApiKey: "",
      } as never,
      addons: [],
      langs: ["ar"],
      searchImdbId: "tt456",
      candidateIds: ["tt456"],
      videoHash: "0123456789abcdef",
      videoSize: 123_456,
      durationSec: 120,
      providers: {
        opensubtitles: false,
        wyzie: false,
        addons: false,
        extras: true,
      },
      isActive: () => true,
      shouldAutoSelect: () => true,
    },
    {
      search: async (query, options) => {
        assert.equal(query.videoHash, "0123456789abcdef");
        assert.equal(options.extra?.enabled?.podnapisi, true);
        assert.equal(options.extra?.enabled?.gestdown, false);
        return [exactHash];
      },
      prepare: async (input: SubtitlePreparationInput) => prepared(input.url),
    },
  );

  assert.equal(selectedUrl, exactHash.url);
  assert.equal(result.selected?.url, exactHash.url);
});

test("automatic discovery gives slow subtitle addons the full provider timeout", async () => {
  let timeoutMs: number | undefined;

  await fetchSubtitlesIntoPlayer(
    {
      bridge: { addSubtitle: async () => true } as never,
      src: {
        url: "https://media.test/movie.mkv",
        meta: { id: "tt789", type: "movie", name: "Movie" },
      } as never,
      settings: { subProvidersEnabled: { addons: true } } as never,
      addons: [],
      langs: ["ar"],
      searchImdbId: "tt789",
      candidateIds: ["tt789"],
      durationSec: 120,
      isActive: () => true,
    },
    {
      search: async (_query, options) => {
        timeoutMs = options.timeoutMs;
        return [];
      },
    },
  );

  assert.equal(timeoutMs, SUBTITLE_PROVIDER_TIMEOUT_MS);
});

test("automatic discovery progressively exposes 12 tracks and finishes at 15", async () => {
  const candidates = Array.from({ length: 20 }, (_, index): SubResult => ({
    ...top,
    id: `arabic-${index}`,
    url: `https://subs.test/arabic-${index}.srt`,
    lang: "ar",
    source: "addon",
    title: "Subtitle addon",
    providerMatch: { confidence: "exact", score: 1 - index / 100 },
  }));
  const calls: string[] = [];
  let releaseSearch!: () => void;
  const searchGate = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });

  const fetchPromise = fetchSubtitlesIntoPlayer(
    {
      bridge: {
        addSubtitle: async (url, _lang, _title, _select, metadata) => {
          calls.push(metadata?.originalUrl ?? url);
          return true;
        },
      } as never,
      src: {
        url: "https://media.test/movie.mkv",
        meta: { id: "tt789", type: "movie", name: "Movie" },
      } as never,
      settings: { subProvidersEnabled: { addons: true } } as never,
      addons: [],
      langs: ["ar"],
      searchImdbId: "tt789",
      candidateIds: ["tt789"],
      durationSec: 120,
      isActive: () => true,
      shouldAutoSelect: () => true,
    },
    {
      search: async (_query, options) => {
        options.onPartial?.(candidates, 1);
        await searchGate;
        return candidates;
      },
      prepare: async (input: SubtitlePreparationInput) => prepared(input.url),
    },
  );

  for (let attempt = 0; attempt < 20 && calls.length < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(calls.length, 12);

  releaseSearch();
  const result = await fetchPromise;
  assert.equal(result.added, 15);
  assert.equal(new Set(calls).size, 15);
});
