import assert from "node:assert/strict";
import test from "node:test";
import {
  publishedPortraitUrl,
  wikipediaAthletePortrait,
} from "../src/lib/sports/athlete-portraits";

const BECK = {
  type: "standard",
  title: "Laetitia Beck",
  description: "Israeli professional golfer (born 1992)",
  extract: "Laetitia Beck is an Israeli professional golfer.",
  thumbnail: {
    source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Laetitia_Beck.jpg/330px.jpg",
  },
  content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Laetitia_Beck" } },
};

const request = { path: "golf/lpga", id: "4901389", name: "Laetitia Beck" };

test("a golfer the other two feeds have never heard of still gets a face", () => {
  const portrait = wikipediaAthletePortrait(BECK, request);
  assert.equal(portrait?.source, "Wikipedia");
  assert.match(portrait?.url ?? "", /^https:\/\/thumb\.wikimedia\.org\//);
  assert.equal(portrait?.sourceUrl, "https://en.wikipedia.org/wiki/Laetitia_Beck");
});

test("a namesake from another sport is refused rather than shown", () => {
  const soccer = { ...BECK, description: "Australian rules footballer (born 1992)", extract: "" };
  assert.equal(wikipediaAthletePortrait(soccer, request), null);
});

test("a disambiguation or missing page is never treated as a person", () => {
  assert.equal(wikipediaAthletePortrait({ ...BECK, type: "disambiguation" }, request), null);
  assert.equal(wikipediaAthletePortrait({ type: "standard", title: "Laetitia Beck" }, request), null);
});

test("a different person with the requested sport is still refused on the name", () => {
  assert.equal(wikipediaAthletePortrait({ ...BECK, title: "Danielle Kang" }, request), null);
});

test("a tennis player is read from the tennis wording, not golf's", () => {
  const andreeva = {
    type: "standard",
    title: "Erika Andreeva",
    description: "Russian tennis player (born 2004)",
    extract: "",
    thumbnail: { source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/A.jpg/330px.jpg" },
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Erika_Andreeva" } },
  };
  const tennis = { path: "tennis/wta", id: "1", name: "Erika Andreeva" };
  assert.equal(wikipediaAthletePortrait(andreeva, tennis)?.source, "Wikipedia");
  assert.equal(wikipediaAthletePortrait(andreeva, request), null);
});

test("only real Wikimedia image paths are accepted", () => {
  assert.equal(
    publishedPortraitUrl("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b/x.jpg"),
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b/x.jpg",
  );
  assert.equal(publishedPortraitUrl("https://evil.example/wikipedia/commons/x.jpg"), "");
  assert.equal(publishedPortraitUrl("http://thumb.wikimedia.org/wikipedia/commons/x.jpg"), "");
});

test("winter disciplines and swimming resolve portraits without matching an unrelated sport", () => {
  const person = { ...BECK, title: "Example Athlete", extract: "" };
  for (const [path, group, description] of [
    ["5625", "winter", "Austrian alpine skier"],
    ["5722", "winter", "Swedish cross-country skier"],
    ["5724", "winter", "Polish ski jumper"],
    ["5342", "winter", "French biathlete"],
    ["swimming", "swimming", "Australian swimmer"],
  ]) {
    const request = { path, group, id: "", name: person.title };
    assert.ok(wikipediaAthletePortrait({ ...person, description }, request));
    assert.equal(wikipediaAthletePortrait({ ...person, description: "German footballer" }, request), null);
  }
  assert.equal(wikipediaAthletePortrait({ ...person, description: "French biathlete" }, {
    path: "5625", group: "winter", id: "", name: person.title,
  }), null);
});
