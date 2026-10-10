import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type MetadataModule = typeof import("../src/lib/music/release-metadata.ts");

function metadata(fetcher: typeof fetch) {
  const source = readFileSync(
    new URL("../src/lib/music/release-metadata.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.equal(name, "@/lib/safe-fetch");
      return { safeFetch: fetcher };
    },
    module,
    module.exports,
  );
  return module.exports as MetadataModule;
}

const track = { id: "deezer:track:21", kind: "track", connectorId: "catalog" } as const;

test("only exact Deezer entity IDs fetch metadata", async () => {
  let calls = 0;
  const client = metadata(async () => {
    calls++;
    throw new Error("unexpected request");
  });
  for (const item of [
    { ...track, connectorId: "spotify" },
    { ...track, id: "spotify:track:21" },
    { ...track, id: "deezer:album:21" },
    { ...track, id: "deezer:track:../artist/21" },
    { ...track, id: "deezer:track:9007199254740993" },
  ])
    assert.equal(await client.loadMusicReleaseMetadata(item), null);
  assert.equal(calls, 0);
});

test("track metadata uses only its explicitly linked album, preserving track credits and date", async () => {
  const calls: string[] = [];
  const client = metadata(async (input, options) => {
    assert.ok(options?.signal);
    calls.push(String(input));
    return Response.json(
      String(input).endsWith("/track/21")
        ? {
            id: 21,
            type: "track",
            release_date: "2001-03-12",
            explicit_lyrics: false,
            contributors: [{ id: 4, name: "Track artist" }],
            album: { id: 31 },
          }
        : {
            id: 31,
            type: "album",
            release_date: "2001-03-07",
            label: "Actual label",
            contributors: [{ id: 9, name: "Different album contributor" }],
            genres: { data: [{ id: 106, name: "Electro" }] },
            explicit_lyrics: true,
          },
    );
  });
  const details = await client.loadMusicReleaseMetadata(track);
  assert.equal(details?.releaseDate, "2001-03-12");
  assert.equal(details?.recordLabel, "Actual label");
  assert.deepEqual(details?.genres, ["Electro"]);
  assert.deepEqual(details?.contributors, ["Track artist"]);
  assert.equal(details?.explicit, false);
  assert.deepEqual(calls, ["https://api.deezer.com/track/21", "https://api.deezer.com/album/31"]);
  assert.deepEqual(await client.loadMusicReleaseMetadata(track), details);
  assert.equal(calls.length, 2, "valid entity responses are reused from the bounded cache");
});

test("mismatched IDs, wrong types, and API error bodies are rejected without caching", async () => {
  const replies = [
    { id: 22, type: "track" },
    { id: 21, type: "album" },
    { id: 21, type: "track", error: { code: 800 } },
    { id: 21, type: "track", release_date: "2020-02-29" },
  ];
  const client = metadata(async () => Response.json(replies.shift()));
  for (let index = 0; index < 3; index++)
    await assert.rejects(client.loadMusicReleaseMetadata(track));
  assert.equal((await client.loadMusicReleaseMetadata(track))?.releaseDate, "2020-02-29");
});

test("missing optional album metadata preserves the verified track response", async () => {
  const client = metadata(async (input) =>
    Response.json(
      String(input).endsWith("/track/21")
        ? { id: 21, type: "track", release_date: "2024-05-01", album: { id: 31 } }
        : { id: 99, type: "album", label: "Unrelated label" },
    ),
  );
  const details = await client.loadMusicReleaseMetadata(track);
  assert.equal(details?.releaseDate, "2024-05-01");
  assert.equal(details?.recordLabel, undefined);
  assert.deepEqual(details?.genres, []);
});

test("artist fans and album totals are explicit provider counts, with zero preserved", () => {
  const client = metadata(async () => {
    throw new Error("not called");
  });
  const details = client.parseMusicReleaseMetadata(
    {
      id: 27,
      type: "artist",
      nb_album: 0,
      nb_fan: 5205229,
      rank: 810329,
      monthly_listeners: 999,
    },
    { id: "deezer:artist:27", kind: "artist", connectorId: "catalog" },
  );
  assert.equal(details?.albumCount, 0);
  assert.equal(details?.fanCount, 5205229);
  assert.equal(Object.hasOwn(details!, "monthlyListeners"), false);
});

test("malformed dates, strings masquerading as flags, and invalid counts remain absent", () => {
  const client = metadata(async () => {
    throw new Error("not called");
  });
  const details = client.parseMusicReleaseMetadata(
    {
      id: 21,
      type: "track",
      release_date: "2024-02-30",
      explicit_lyrics: "true",
      contributors: [
        { id: 0, name: "Unknown" },
        { id: 5, name: "Credit" },
        { id: 5, name: "Credit" },
      ],
    },
    track,
  );
  assert.equal(details?.releaseDate, undefined);
  assert.equal(details?.explicit, undefined);
  assert.deepEqual(details?.contributors, ["Credit"]);
});

test("aborted late responses cannot populate the cache or return stale metadata", async () => {
  let release!: () => void;
  let calls = 0;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = metadata(async () => {
    calls++;
    if (calls === 1) await waiting;
    return Response.json({ id: 21, type: "track", release_date: "2024-01-01" });
  });
  const controller = new AbortController();
  const pending = client.loadMusicReleaseMetadata(track, controller.signal);
  controller.abort();
  release();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal((await client.loadMusicReleaseMetadata(track))?.releaseDate, "2024-01-01");
  assert.equal(calls, 2);
});
