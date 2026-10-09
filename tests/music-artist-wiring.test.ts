import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../src", import.meta.url));
const musicRoots = [
  join(root, "lib", "music"),
  join(root, "views", "music"),
  join(root, "views", "music.tsx"),
];
const CATALOG_FORCED = /searchTyped\([^;]*?["'`]catalog["'`]/;
const AUTHORITY = join("lib", "music", "artist-authority.ts");
const ALLOWED_OUTSIDE_AUTHORITY = new Map([
  [
    join("lib", "music", "discovery-billboard.ts"),
    'const result=await searchTyped(`${item.title} ${item.artist}`,32,"catalog");',
  ],
]);

function walk(target: string): string[] {
  if (statSync(target).isFile()) return /\.tsx?$/.test(target) ? [target] : [];
  return readdirSync(target).flatMap((entry) => walk(join(target, entry)));
}

const sourceFiles = walk(root).map((path) => ({
  path: relative(root, path),
  text: readFileSync(path, "utf8"),
}));
const musicFiles = sourceFiles.filter((file) =>
  musicRoots.some((dir) => join(root, file.path).startsWith(dir)),
);

test("the deleted private artist resolvers exist nowhere under src", () => {
  assert.ok(
    sourceFiles.length > 50,
    `expected a real source tree, saw ${sourceFiles.length} files`,
  );
  for (const name of ["resolveArtistCredit", "strongestArtistCredit", "canonicalArtist"]) {
    const offenders = sourceFiles
      .filter((file) => file.text.includes(name))
      .map((file) => file.path);
    assert.deepEqual(offenders, [], `${name} must be deleted, not wrapped`);
  }
});

test("no module forces the catalog connector to resolve an artist except the one authority", () => {
  assert.ok(musicFiles.length > 10, `expected the music tree, saw ${musicFiles.length} files`);
  assert.ok(
    musicFiles.some((file) => file.path === AUTHORITY),
    "artist-authority.ts must be present",
  );
  const offenders: string[] = [];
  for (const file of musicFiles) {
    if (file.path === AUTHORITY) continue;
    const hits = file.text
      .split("\n")
      .filter((line) => CATALOG_FORCED.test(line))
      .map((line) => line.trim());
    const allowed = ALLOWED_OUTSIDE_AUTHORITY.get(file.path);
    for (const hit of hits)
      if (hit.replace(/\s+/g, "") !== allowed?.replace(/\s+/g, ""))
        offenders.push(`${file.path}: ${hit}`);
  }
  assert.deepEqual(offenders, []);
});

test("only the authority asks a provider which artist a name means", () => {
  const offenders = musicFiles
    .filter((file) => file.path !== AUTHORITY && file.text.includes("api.deezer.com/search/artist"))
    .map((file) => file.path);
  assert.deepEqual(offenders, []);
  const authority = musicFiles.find((file) => file.path === AUTHORITY)!;
  assert.ok(
    authority.text.includes("api.deezer.com/search/artist"),
    "the authority must own the probe",
  );
});

test("every artist entry point in the music views goes through the authority", () => {
  const view = sourceFiles.find((file) => file.path === join("views", "music.tsx"))!;
  assert.ok(
    view.text.includes('from "@/lib/music/artist-authority"'),
    "music.tsx must import the authority",
  );
  assert.ok(
    view.text.includes("void resolveArtist(name, { track })"),
    "goToArtist must resolve through the authority",
  );
  assert.ok(
    view.text.includes("void identityForRef(item)"),
    "openItem must enrich through the authority",
  );
  assert.ok(
    !view.text.includes("canonicalArtist("),
    "openItem must not call canonicalArtist on a click path",
  );
  assert.ok(
    !/!item\.musicBrainzId/.test(view.text),
    "the musicBrainzId gate must be gone from openItem",
  );
});

test("the search surfaces never paint an artist row the authority has not ranked", () => {
  const panel = sourceFiles.find(
    (file) => file.path === join("views", "music", "music-search-panel.tsx"),
  )!;
  assert.ok(
    panel.text.includes("artistIdentityKey(query),"),
    "the panel must name the identity it is resolving",
  );
  assert.ok(
    panel.text.includes("setSettled({ results })"),
    "an equal value bails out of React, so settling must be fresh",
  );
  assert.ok(
    !panel.text.includes("setIdentityReady"),
    "the identity gate must not compare a value against itself",
  );
  const suggest = sourceFiles.find(
    (file) => file.path === join("components", "music", "music-search-suggest.tsx"),
  )!;
  assert.ok(
    suggest.text.includes("artistIdentityKey(found.query)"),
    "the dropdown must name the identity it is resolving",
  );
  assert.ok(
    suggest.text.includes("named.length < 2 || peekArtistIdentity(trimmed).probed"),
    "the dropdown may only probe an unresolved namesake group",
  );
});
