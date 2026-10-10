import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadSpooktoberMusic, spooktoberAsset, spooktoberSongToTrack } from "../src/views/spooktober/spooktober-music.ts";

test("festival tracks retain catalog identity and never bypass source resolution with previews", () => {
  const song = { id: "music-1485823641", title: "witchblades", creator: "Lil Peep & Lil Tracy", album: "EVERYBODY’S EVERYTHING", duration: 150, poster: "assets/music/music-1485823641.jpg", preview: "https://example.com/preview.m4a", explicit: true };
  const track = spooktoberSongToTrack(song);
  assert.equal(track.id, "itunes:track:1485823641");
  assert.equal(track.connectorId, "catalog");
  assert.equal(track.sourceId, "1485823641");
  assert.equal(track.durationLabel, "2:30");
  assert.equal(track.explicit, true);
  assert.equal(track.artwork, "/spooktober/assets/music/music-1485823641.jpg");
  assert.equal(track.playbackUrl, undefined);
  assert.equal("preview" in track, false);
  assert.equal(spooktoberAsset(track.artwork), track.artwork);
});

test("catalog loading retries a failure, shares concurrent reads, and preserves playlist order", async () => {
  const fetchOriginal = globalThis.fetch;
  let calls = 0;
  const song = { id: "music-7", title: "Song", creator: "Artist", poster: "assets/music/7.jpg" };
  try {
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(loadSpooktoberMusic());
    globalThis.fetch = async (url) => {
      calls++;
      return Response.json(String(url).endsWith("playlist-data.json")
        ? [{ id: "dark", title: "After dark", art: [], coverIds: [], songIds: [song.id] }]
        : [song]);
    };
    const [first, second] = await Promise.all([loadSpooktoberMusic(), loadSpooktoberMusic()]);
    assert.equal(calls, 2);
    assert.equal(first, second);
    assert.deepEqual(first.playlists[0].songIds, [song.id]);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("all shipped locales include translated festival controls and playlist descriptions", async () => {
  const locales = ["en", "ar", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ru", "tr", "vi", "zh"];
  const english = (await import("../src/lib/i18n/locales/en/spooktober.ts")).default;
  assert.equal(Object.keys(english).length, 28);
  for (const locale of locales) {
    const strings = (await import(`../src/lib/i18n/locales/${locale}/spooktober.ts`)).default;
    assert.deepEqual(Object.keys(strings), Object.keys(english), locale);
    for (const [key, value] of Object.entries(strings)) {
      assert.equal(typeof value, "string");
      assert.ok(value, `${locale}: ${key}`);
      if (locale !== "en") assert.notEqual(value, english[key], `${locale}: ${key}`);
    }
    const runtime = await readFile(new URL(`../src/lib/i18n/locales/${locale}.ts`, import.meta.url), "utf8");
    assert.match(runtime, /\.\.\.spooktober,/);
  }
});
