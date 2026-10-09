import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type Lyrics = typeof import("../src/lib/music/lyrics.ts");

const KING_VON = [
  "[ar:King Von]",
  "[ti:Evil Twins]",
  "[length:01:56]",
  "",
  "[00:10.98] (TouchofTrent be wildin' with it)",
  "[00:11.81] You want back then? (Let's get it), ayy, Von, tell bro go spin that Benz",
  "[00:15.4]",
  "[00:18] Evil twins",
].join("\n");

function build(safeFetch: (url: string) => Promise<unknown>) {
  const calls: string[] = [];
  const input = readFileSync(new URL("../src/lib/music/lyrics.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.equal(name, "@/lib/safe-fetch");
      return {
        safeFetch: async (url: string) => {
          calls.push(url);
          return safeFetch(url);
        },
      };
    },
    module,
    module.exports,
  );
  return { lyrics: module.exports as Lyrics, calls };
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

const track = (extra: Record<string, unknown> = {}) =>
  ({
    id: "t1",
    title: "Evil Twins",
    artist: "King Von",
    artwork: "",
    durationSeconds: 116,
    durationLabel: "1:56",
    ...extra,
  }) as any;

test("parseLrc reads the real King Von payload and ignores metadata tags", () => {
  const { lyrics } = build(async () => ok(null));
  const lines = lyrics.parseLrc(KING_VON);
  assert.deepEqual(lines, [
    { at: 10.98, text: "(TouchofTrent be wildin' with it)" },
    { at: 11.81, text: "You want back then? (Let's get it), ayy, Von, tell bro go spin that Benz" },
    { at: 15.4, text: "" },
    { at: 18, text: "Evil twins" },
  ]);
});

test("parseLrc expands multiple timestamps on one line and sorts out-of-order stamps", () => {
  const { lyrics } = build(async () => ok(null));
  const lines = lyrics.parseLrc("[00:30.00][00:05.500]Chorus\n[00:20.250]Verse\n");
  assert.deepEqual(lines, [
    { at: 5.5, text: "Chorus" },
    { at: 20.25, text: "Verse" },
    { at: 30, text: "Chorus" },
  ]);
});

test("parseLrc keeps an empty timing mark as a gap and drops junk", () => {
  const { lyrics } = build(async () => ok(null));
  const lines = lyrics.parseLrc("\n[by:someone]\n[01:00.00]\nnot a lyric line\n[01:02]Back in\n");
  assert.deepEqual(lines, [
    { at: 60, text: "" },
    { at: 62, text: "Back in" },
  ]);
});

test("lyricIndexAt is exact at boundaries, -1 before the first line, last after the end", () => {
  const { lyrics } = build(async () => ok(null));
  const lines = lyrics.parseLrc(KING_VON);
  assert.equal(lyrics.lyricIndexAt(lines, 0), -1);
  assert.equal(lyrics.lyricIndexAt(lines, 10.979), -1);
  assert.equal(lyrics.lyricIndexAt(lines, 10.98), 0);
  assert.equal(lyrics.lyricIndexAt(lines, 11.8), 0);
  assert.equal(lyrics.lyricIndexAt(lines, 11.81), 1);
  assert.equal(lyrics.lyricIndexAt(lines, 15.4), 2);
  assert.equal(lyrics.lyricIndexAt(lines, 18), 3);
  assert.equal(lyrics.lyricIndexAt(lines, 999), 3);
  assert.equal(lyrics.lyricIndexAt([], 5), -1);
  assert.equal(lyrics.lyricIndexAt(lines, Number.NaN), -1);
});

test("loadTrackLyrics picks the closest duration, not the first search result", async () => {
  const { lyrics, calls } = build(async () =>
    ok([
      { duration: 240, instrumental: false, syncedLyrics: "[00:01.00]Live version" },
      { duration: 115, instrumental: false, syncedLyrics: "[00:02.00]Studio version" },
      { duration: 180, instrumental: false, syncedLyrics: "[00:03.00]Remix version" },
    ]),
  );
  const lines = await lyrics.loadTrackLyrics(track());
  assert.deepEqual(lines, [{ at: 2, text: "Studio version" }]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith("https://lrclib.net/api/search?"), calls[0]);
  assert.ok(calls[0].includes("artist_name=King%20Von"), calls[0]);
});

test("loadTrackLyrics prefers the exact get endpoint when album and duration are known", async () => {
  const { lyrics, calls } = build(async (url) =>
    url.includes("/api/get?")
      ? ok({ duration: 116, instrumental: false, syncedLyrics: "[00:04.00]Exact match" })
      : ok([]),
  );
  const lines = await lyrics.loadTrackLyrics(track({ album: "Welcome to O'Block", id: "t-get" }));
  assert.deepEqual(lines, [{ at: 4, text: "Exact match" }]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("album_name=Welcome%20to%20O'Block"), calls[0]);
  assert.ok(calls[0].includes("duration=116"), calls[0]);
});

test("loadTrackLyrics falls back to search when the exact lookup misses", async () => {
  const { lyrics, calls } = build(async (url) =>
    url.includes("/api/get?")
      ? { ok: false, json: async () => null }
      : ok([{ duration: 116, instrumental: false, syncedLyrics: "[00:05.00]From search" }]),
  );
  const lines = await lyrics.loadTrackLyrics(track({ album: "Welcome to O'Block", id: "t-miss" }));
  assert.deepEqual(lines, [{ at: 5, text: "From search" }]);
  assert.equal(calls.length, 2);
});

test("loadTrackLyrics returns null for instrumentals and for plain-only lyrics", async () => {
  const instrumental = build(async () =>
    ok([{ duration: 116, instrumental: true, plainLyrics: "" }]),
  );
  assert.equal(await instrumental.lyrics.loadTrackLyrics(track({ id: "t-inst" })), null);

  const plain = build(async () =>
    ok([{ duration: 116, instrumental: false, plainLyrics: "No timing here" }]),
  );
  assert.equal(await plain.lyrics.loadTrackLyrics(track({ id: "t-plain" })), null);
});

test("loadTrackLyrics never throws and caches the negative result", async () => {
  const { lyrics, calls } = build(async () => {
    throw new Error("offline");
  });
  assert.equal(await lyrics.loadTrackLyrics(track({ id: "t-off" })), null);
  assert.equal(await lyrics.loadTrackLyrics(track({ id: "t-off" })), null);
  assert.equal(calls.length, 1);
});

test("loadTrackLyrics caches a hit so scrubbing never refetches", async () => {
  const { lyrics, calls } = build(async () =>
    ok([{ duration: 116, instrumental: false, syncedLyrics: "[00:06.00]Cached" }]),
  );
  const first = await lyrics.loadTrackLyrics(track({ id: "t-cache" }));
  const second = await lyrics.loadTrackLyrics(track({ id: "t-cache" }));
  assert.deepEqual(first, second);
  assert.equal(calls.length, 1);
});
