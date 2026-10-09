// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { parseRockHall, ROCK_HALL_URL } from "../src/lib/music/rock-hall";
import { xxlPortraits } from "../src/lib/music/xxl-freshmen";

const TABLE = `
== Performers ==
{| class="wikitable sortable"
! Year !! Inductee !! Notes
|-
| rowspan="3" | 1986
| {{sortname|Chuck|Berry}}
| First class.<ref name="a"/>
|-
| {{sortname|James|Brown}}
| Soul.
|-
| [[Elvis Presley]]
| The King.
|-
| rowspan="2" | 1988
| [[The Beatles]]
| Band.
|-
| {{sortname|Bob|Dylan}}
| Songwriter.
|-
| 2026
| {{sortname|Phil|Collins}}
| Latest class.
|}
`;

test("classes come back newest first with the rowspan year carried down", () => {
  const classes = parseRockHall(TABLE);
  assert.deepEqual(classes.map((c) => c.year), [2026, 1988, 1986]);
});

test("a rowspan class keeps every performer under one year", () => {
  const first = parseRockHall(TABLE).find((c) => c.year === 1986)!;
  assert.deepEqual(first.artists, ["Chuck Berry", "James Brown", "Elvis Presley"]);
});

test("sortname templates survive instead of being stripped as braces", () => {
  const classes = parseRockHall(TABLE);
  const names = classes.flatMap((c) => c.artists);
  assert.ok(names.includes("Chuck Berry"), names.join(", "));
  assert.ok(names.includes("Bob Dylan"), names.join(", "));
});

test("sortname and plain links both resolve to an article title", () => {
  const first = parseRockHall(TABLE).find((c) => c.year === 1986)!;
  assert.equal(first.pages["Chuck Berry"], "Chuck Berry");
  assert.equal(first.pages["Elvis Presley"], "Elvis Presley");
});

test("a disambiguated sortname uses its third parameter as the article", () => {
  const classes = parseRockHall(`
== Performers ==
{|
|-
| 1990
| {{sortname|The|Kinks|The Kinks}}
| x
|}`);
  assert.equal(classes[0].pages["The Kinks"], "The Kinks");
});

test("years before the first class are ignored", () => {
  const classes = parseRockHall(`
== Performers ==
{|
|-
| 1899
| [[Nobody]]
| x
|}`);
  assert.deepEqual(classes, []);
});

test("refs do not leak into a performer name", () => {
  const classes = parseRockHall(TABLE);
  for (const c of classes) for (const name of c.artists) {
    assert.ok(!/<ref|\{\{|\]\]/.test(name), `dirty name: ${name}`);
  }
});

test("portraits resolve through the shared Wikipedia helper", () => {
  const first = parseRockHall(TABLE).find((c) => c.year === 1986)!;
  const art = xxlPortraits({
    query: {
      pages: {
        "1": { title: "Chuck Berry", thumbnail: { source: "https://upload.wikimedia.org/x.jpg" } },
        "2": { title: "James Brown", pageprops: { disambiguation: "" } },
      },
    },
  }, first);
  assert.equal(art["Chuck Berry"], "https://upload.wikimedia.org/x.jpg");
  assert.ok(!("James Brown" in art), "a disambiguation page must not supply a portrait");
});

test("the source url targets the inductee list", () => {
  assert.ok(ROCK_HALL_URL.includes("Rock%20and%20Roll%20Hall%20of%20Fame%20inductees"));
  assert.ok(ROCK_HALL_URL.includes("origin=*"));
});

// The live page's real column order, including the traps that polluted the first parse:
// an image with a caption, a rowspan'd empty members cell, and an induction presenter.
const REAL_SHAPE = `
== Performers ==
{| class="wikitable sortable sticky-header"
|-
! Year !! Image !! Name !! Inducted members !! Prior nominations !! Induction presenter
|-
| rowspan="2" | 1986
| [[File:Chuck Berry 1957.jpg|75px|Publicity photo of Chuck Berry.]]
| {{sortname|Chuck|Berry}}
| rowspan="2" |
| rowspan="2" | {{Hidden sort key|0.1}}Inaugural class
| [[Keith Richards]]{{Ref|N2|[N2]}}
|-
| [[File:James Brown Live Hamburg 1973.jpg|75px|James Brown performing in Hamburg]]
| {{sortname|James|Brown}}
| [[Steve Winwood]]
|}
`;

test("only the inductee is taken, not the presenter or the image caption", () => {
  const classes = parseRockHall(REAL_SHAPE);
  const names = classes.flatMap((c) => c.artists);
  assert.deepEqual(names, ["Chuck Berry", "James Brown"]);
  assert.ok(!names.includes("Keith Richards"), "induction presenter leaked in");
  assert.ok(!names.includes("Steve Winwood"), "induction presenter leaked in");
  assert.ok(!names.some((n) => n.includes("75px")), "image caption leaked in");
});

test("a band is one inductee, not its whole lineup", () => {
  const classes = parseRockHall(`
== Performers ==
{|
|-
| 2026
| [[File:x.jpg|75px|photo]]
| [[Iron Maiden]]
| [[Bruce Dickinson]], [[Steve Harris (musician)|Steve Harris]], [[Dave Murray]]
| x
| [[Someone]]
|}`);
  assert.deepEqual(classes[0].artists, ["Iron Maiden"]);
});
