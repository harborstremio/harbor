import assert from "node:assert/strict";
import test from "node:test";
import { namedPage } from "../src/lib/streams/plugins/extension/run.ts";
import { listingTitle } from "../src/lib/streams/plugins/extension/listing.ts";
import type { StreamPluginRequest } from "../src/lib/streams/plugins/types.ts";

const req = (over: Partial<StreamPluginRequest> = {}): StreamPluginRequest => ({
  type: "series",
  id: "capstan:ext/provider:https%3A%2F%2Fp.example%2Fshow%2F",
  ids: ["capstan:ext/provider:https%3A%2F%2Fp.example%2Fshow%2F:1:1"],
  imdbId: null,
  tmdb: null,
  title: "Slow Horses",
  year: 2022,
  season: 1,
  episode: 1,
  absoluteEpisode: null,
  settings: {},
  ...over,
});

const PAGE = "https://p.example/show/";
const LISTED = { url: PAGE, providerId: "ext/provider" };

test("a row's own page is opened by the provider that listed it, and by no other", () => {
  assert.equal(namedPage(req(LISTED), "ext/provider"), PAGE);
  // The same plugin can carry several providers; the page belongs to one of them.
  assert.equal(namedPage(req(LISTED), "ext/other"), undefined);
  // Without a url there is nothing to open, whatever the provider.
  assert.equal(namedPage(req({ providerId: "ext/provider" }), "ext/provider"), undefined);
  assert.equal(namedPage(req({ url: PAGE }), "ext/provider"), undefined);
});

test("anything that is not a web page is not treated as one", () => {
  for (const url of ["", "   ", "ftp://p.example/x", "magnet:?xt=urn:btih:" + "0".repeat(40), "not a url"]) {
    assert.equal(namedPage(req({ url, providerId: "ext/provider" }), "ext/provider"), undefined, url);
  }
});

test("a row's title is taken back out of the release notes it was named after", () => {
  // The real shape: a whole season range, audio, quality and size, all in the name.
  assert.equal(
    listingTitle(
      "Slow Horses (Season 1-6) [E02 Added] {English With Subtitles} [Hindi Subs] WeB-DL 720p 10Bit [300MB] || 1080p [1.5GB]",
    ),
    "Slow Horses",
  );
  assert.equal(listingTitle("Slow Horses S01 1080p"), "Slow Horses");
  assert.equal(listingTitle("Dune: Part Two (2024) 2160p"), "Dune: Part Two");
  assert.equal(listingTitle("Breaking Bad S05E14"), "Breaking Bad");
});

test("a name that is only a title is left exactly as it is", () => {
  for (const name of ["Breaking Bad", "Se7en", "The English", "Dune: Part Two", "1923"]) {
    assert.equal(listingTitle(name), name, name);
  }
  assert.equal(listingTitle(""), "");
  assert.equal(listingTitle("   "), "");
});

test("a cut that would leave nothing is refused rather than guessed at", () => {
  // Brackets that open the title rather than end it.
  for (const name of ["(500) Days of Summer", "[REC]", "{Proof}"]) {
    assert.equal(listingTitle(name), name, name);
  }
});
