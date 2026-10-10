import { test } from "node:test";
import assert from "node:assert/strict";

import { listingTitle, readListing } from "../src/lib/streams/plugins/extension/listing";

test("the title is cut where the provider's own detail starts", () => {
  // The real line, as a provider sends it.
  const raw =
    "Zakir Khan: Papa Yaar (2026) WEB-DL Hindi Stand-Up Special and more info ahead";
  assert.equal(readListing(raw).title, "Zakir Khan: Papa Yaar");
  assert.equal(readListing(raw).year, 2026);
  assert.deepEqual(readListing(raw).languages, ["Hindi"]);
  assert.deepEqual(readListing(raw).quality, ["WEB-DL"]);
});

test("everything the title cut off is kept, recognised or not", () => {
  // Nothing is lost to the cut: what a badge cannot read is still there to be shown as it was sent.
  const raw = "Zakir Khan: Papa Yaar (2026) WEB-DL Hindi Stand-Up Special and more info ahead";
  assert.equal(readListing(raw).rest, "(2026) WEB-DL Hindi Stand-Up Special and more info ahead");
});

test("a title with no detail is left whole and yields nothing", () => {
  // Most listings are just a name, and nothing should be invented for them.
  const read = readListing("Fight Club");
  assert.equal(read.title, "Fight Club");
  assert.equal(read.year, null);
  assert.deepEqual(read.languages, []);
  assert.deepEqual(read.quality, []);
  assert.equal(read.rest, "");
});

test("a title that begins with a bracket is not cut into nothing", () => {
  // "(500) Days of Summer" would leave an empty head, so the cut is refused.
  const read = readListing("(500) Days of Summer");
  assert.equal(read.title, "(500) Days of Summer");
});

test("a year in the name is not read as one when there is no detail after the title", () => {
  // 2001: A Space Odyssey is a name, not a year, and its digits are not bracketed.
  assert.equal(readListing("2001: A Space Odyssey").year, null);
});

test("languages are read by whole word, so a provider's own compound name is not one", () => {
  // TamilRockers is a site, not a statement that the file is in Tamil.
  const read = readListing("Leo (2023) 1080p TamilRockers WEB-DL");
  assert.deepEqual(read.languages, [], "TamilRockers is not the language Tamil");
  assert.deepEqual(read.resolutions, ["1080p"], "the resolution is its own answer");
  assert.deepEqual(read.quality, ["WEB-DL"], "and the release is the other");
});

test("a pair of languages written with a hyphen is two languages", () => {
  // Written as one token, neither half is a language on its own. It is read both ways so that a
  // name containing a hyphen — WEB-DL, Blu-Ray, HD-Rip — is still readable as itself.
  assert.deepEqual(readListing("Series (2024) {Hindi-English} 1080p").languages, ["Hindi", "English"]);
  assert.deepEqual(readListing("Film (2024) Hindi-English 1080p").languages, ["Hindi", "English"]);
});

test("an abbreviation is not read as the language it might stand for", () => {
  // HIN, Tam and Org are all abbreviations in use, and the set of them is not knowable from here.
  // A wrong badge is worse than none, so an abbreviation is left in the rest instead.
  const read = readListing("Some Film (2024) HIN DUB 720p");
  assert.deepEqual(read.languages, []);
  assert.match(read.rest, /HIN/);
});

test("several languages are all read, in the order they were written", () => {
  const read = readListing("Baahubali (2015) Telugu + Tamil + Hindi 1080p BluRay");
  assert.deepEqual(read.languages, ["Telugu", "Tamil", "Hindi"]);
  assert.deepEqual(read.resolutions, ["1080p"]);
  assert.deepEqual(read.quality, ["BluRay"]);
});

test("a language written twice is one language", () => {
  const read = readListing("Film (2020) Hindi 720p Hindi");
  assert.deepEqual(read.languages, ["Hindi"]);
});

test("a file that says it has several audio tracks is said to, without inventing which", () => {
  for (const wording of ["Multi Audio", "Multi", "Dual Audio", "MultiAudio"]) {
    assert.deepEqual(readListing(`Film (2020) ${wording} 1080p`).languages, ["Multi audio"], wording);
  }
});

test("languages and quality are told apart when a provider writes both", () => {
  const read = readListing("Vikram (2022) 1080p HEVC Korean Tamil WEB-DL");
  assert.deepEqual(read.languages, ["Korean", "Tamil"]);
  assert.deepEqual(read.resolutions, ["1080p"]);
  // The release is kept. The codec is not: it says what encoded the file rather than how good it
  // is, so it stays in the line the tooltip shows and earns no badge.
  assert.deepEqual(read.quality, ["WEB-DL"]);
  assert.match(read.rest, /HEVC/, "but the codec is still in the raw line");
});

test("one resolution however the provider writes it, and they are counted", () => {
  // 2160p, 4K and UHD are the same answer, so a line naming two of them is one tier, not two.
  for (const wording of ["2160p", "4K", "UHD", "2160p 4K UHD"]) {
    assert.deepEqual(readListing(`Film (2024) ${wording} WEB-DL`).resolutions, ["4K"], wording);
  }
  assert.deepEqual(readListing("Film (2024) 8K WEB-DL").resolutions, ["8K"]);
  assert.deepEqual(readListing("Film (2024) 1080p WEB-DL").resolutions, ["1080p"]);
});

test("every resolution is kept, best first, so the poster can count the rest", () => {
  // A provider names every quality one listing carries. The poster shows the best few and says how
  // many more there are, so all of them are kept here rather than collapsed to the best.
  assert.deepEqual(readListing("Film (2024) 480p 720p 1080p").resolutions, [
    "1080p",
    "720p",
    "480p",
  ]);
  assert.deepEqual(readListing("Film (2024) 480p & 720p & 1080p").resolutions, [
    "1080p",
    "720p",
    "480p",
  ]);
  assert.deepEqual(readListing("Film (2024) 1080p 480p 4K").resolutions, ["4K", "1080p", "480p"]);
  assert.deepEqual(readListing("Film (2024) 2160p 4K 1080p").resolutions, ["4K", "1080p"]);
});

test("high dynamic range is read, and is only claimed when it was said", () => {
  assert.equal(readListing("Film (2024) 4K HDR").hdr, "HDR");
  assert.equal(readListing("Film (2024) 4K HDR10").hdr, "HDR10");
  // The two-word spelling, which neither word means alone.
  assert.equal(readListing("Film (2024) 4K Dolby Vision").hdr, "DV");
  assert.equal(readListing("Film (2024) 4K DV").hdr, "DV");
  // Silence is not a claim that the file has none, so nothing is badged for it.
  assert.equal(readListing("Film (2024) 4K WEB-DL").hdr, null);
  assert.equal(readListing("Film (2024) 4K SDR").hdr, null, "SDR is the default, not a badge");
});

test("a size is read as part of the line rather than as a quality badge", () => {
  // 300MB says what the download costs, not how good it is.
  const read = readListing("Film (2024) 1080p 300MB WEB-DL");
  assert.deepEqual(read.resolutions, ["1080p"]);
  assert.deepEqual(read.quality, ["WEB-DL"], "the size is not competing with the resolution");
  assert.match(read.rest, /300MB/, "and it is still in the line the tooltip shows");
});

test("the punctuation a provider separates a line with does not hide a word", () => {
  // [Hindi] and {Hindi} and Hindi: are the same statement as Hindi.
  for (const wording of ["[Hindi]", "Hindi:", "/Hindi/", "Hindi|"]) {
    assert.deepEqual(readListing(`Film (2020) 720p ${wording} WEB-DL`).languages, ["Hindi"], wording);
  }
});

test("a consonant case difference does not matter", () => {
  assert.deepEqual(readListing("Film (2020) hindi TAMIL 1080p").languages, ["Hindi", "Tamil"]);
});

test("no language is read from a tail that has none", () => {
  // x265 and 2GB are both in the line and neither is a badge: the codec says what encoded it and
  // the size says what it costs, so a listing of just those has nothing to show but its resolution.
  const read = readListing("Film (2020) 1080p 2GB x265");
  assert.deepEqual(read.languages, []);
  assert.deepEqual(read.resolutions, ["1080p"], "the resolution is read");
  assert.deepEqual(read.quality, [], "and nothing else is");
});

test("an empty name yields an empty reading rather than throwing", () => {
  const empty = {
    title: "",
    year: null,
    languages: [],
    quality: [],
    resolutions: [],
    hdr: null,
    rest: "",
  };
  assert.deepEqual(readListing(""), empty);
  assert.deepEqual(readListing("   "), empty);
});

test("the title function on its own still behaves as it did", () => {
  // It is exported and called elsewhere, so the reading is added beside it rather than replacing it.
  assert.equal(listingTitle("Zakir Khan: Papa Yaar (2026) WEB-DL Hindi"), "Zakir Khan: Papa Yaar");
  assert.equal(listingTitle("Fight Club"), "Fight Club");
  assert.equal(listingTitle("(500) Days of Summer"), "(500) Days of Summer");
});
