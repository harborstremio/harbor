import assert from "node:assert/strict";
import test from "node:test";
import { parseXxlFreshmen, xxlPortraits, XXL_FRESHMEN_URL } from "../src/lib/music/xxl-freshmen";

const TABLE = `==Annual Freshman Class list==
Intro prose with a [[Link|link]] that must not become a class.
{| class="sortable wikitable" style="text-align: left"
|-
! |Year
! |Freshmen
|-
|2007{{efn|name=fn1}}
|[[Saigon (rapper)|Saigon]], [[Plies (rapper)|Plies]] and [[Young Dro]].<ref>{{cite web |title=x}}</ref>
|-
|2009{{efn|name=fn1}}
|[[Wale (rapper)|Wale]], [[B.o.B]], [[Blu (rapper)|Blu]]<ref name="XXL"/>
|-
|2026
|[[New Artist]], [[Another One|Another]]
|}
Trailing prose with [[Not A Class]].`;

test("every year in the table is read, newest first", () => {
  const classes = parseXxlFreshmen(TABLE);
  assert.deepEqual(classes.map((row) => row.year), [2026, 2009, 2007]);
});

test("a link's display name wins over its target, so Saigon is not Saigon (rapper)", () => {
  const first = parseXxlFreshmen(TABLE).find((row) => row.year === 2007);
  assert.deepEqual(first?.artists, ["Saigon", "Plies", "Young Dro"]);
  assert.equal(first?.pages.Saigon, "Saigon (rapper)");
});

test("portraits follow exact article redirects, rejecting namesakes and unsafe image URLs", () => {
  const row = parseXxlFreshmen(TABLE).find(value => value.year === 2007)!;
  const image = "https://upload.wikimedia.org/wikipedia/commons/portrait.jpg";
  const payload = { query: { redirects: [{ from: "Saigon (rapper)", to: "Saigon (musician)" }], pages: {
    1: { title: "Saigon (musician)", thumbnail: { source: image } },
    2: { title: "Plies (rapper)", thumbnail: { source: "https://unrelated.example/photo.jpg" } },
    3: { title: "Young Dro", pageprops: { disambiguation: "" }, thumbnail: { source: image } },
    4: { title: "Saigon", thumbnail: { source: image + "wrong" } },
  } } };
  assert.deepEqual(xxlPortraits(payload, row), { Saigon: image });
  assert.deepEqual(xxlPortraits(null, row), {});
});

test("citations, footnote templates and self-closing refs never reach a name", () => {
  const row = parseXxlFreshmen(TABLE).find((r) => r.year === 2009);
  assert.deepEqual(row?.artists, ["Wale", "B.o.B", "Blu"]);
  for (const entry of parseXxlFreshmen(TABLE))
    for (const artist of entry.artists)
      assert.ok(!/ref|cite|efn|\{\{|\]\]/.test(artist), artist);
});

test("prose outside the table is not mistaken for a class", () => {
  const years = parseXxlFreshmen(TABLE).map((row) => row.year);
  assert.equal(years.length, 3);
});

test("a future year needs no code change", () => {
  const next = parseXxlFreshmen(TABLE.replace("|2026", "|2031"));
  assert.equal(next[0].year, 2031);
});

test("nothing parseable yields nothing rather than a broken row", () => {
  assert.deepEqual(parseXxlFreshmen(""), []);
  assert.deepEqual(parseXxlFreshmen("no table here"), []);
  assert.deepEqual(parseXxlFreshmen("{|\n|-\n|2020\n|no links\n|}"), []);
});

test("the request is pinned to the Freshman section of the one article", () => {
  assert.match(XXL_FRESHMEN_URL, /^https:\/\/en\.wikipedia\.org\/w\/api\.php\?/);
  assert.match(XXL_FRESHMEN_URL, /section=4/);
});
