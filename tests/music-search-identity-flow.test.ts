import test from "node:test";
import assert from "node:assert/strict";
import type { MusicArtistRef } from "../src/lib/music/types";

const host = { location: { hostname: "harbor.local" } };
(globalThis as unknown as { window: typeof host }).window = host;

const { DEEZER_DRAKE, DEEZER_VON } = await import("./fixtures/deezer-namesakes");
const { DEEZER_KING_VON_SEARCH } = await import("./fixtures/deezer-king-von");
const { collapseArtistRows } = await import("../src/lib/music/search-artists");
const { artistIdentityKey, peekArtistIdentity, primeArtistCandidates, resolveArtist } =
  await import("../src/lib/music/artist-authority");

const LOCALE = "en-US";
const FANS = "Deezer fans";
const calls: string[] = [];

(globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
  const asked = String(url);
  calls.push(asked);
  const query = decodeURIComponent(asked);
  const body = /q=von&/i.test(asked)
    ? DEEZER_VON
    : /Drake/i.test(query)
      ? DEEZER_DRAKE
      : DEEZER_KING_VON_SEARCH;
  return { ok: true, status: 200, json: async () => body };
};

type Row = { id: number; name: string; picture_xl?: string };

const refsFor = (rows: Row[]): MusicArtistRef[] =>
  rows.map((row) => ({
    id: `deezer:artist:${row.id}`,
    connectorId: "catalog",
    name: row.name,
    artwork: row.picture_xl,
  }));

function panelPass(query: string, artists: MusicArtistRef[]) {
  const groups = new Map<string, MusicArtistRef[]>();
  for (const artist of artists) {
    const key = artistIdentityKey(artist.name);
    const group = groups.get(key);
    if (group) group.push(artist);
    else groups.set(key, [artist]);
  }
  const own = artistIdentityKey(query);
  for (const [key, refs] of groups) if (key !== own) primeArtistCandidates(key, refs);
  return {
    own,
    settled: resolveArtist(query, { hint: groups.get(own) ?? [] }),
    rows: () => collapseArtistRows(artists, LOCALE, FANS, own),
  };
}

test("a provider artist row carries no popularity of its own, which is why the probe must run", () => {
  for (const row of DEEZER_KING_VON_SEARCH.data) assert.equal("position" in row, false);
  const refs = refsFor(DEEZER_KING_VON_SEARCH.data);
  assert.ok(refs.every((ref) => ref.subtitle === undefined));
});

test("a search for a prefix never decides the next search", async () => {
  const prefix = panelPass("von", refsFor(DEEZER_VON.data));
  await prefix.settled;
  assert.equal(peekArtistIdentity("King Von").probed, false);
  const exact = panelPass("King Von", refsFor(DEEZER_KING_VON_SEARCH.data));
  assert.equal(exact.rows().filter((row) => artistIdentityKey(row.name) === "king von").length, 0);
  await exact.settled;
  const shown = exact.rows().filter((row) => artistIdentityKey(row.name) === "king von");
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, "deezer:artist:12431462");
  assert.equal(calls.filter((url) => /q=King%20Von&/i.test(url)).length, 1);
  assert.ok(!calls.some((url) => url.includes("musicbrainz")));
});

test("the suggest dropdown holds an unresolved namesake group and spends one request on it", async () => {
  const drakes = refsFor(DEEZER_DRAKE.data);
  const key = artistIdentityKey("Drake");
  const named = drakes.filter((ref) => artistIdentityKey(ref.name) === key);
  assert.equal(named.length, 4);
  assert.equal(peekArtistIdentity("Drake").probed, false);
  const cold = collapseArtistRows(drakes, LOCALE, FANS, key);
  assert.equal(cold.filter((row) => artistIdentityKey(row.name) === key).length, 0);
  assert.ok(cold.length > 0);
  await resolveArtist(named[0].name, { hint: named });
  const warm = collapseArtistRows(drakes, LOCALE, FANS, key).filter(
    (row) => artistIdentityKey(row.name) === key,
  );
  assert.equal(warm.length, 1);
  assert.equal(warm[0].id, "deezer:artist:246791");
  assert.equal(calls.filter((url) => /q=Drake&/i.test(url)).length, 1);
});

test("a browse panel whose query names no artist holds nothing back", () => {
  const rows = collapseArtistRows(
    refsFor(DEEZER_KING_VON_SEARCH.data),
    LOCALE,
    FANS,
    artistIdentityKey("drill"),
  );
  const keys = new Set(DEEZER_KING_VON_SEARCH.data.map((row) => artistIdentityKey(row.name)));
  assert.equal(rows.length, keys.size);
  const exact = rows.filter((row) => artistIdentityKey(row.name) === "king von");
  assert.equal(exact.length, 1);
  assert.equal(exact[0].id, "deezer:artist:12431462");
});
