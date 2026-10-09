import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const id = "63aa26c3-d59b-4da4-84ac-716b54f1ef4d";
const artist = {
  id: "deezer:artist:134790",
  connectorId: "catalog",
  name: "Tame Impala",
  artwork: "",
};
const profile = {
  id,
  name: "Tame Impala",
  type: "Group",
  area: { name: "Australia" },
  "life-span": { begin: "2007" },
  genres: [{ name: "psychedelic rock", count: 5 }],
  relations: [
    { type: "free streaming", url: { resource: "https://www.deezer.com/artist/134790" } },
    {
      type: "free streaming",
      url: { resource: "https://open.spotify.com/artist/5INjqkS1o8h1imAzPqGZBb" },
    },
    { type: "merchandise", url: { resource: "https://artist.example/shop" } },
    { type: "official homepage", url: { resource: "https://artist.example/" } },
  ],
};
function client(fetcher: (url: string) => Promise<unknown>) {
  const modules: Record<string, any> = {
    "./recording-profile": { scheduleMusicBrainzRequest: (task: () => Promise<unknown>) => task() },
    "@/lib/safe-fetch": {
      safeFetch: async (url: string) => ({ ok: true, json: () => fetcher(url) }),
    },
    "./artist-authority": {
      artistIdentityKey: (name: string) =>
        name.normalize("NFKC").trim().toLowerCase().replace(/[ ]+/g, " "),
    },
  };
  for (const name of ["release-metadata", "source-link", "artist-profile"]) {
    const input = readFileSync(new URL(`../src/lib/music/${name}.ts`, import.meta.url), "utf8");
    const output = ts.transpileModule(input, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", output)(
      (key: string) => {
        assert.ok(key in modules, key);
        return modules[key];
      },
      module,
      module.exports,
    );
    modules[`./${name}`] = module.exports;
  }
  return modules["./artist-profile"] as typeof import("../src/lib/music/artist-profile.ts");
}
test("verified artist links merge source identities without merging same-name strangers", async () => {
  const c = client(async (url) =>
    url.includes("/url?") ? { relations: [{ artist: { id } }] } : profile,
  );
  const first = await c.loadArtistProfile(artist);
  const second = await c.loadArtistProfile({
    id: "spotify:artist:5INjqkS1o8h1imAzPqGZBb",
    connectorId: "spotify",
    name: "Tame Impala",
  });
  assert.equal(first?.id, id);
  assert.equal(second?.id, id);
  assert.ok(first?.sources.some((source) => source.id === artist.id));
  assert.ok(first?.sources.some((source) => source.id === "spotify:artist:5INjqkS1o8h1imAzPqGZBb"));
  const unrelated = c.parseArtistProfile({ ...profile, id: "wrong" }, id);
  assert.equal(unrelated, null);
});
test("artist URL lookup outage falls back only to candidates with exact provider links", async () => {
  const c = client(async (url) => {
    if (url.includes("/url?")) throw new Error("503");
    if (url.includes("artist?")) return { artists: [{ id, name: artist.name }] };
    return profile;
  });
  const value = await c.loadArtistProfile(artist);
  assert.equal(value?.id, id);
  const other = client(async (url) =>
    url.includes("/url?")
      ? { relations: [] }
      : url.includes("artist?")
        ? { artists: [{ id, name: artist.name }] }
        : { ...profile, relations: [] },
  );
  assert.equal(await other.loadArtistProfile(artist), null);
});
test("merch rejects executable, local, retired and ended destinations", () => {
  const c = client(async () => profile);
  const value = c.parseArtistProfile(
    {
      ...profile,
      relations: [
        ...profile.relations,
        { type: "merchandise", url: { resource: "javascript:alert(1)" } },
        { type: "merchandise", url: { resource: "http://127.0.0.1/private" } },
        { type: "merchandise", ended: true, url: { resource: "https://old.example/" } },
        {
          type: "purchase for download",
          url: { resource: "https://play.google.com/store/music/artist?id=x" },
        },
      ],
    },
    id,
  )!;
  assert.deepEqual(
    value.links.filter((link) => link.kind === "merch").map((link) => link.url),
    ["https://artist.example/shop"],
  );
  assert.equal(value.links.length, 4);
});

test("provider buttons deduplicate services while preserving cross-source identity links", () => {
  const c = client(async () => profile);
  const value = c.parseArtistProfile(
    {
      ...profile,
      relations: [
        ...profile.relations,
        { type: "free streaming", url: { resource: "https://open.spotify.com/artist/another" } },
        { type: "free streaming", url: { resource: "https://www.deezer.com/en/artist/134790" } },
        { type: "free streaming", url: { resource: "https://www.deezer.com/artist/2" } },
      ],
    },
    id,
  )!;
  assert.equal(value.links.filter((link) => link.name === "Spotify").length, 1);
  assert.equal(value.links.filter((link) => link.name === "Deezer").length, 1);
  assert.ok(value.sources.some((source) => source.id === "deezer:artist:2"));
});
