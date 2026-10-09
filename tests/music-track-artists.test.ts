import { artistCreditParts } from "../src/lib/music/search-artists";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/views/music/music-detail-data.ts", import.meta.url),
  "utf8",
);
const identityKey = (name: string) =>
  name.normalize("NFKC").trim().toLowerCase().replace(/[ ]+/g, " ");
function load(profile: any, search: any, authority: any = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  const identity = {
    artistIdentityKey: identityKey,
    identityForRef: async (ref: any) => ref,
    resolveArtist: async () => ({
      clusters: [],
      canonical: null,
      ambiguous: false,
      measured: false,
      key: "",
    }),
    ...authority,
  };
  new Function("require", "module", "exports", output)(
    (id: string) =>
      id.includes("search-artists")
        ? { artistCreditParts }
        : id.includes("artist-authority")
          ? identity
          : id.includes("recording-profile")
            ? { loadRecordingProfile: async () => profile }
            : id.includes("/catalog")
              ? { searchTyped: search }
              : {},
    module,
    module.exports,
  );
  return module.exports as typeof import("../src/views/music/music-detail-data");
}
const person = (name: string, id: string) => ({ name, id, connectorId: "catalog" });
test("collaboration resolves individual artist cards through the one authority", async () => {
  const names = ["Tame Impala", "JENNIE"];
  const people = names.map((n, i) => person(n, `deezer:artist:${i}`));
  const calls: string[] = [];
  const enriched: string[] = [];
  const api = load(
    { primaryArtist: people[0], credits: people.map((artist) => ({ name: artist.name, artist })) },
    async (name: string) => {
      calls.push(name);
      return { artists: [], albums: [], tracks: [] };
    },
    {
      identityForRef: async (ref: any) => {
        enriched.push(ref.id);
        return { ...ref, artwork: "portrait" };
      },
    },
  );
  const result = await api.loadDetailRows({
    kind: "track",
    id: "song",
    connectorId: "catalog",
    title: "Dracula",
    artist: names.join(" & "),
  } as any);
  assert.deepEqual(
    result.rows[0].items.map((p: any) => p.name),
    names,
  );
  assert.ok(result.rows[0].items.every((p: any) => p.artwork === "portrait"));
  assert.deepEqual(
    enriched,
    people.map((p) => p.id),
  );
  assert.deepEqual(calls, [names.join(" & ")]);
});
test("verified band names containing ampersands stay intact", async () => {
  const band = person("Simon & Garfunkel", "deezer:artist:9");
  const api = load(
    { primaryArtist: band, credits: [{ name: band.name, artist: band }] },
    async () => ({ artists: [], albums: [], tracks: [] }),
  );
  const result = await api.loadDetailRows({
    kind: "track",
    id: "song",
    connectorId: "catalog",
    title: "The Boxer",
    artist: band.name,
  } as any);
  assert.deepEqual(
    result.rows[0].items.map((p: any) => p.name),
    [band.name],
  );
});

test("an unknown credit resolves through the authority, never a private catalog lookup", async () => {
  const api = load(
    { primaryArtist: { name: "Other" }, credits: [] },
    async () => ({ artists: [], albums: [], tracks: [] }),
    {
      resolveArtist: async (name: string) => ({
        key: name,
        clusters: [],
        ambiguous: false,
        measured: true,
        canonical: { id: "deezer:artist:12431462", connectorId: "catalog", name, artwork: "real" },
      }),
    },
  );
  const result = await api.loadDetailRows({
    kind: "track",
    id: "song",
    connectorId: "catalog",
    title: "Crazy Story",
    artist: "King Von",
  } as any);
  assert.deepEqual(
    result.rows[0].items.map((p: any) => p.id),
    ["deezer:artist:12431462"],
  );
});
