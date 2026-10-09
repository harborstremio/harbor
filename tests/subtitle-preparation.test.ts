// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import {
  extractSafeSubtitleEntries,
  prepareRankedSubtitleCandidates,
  prepareSubtitleBytes,
  SubtitlePreparationError,
  type PreparedSubtitle,
} from "../src/lib/subtitles/prepare.ts";
import { ARABIC_ASS } from "./fixtures/subtitle-p2-fixtures.ts";
import { prepareSubtitleForSave } from "../src/lib/subtitles/save-to-disk.ts";
import { resolveSwapCues } from "../src/lib/subtitles/autosync/opensubtitles.ts";
import { prepareConsensusCandidate } from "../src/lib/subtitles/autosync/consensus.ts";

const english = `1
00:00:01,000 --> 00:00:02,500
Hello

2
00:00:04,000 --> 00:00:05,500
World
`;

const arabic = `1
00:00:01,000 --> 00:00:02,500
مرحبا

2
00:00:04,000 --> 00:00:05,500
بالعالم
`;

const playable = async (bytes: Uint8Array, format: string) => ({
  url: `memory:${format}:${bytes.length}`,
  cleanup: () => {},
});

function dataUrl(mime: string, bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}

const manyCues = Array.from(
  { length: 24 },
  (_, index) =>
    `${index + 1}\n00:00:${String(index).padStart(2, "0")},000 --> 00:00:${String(index).padStart(2, "0")},700\nDialogue line ${index + 1}\n`,
).join("\n");

function reasonOf(error: unknown): string | undefined {
  return error instanceof SubtitlePreparationError ? error.reason : undefined;
}

test("prepared subtitles reject parent traversal and absolute archive paths", () => {
  for (const name of [
    "../escape.srt",
    "/absolute.srt",
    "C:\\escape.srt",
    "\\\\server\\share.srt",
  ]) {
    const archive = zipSync({ [name]: strToU8(english) });
    assert.throws(
      () => extractSafeSubtitleEntries(archive),
      (error: unknown) => reasonOf(error) === "unsafe-path",
      name,
    );
  }
});

test("prepared subtitles reject nested archives", () => {
  const nested = zipSync({ "inside.srt": strToU8(english) });
  const byName = zipSync({ "nested.zip": nested });
  assert.throws(
    () => extractSafeSubtitleEntries(byName),
    (error: unknown) => reasonOf(error) === "nested-archive",
  );

  const byMagic = zipSync({ "looks-like.srt": nested });
  assert.throws(
    () => extractSafeSubtitleEntries(byMagic),
    (error: unknown) => reasonOf(error) === "nested-archive",
  );
});

test("prepared subtitles enforce entry, per-file, and total inflated limits", () => {
  const many = Object.fromEntries(
    Array.from({ length: 4 }, (_, index) => [`${index}.txt`, strToU8("x")]),
  );
  assert.throws(
    () => extractSafeSubtitleEntries(zipSync(many), { archiveEntries: 3 }),
    (error: unknown) => reasonOf(error) === "too-many-entries",
  );

  assert.throws(
    () =>
      extractSafeSubtitleEntries(zipSync({ "large.srt": strToU8(english) }), {
        subtitleFileBytes: 8,
      }),
    (error: unknown) => reasonOf(error) === "subtitle-limit",
  );

  assert.throws(
    () =>
      extractSafeSubtitleEntries(
        zipSync({ "a.txt": strToU8("12345"), "b.txt": strToU8("67890") }),
        {
          archiveInflatedBytes: 8,
        },
      ),
    (error: unknown) => reasonOf(error) === "inflated-limit",
  );
});

test("prepared subtitles reject empty archives", () => {
  assert.throws(
    () => extractSafeSubtitleEntries(zipSync({ "readme.txt": strToU8("nothing here") })),
    (error: unknown) => reasonOf(error) === "empty-archive",
  );
});

test("prepared subtitles reject a truncated ZIP envelope", async () => {
  const truncated = zipSync({ "subtitle.srt": strToU8(english) }).subarray(0, 30);
  await assert.rejects(
    () =>
      prepareSubtitleBytes(
        "https://example.test/truncated.zip",
        truncated,
        {},
        { createPlayable: playable },
      ),
    (error: unknown) => reasonOf(error) === "invalid-archive",
  );
});

test("prepared subtitles reject damaged text even when cue syntax still parses", async () => {
  const damaged = strToU8(english.replace("Hello", "\uFFFDello"));
  await assert.rejects(
    () =>
      prepareSubtitleBytes(
        "https://example.test/damaged.srt",
        damaged,
        { format: "srt", language: "en" },
        { createPlayable: playable },
      ),
    (error: unknown) => reasonOf(error) === "decode-unhealthy",
  );
});

test("raw subtitle preparation honors a trusted format hint and the per-file byte cap", async () => {
  const hinted = await prepareSubtitleBytes(
    "https://example.test/download?id=42",
    strToU8(english),
    { format: "srt", language: "en", filename: "download" },
    { createPlayable: playable },
  );
  assert.equal(hinted.format, "srt");

  await assert.rejects(
    () =>
      prepareSubtitleBytes(
        "https://example.test/oversize.srt",
        strToU8(english),
        { format: "srt" },
        { createPlayable: playable, limits: { subtitleFileBytes: 8 } },
      ),
    (error: unknown) => reasonOf(error) === "subtitle-limit",
  );
});

test("save preparation accepts an already-local data subtitle without a network refetch", async () => {
  const url = `data:text/plain;charset=utf-8,${encodeURIComponent(english)}`;
  const prepared = await prepareSubtitleForSave(url, {
    title: "local-subtitle.srt",
    lang: "en",
    format: "srt",
  });
  try {
    assert.equal(prepared.originalUrl, url);
    assert.equal(prepared.format, "srt");
    assert.equal(prepared.cues.length, 2);
  } finally {
    prepared.cleanup();
  }
});

test("Arabic ASS preparation preserves the complete styled document", async () => {
  const prepared = await prepareSubtitleBytes(
    "https://example.test/arabic.ass",
    strToU8(ARABIC_ASS),
    { format: "ass", language: "ar" },
    { createPlayable: playable },
  );

  assert.equal(prepared.format, "ass");
  assert.equal(prepared.text, ARABIC_ASS);
  assert.match(prepared.text, /Style: Default,Vazirmatn/);
  assert.match(prepared.text, /Speaker,0,0,20,,\{\\an8\}/);
  assert.match(prepared.text, /karaoke,\{\\k20\}/);
});

test("multilingual archives choose language, episode, and release deterministically", async () => {
  const archive = zipSync({
    "Show.S02E04.WEB-DL-GROUP.en.srt": strToU8(english),
    "Show.S02E05.BluRay.ara.srt": strToU8(arabic),
    "Show.S02E05.WEB-DL-GROUP.ar.srt": strToU8(arabic),
  });
  const prepared = await prepareSubtitleBytes(
    "https://example.test/subtitle.zip",
    archive,
    {
      language: "ar",
      season: 2,
      episode: 5,
      release: "Show.S02E05.1080p.WEB-DL-GROUP",
      filename: "Show.S02E05.1080p.WEB-DL-GROUP.mkv",
    },
    { createPlayable: playable },
  );

  assert.equal(prepared.rawFilename, "Show.S02E05.WEB-DL-GROUP.ar.srt");
  assert.equal(prepared.archive, true);
  assert.equal(prepared.format, "srt");
  assert.equal(prepared.cues.length, 2);
  assert.match(prepared.text, /مرحبا/);
});

test("multilingual archives use central language aliases beyond the original shortlist", async () => {
  const archive = zipSync({
    "Show.S01E01.French.srt": strToU8(english.replace("Hello", "Bonjour")),
    "Show.S01E01.ger.srt": strToU8(english.replace("Hello", "Hallo")),
  });
  const prepared = await prepareSubtitleBytes(
    "https://example.test/multilingual.zip",
    archive,
    { language: "German", season: 1, episode: 1 },
    { createPlayable: playable },
  );

  assert.equal(prepared.rawFilename, "Show.S01E01.ger.srt");
  assert.match(prepared.text, /Hallo/);
});

test("multilingual archives recognize an Arabic self-name through central normalization", async () => {
  const archive = zipSync({
    "Show.S01E01.english.srt": strToU8(english),
    "Show.S01E01.العربية.srt": strToU8(arabic),
  });
  const prepared = await prepareSubtitleBytes(
    "https://example.test/arabic-pack.zip",
    archive,
    { language: "ar", season: 1, episode: 1 },
    { createPlayable: playable },
  );

  assert.equal(prepared.rawFilename, "Show.S01E01.العربية.srt");
});

test("autosync hash swaps use safe archive preparation", async () => {
  const archive = zipSync({ "Movie.2026.WEB-DL.en.srt": strToU8(manyCues) });
  const resolved = await resolveSwapCues(
    { url: dataUrl("application/zip", archive) },
    { apiKey: "", userAgent: "Harbor-Test" },
  );

  assert.equal(resolved?.cues.length, 24);
  assert.equal(resolved?.cueText[0], "Dialogue line 1");
});

test("autosync consensus candidates use safe archive preparation", async () => {
  const archive = zipSync({ "Movie.2026.WEB-DL.en.srt": strToU8(manyCues) });
  const candidate = await prepareConsensusCandidate(
    {
      id: "archive-result",
      url: dataUrl("application/zip", archive),
      lang: "en",
      source: "subdl",
      release: "Movie.2026.WEB-DL",
      archive: true,
    },
    5_000,
    {
      mediaUrl: "https://example.test/video.mkv",
      sourceKind: "http",
      durationSec: 120,
      cues: [],
      languages: ["en"],
      subtitleLanguage: "en",
      audioLanguage: "en",
      meta: { season: 1, episode: 1 },
    },
  );

  assert.equal(candidate?.seq.lines.length, 24);
  assert.equal(candidate?.format, "srt");
});

function fakePrepared(label: string): PreparedSubtitle {
  return {
    originalUrl: label,
    playableUrl: label,
    format: "srt",
    cues: [],
    text: "",
    encoding: "utf-8",
    encodingHealth: 1,
    encodingDiagnostics: [],
    archive: false,
    cleanup: () => {},
  };
}

test("top candidate preparation preserves rank when promises complete out of order", async () => {
  const delays: Record<string, number> = { first: 30, second: 2, third: 10 };
  const completed: string[] = [];
  const results = await prepareRankedSubtitleCandidates(
    ["first", "second", "third", "fourth"],
    async (candidate) => {
      await new Promise((resolve) => setTimeout(resolve, delays[candidate]));
      completed.push(candidate);
      return fakePrepared(candidate);
    },
  );

  assert.deepEqual(completed, ["second", "third", "first"]);
  assert.deepEqual(
    results.map((result) => result.candidate),
    ["first", "second", "third"],
  );
  assert.equal(results[0].status, "prepared");
  if (results[0].status === "prepared") assert.equal(results[0].prepared.originalUrl, "first");
});

test("native prepared subtitle files use private per-file storage and startup recovery", () => {
  const prepareSource = readFileSync(
    new URL("../src/lib/subtitles/prepare.ts", import.meta.url),
    "utf8",
  );
  const pruneSource = readFileSync(
    new URL("../src-tauri/src/temp_prune.rs", import.meta.url),
    "utf8",
  );

  assert.match(prepareSource, /mode:\s*0o700/);
  assert.match(prepareSource, /createNew:\s*true,\s*mode:\s*0o600/);
  assert.match(prepareSource, /fs\.remove\(privateDir,\s*\{\s*recursive:\s*true\s*\}\)/);
  assert.match(pruneSource, /sweep_prepared_subtitles\(&dir\)/);
});
