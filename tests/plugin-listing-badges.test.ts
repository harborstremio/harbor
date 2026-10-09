import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hasListingBadges,
  listingBadges,
  listingLine,
} from "../src/views/plugins/listing-badges";
import type { Meta } from "../src/lib/cinemeta";

const meta = (extras?: Meta["listingExtras"]): Meta => ({
  id: "p:1",
  type: "movie",
  name: "Some Film",
  listingExtras: extras,
});

const both = { languages: true, quality: true };
const none = { languages: false, quality: false };

test("a listing with nothing beyond its title earns no badges at all", () => {
  // This is the case that keeps every plain addon row untouched: no extras, no strip.
  assert.equal(hasListingBadges(meta(), both), false);
  assert.equal(listingLine(meta()), undefined);
});

test("a listing with extras draws a strip when the switches are on", () => {
  const withExtras = meta({ rest: "1080p Hindi", languages: ["Hindi"], quality: ["1080p"] });
  assert.equal(hasListingBadges(withExtras, both), true);
});

test("both switches off draw nothing, whatever the listing carried", () => {
  const withExtras = meta({ rest: "1080p Hindi", languages: ["Hindi"], quality: ["1080p"] });
  assert.equal(hasListingBadges(withExtras, none), false);
  assert.deepEqual(listingBadges(withExtras, none).languages, []);
  assert.deepEqual(listingBadges(withExtras, none).quality, []);
});

test("each switch draws only its own half", () => {
  const withExtras = meta({ rest: "1080p Hindi", languages: ["Hindi"], quality: ["1080p"] });
  const langsOnly = listingBadges(withExtras, { languages: true, quality: false });
  assert.deepEqual(langsOnly.languages, ["Hindi"]);
  assert.deepEqual(langsOnly.quality, []);
  const qualOnly = listingBadges(withExtras, { languages: false, quality: true });
  assert.deepEqual(qualOnly.languages, []);
  assert.deepEqual(qualOnly.quality, ["1080p"]);
});

test("only two languages are badged, and the rest are counted rather than dropped", () => {
  // A poster is about 140px wide. Three or four languages would cover the artwork, so the strip
  // says how many more there are and the tooltip has the whole line.
  const many = meta({
    rest: "Telugu Tamil Hindi Malayalam 1080p",
    languages: ["Telugu", "Tamil", "Hindi", "Malayalam"],
    quality: ["1080p"],
  });
  const badges = listingBadges(many, both);
  assert.deepEqual(badges.languages, ["Telugu", "Tamil"]);
  assert.equal(badges.languagesMore, 2);
});

test("two languages or fewer leave nothing to count", () => {
  const two = meta({ rest: "Hindi Tamil", languages: ["Hindi", "Tamil"], quality: [] });
  assert.equal(listingBadges(two, both).languagesMore, 0);
  const one = meta({ rest: "Hindi", languages: ["Hindi"], quality: [] });
  assert.equal(listingBadges(one, both).languagesMore, 0);
});

test("several qualities are shown best first, and the rest counted", () => {
  const several = meta({
    rest: "x",
    languages: [],
    quality: ["480p", "720p", "1080p", "4K"],
    resolutions: ["4K", "1080p", "720p", "480p"],
    hdr: null,
  });
  const badges = listingBadges(several, both);
  assert.deepEqual(badges.resolutions, ["4K", "1080p"]);
  assert.equal(badges.resolutionsMore, 2);
});

test("resolutions come from their own field, so a release is never read as one", () => {
  const withRelease = meta({
    rest: "x",
    languages: [],
    quality: ["BluRay", "x264"],
    resolutions: ["1080p"],
    hdr: null,
  });
  const badges = listingBadges(withRelease, both);
  assert.deepEqual(badges.resolutions, ["1080p"]);
  assert.deepEqual(badges.quality, ["BluRay", "x264"]);
});

test("high dynamic range is not on the poster, wherever it was said", () => {
  // The user asked for it on the detail page, where there is room to say it without crowding the
  // artwork, so the strip has no HDR in it at all.
  const withHdr = meta({
    rest: "x",
    languages: [],
    quality: [],
    resolutions: ["4K"],
    hdr: "HDR",
  });
  const badges = listingBadges(withHdr, both) as Record<string, unknown>;
  assert.equal("hdr" in badges, false);
  assert.deepEqual(badges.resolutions, ["4K"]);
});

test("two resolutions or fewer leave nothing to count", () => {
  const two = meta({ rest: "x", languages: [], quality: [], resolutions: ["1080p", "720p"], hdr: null });
  assert.equal(listingBadges(two, both).resolutionsMore, 0);
  const one = meta({ rest: "x", languages: [], quality: [], resolutions: ["1080p"], hdr: null });
  assert.equal(listingBadges(one, both).resolutionsMore, 0);
});

test("the best quality leads whatever order the provider wrote it in", () => {
  const forwards = meta({
    rest: "x",
    languages: [],
    quality: ["DVDRip", "BluRay"],
    resolutions: [],
    hdr: null,
  });
  const backwards = meta({
    rest: "x",
    languages: [],
    quality: ["BluRay", "DVDRip"],
    resolutions: [],
    hdr: null,
  });
  assert.deepEqual(listingBadges(forwards, both).quality, ["BluRay", "DVDRip"]);
  assert.deepEqual(listingBadges(backwards, both).quality, ["BluRay", "DVDRip"]);
});

test("an unranked quality sorts below every ranked one rather than above it", () => {
  const odd = meta({
    rest: "x",
    languages: [],
    quality: ["CAM", "WEB-DL"],
    resolutions: [],
    hdr: null,
  });
  assert.deepEqual(listingBadges(odd, both).quality, ["WEB-DL", "CAM"]);
});

test("one or two qualities leave nothing to count", () => {
  const one = meta({ rest: "x", languages: [], quality: ["WEB-DL"], resolutions: [], hdr: null });
  assert.equal(listingBadges(one, both).qualityMore, 0);
  const two = meta({
    rest: "x",
    languages: [],
    quality: ["WEB-DL", "HEVC"],
    resolutions: [],
    hdr: null,
  });
  assert.equal(listingBadges(two, both).qualityMore, 0);
});

test("languages and quality are counted apart from each other", () => {
  const both_ = meta({
    rest: "Hindi Tamil Telugu 480p 720p 1080p",
    languages: ["Hindi", "Tamil", "Telugu"],
    quality: ["480p", "720p", "1080p"],
  });
  const badges = listingBadges(both_, both);
  assert.equal(badges.languagesMore, 1);
  assert.equal(badges.qualityMore, 1);
});

test("the tooltip carries the whole line, not the reading of it", () => {
  // The reading can leave words out; what the provider sent is what answers a question about it.
  const withJunk = meta({
    rest: "(2026) WEB-DL Hindi Stand-Up Special and more info ahead",
    languages: ["Hindi"],
    quality: ["WEB-DL"],
  });
  assert.equal(
    listingLine(withJunk),
    "(2026) WEB-DL Hindi Stand-Up Special and more info ahead",
  );
  assert.equal(listingLine(meta({ rest: "", languages: [], quality: [] })), undefined);
});

test("an empty language list with the switch on is still no badge", () => {
  // A listing that says nothing about languages earns nothing, which is not the same as being off.
  const noLangs = meta({
    rest: "x",
    languages: [],
    quality: ["WEB-DL"],
    resolutions: ["1080p"],
    hdr: null,
  });
  const badges = listingBadges(noLangs, { languages: true, quality: false });
  assert.equal(badges.languages.length, 0);
  assert.equal(hasListingBadges(noLangs, { languages: true, quality: false }), false);
});

test("a listing with only a resolution still earns a strip", () => {
  // The strip draws for a resolution on its own: a listing can name one and nothing else.
  const onlyRes = meta({
    rest: "x",
    languages: [],
    quality: [],
    resolutions: ["1080p"],
    hdr: null,
  });
  assert.equal(hasListingBadges(onlyRes, both), true);
});
