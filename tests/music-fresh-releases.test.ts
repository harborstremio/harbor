import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { withTimeout } from "../src/lib/progressive-rows.ts";
import { isRecentRelease } from "../src/lib/music/release-recency.ts";
import { normalizeName, normalizeTitle } from "../src/lib/music/search-normalize.ts";
import { musicTrackCredit } from "../src/lib/music/track-identity.ts";

function load(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(new URL(`../src/lib/music/${file}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)((name: string) => {
    assert.ok(name in modules, `Unexpected dependency ${name}`);
    return modules[name];
  }, module, module.exports);
  return module.exports;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function flush() { for (let n = 0; n < 35; n++) await Promise.resolve(); }
const track = (title: string, artist = "Artist A", id = title) => ({ id, title, artist, connectorId: "catalog" });
function fresh(loadArtistFreshTracks: (artist: string) => Promise<unknown[]>) {
  return load("sources", {
    "./source-version": { compatibleVocalVersion: () => true },
    "@tauri-apps/api/core": { invoke: () => { throw Error("Must not replace releases with ordinary search"); } },
    "@/lib/progressive-rows": { withTimeout },
    "./artist-releases": { loadArtistFreshTracks },
    "./preferences": {},
    "./search-artists": { artistCreditParts: (name: string) => [name] },
    "./search-normalize": { normalizeName, normalizeTitle },
    "./track-identity": { musicTrackCredit },
  });
}

test("fresh results arrive before a slow artist and survive another artist failing", async () => {
  const slow = deferred<unknown[]>();
  const updates: any[][] = [];
  const api = fresh(async name => name === "Artist A" ? [track("New A")]
    : name === "Artist B" ? slow.promise : Promise.reject(Error("offline")));
  const pending = api.loadFreshFromArtists([track("Heard A"), track("Heard B", "Artist B"), track("Heard C", "Artist C")], 9, (tracks: any[]) => updates.push(tracks));
  await flush();
  assert.deepEqual(updates[0].map(t => t.title), ["New A"]);
  slow.resolve([track("New B", "Artist B")]);
  assert.deepEqual((await pending).map((t: any) => t.title), ["New A", "New B"]);
});

test("empty catalogs stay empty without an undated song-search fallback; complete outage is retryable", async () => {
  assert.deepEqual(await fresh(async () => []).loadFreshFromArtists([track("Heard")]), []);
  await assert.rejects(fresh(async () => { throw Error("timeout"); }).loadFreshFromArtists([track("Heard")]), /unavailable/);
});

test("heard recordings and duplicate editions are excluded across provider IDs", async () => {
  const api = fresh(async () => [track("Heard", "Artist A", "other-source"), track("New", "Artist A", "1"), track("New", "Artist A", "2")]);
  assert.deepEqual((await api.loadFreshFromArtists([track("Heard")])).map((t: any) => t.id), ["1"]);
});

test("checks beyond three favourite artists without increasing catalog concurrency", async () => {
  let active = 0, peak = 0;
  const checked: string[] = [];
  const api = fresh(async name => {
    checked.push(name); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve)); active--;
    return name === "S3RL" ? [track("New single", name)] : [];
  });
  const recents = [...Array.from({ length: 12 }, (_, n) => track("Old song", `Artist ${n}`)), track("Past single", "S3RL")];
  const result = await api.loadFreshFromArtists(recents);
  assert.equal(checked.length, 13);
  assert.equal(result[0].artist, "S3RL");
  assert.ok(peak <= 3);
});

test("uses the recording's actual artist when a playback source names an uploader", async () => {
  const checked: string[] = [];
  const api = fresh(async name => { checked.push(name); return []; });
  await api.loadFreshFromArtists([{ ...track("Upload", "Some channel"), collectionOrigin: { title: "Song", artist: "Lil Peep" } }]);
  assert.deepEqual(checked, ["Lil Peep"]);
});

test("partial failures with no releases are retryable instead of claiming there are none", async () => {
  const api = fresh(async name => name === "Artist A" ? [] : Promise.reject(Error("offline")));
  await assert.rejects(api.loadFreshFromArtists([track("One"), track("Two", "Artist B")]), /unavailable/);
});

function artistClient(fetcher: typeof fetch, resolveArtist = async () => ({ canonical: { id: "deezer:artist:1" } })) {
  return load("artist-releases", {
    "@/lib/safe-fetch": { safeFetch: fetcher }, "@/lib/progressive-rows": { withTimeout },
    "./artist-authority": { resolveArtist }, "./search-normalize": { normalizeName },
    "./release-recency": { isRecentRelease },
  });
}
const date = () => new Date().toISOString().slice(0, 10);
const releases = () => ({ data: [{ id: 7, title: "New release", release_date: date(), cover_big: "https://example.test/cover.jpg" }], total: 1 });
const album = () => ({ id: 7, tracks: { data: [
  { id: 11, title: "New song", artist: { name: "Artist A" }, duration: 180 },
  { id: 12, title: "Second song", artist: { name: "Artist A" }, duration: 160 },
] } });

test("a catalog taking over five seconds still succeeds and concurrent/remounted requests share work", async ctx => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = deferred<Response>();
  const calls: string[] = [];
  const api = artistClient(async url => {
    calls.push(String(url));
    return String(url).includes("/albums?") ? pending.promise : Response.json(album());
  });
  const first = api.loadArtistFreshTracks("Artist A", 1);
  const second = api.loadArtistFreshTracks("artist a", 9);
  await flush();
  ctx.mock.timers.tick(6_000);
  pending.resolve(Response.json(releases()));
  assert.equal((await first).length, 1);
  assert.equal((await second).length, 2);
  assert.equal(calls.length, 2);
  assert.equal((await api.loadArtistFreshTracks("Artist A", 9)).length, 2);
  assert.equal(calls.length, 2, "no new requests during the cache window");
});

test("invalid, future, old and unavailable recordings are not presented as fresh", async () => {
  const api = artistClient(async url => Response.json(String(url).includes("/albums?") ? {
    data: [...releases().data, { id: 8, title: "Old", release_date: "2000-01-01" }, { id: 9, title: "Future", release_date: "2099-01-01" }], total: 3,
  } : { tracks: { data: [
    { id: 20, title: "No duration", artist: { name: "Artist A" }, duration: 0 },
    { id: 21, title: "Unavailable", artist: { name: "Artist A" }, duration: 180, readable: false },
    ...album().tracks.data,
  ] } }));
  const result = await api.loadArtistFreshTracks("Artist A", 9);
  assert.equal(result.length, 2);
  assert.ok(result.every((t: any) => t.releaseDate === date() && t.durationSeconds > 0 && t.artwork));
});

test("collaborative singles verify track credits when album summaries name only the lead artist", async () => {
  const calls: string[] = [];
  const api = artistClient(async url => {
    calls.push(String(url));
    return Response.json(String(url).includes("/albums?") ? releases()
      : String(url).includes("/track/") ? { id: 11, title: "Collaboration", artist: { name: "Lead artist" }, duration: 180, contributors: [{ name: "Lead artist" }, { name: "Artist A" }] }
      : { contributors: [{ name: "Artist A" }], tracks: { data: [{ id: 11, title: "Collaboration", artist: { name: "Lead artist" }, duration: 180 }] } });
  });
  const result = await api.loadArtistFreshTracks("Artist A", 9);
  assert.equal(result.length, 1);
  assert.equal(result[0].artist, "Lead artist, Artist A");
  assert.equal(calls.filter(url => url.includes("/track/")).length, 1);
});

test("hung artist work is bounded and aborted, and a later retry can recover", async ctx => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });
  const hung = deferred<Response>();
  let broken = true;
  let signal: AbortSignal | undefined;
  const api = artistClient(async (url, init) => {
    if (broken) { signal = init?.signal as AbortSignal; return hung.promise; }
    return Response.json(String(url).includes("/albums?") ? releases() : album());
  });
  const pending = api.loadArtistFreshTracks("Artist A", 9);
  const rejected = assert.rejects(pending, /timed out/);
  await flush();
  ctx.mock.timers.tick(25_000);
  await rejected;
  assert.equal(signal?.aborted, true);
  hung.resolve(Response.json(releases()));
  await flush();
  broken = false;
  assert.equal((await api.loadArtistFreshTracks("Artist A", 9)).length, 2);
});

test("an unresponsive authority lookup falls back to the bounded artist catalog lookup", async ctx => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });
  const calls: string[] = [];
  const api = artistClient(async url => {
    calls.push(String(url));
    return Response.json(String(url).includes("search/artist") ? { data: [{ id: 1, name: "Artist A", nb_fan: 100 }] }
      : String(url).includes("/albums?") ? releases() : album());
  }, () => new Promise(() => {}));
  const pending = api.loadArtistFreshTracks("Artist A", 9);
  ctx.mock.timers.tick(8_000);
  assert.equal((await pending).length, 2);
  assert.equal(calls.length, 3);
});
