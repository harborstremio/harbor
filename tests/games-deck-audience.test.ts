import assert from "node:assert/strict";
import test from "node:test";
import sample from "./fixtures/games/deck-audience.json" with { type: "json" };
import { parseDeckAudience } from "../src/lib/games/deck-audience.ts";

const html = (value = sample) => `<script>window.SSR.loaderData = ${JSON.stringify(value.loaders)};window.SSR.renderContext=JSON.parse(${JSON.stringify(JSON.stringify({queryData:JSON.stringify({queries:value.queries})}))});</script>`;

test("Valve's weekly serialized chart retains period, ranks, hashed artwork and game identity", () => {
  const chart=parseDeckAudience(html());
  assert.equal(chart.games.length,1); // Fixture supplies metadata for the first title only.
  assert.equal(chart.games[0].id,"steam:2868840");
  assert.equal(chart.games[0].chartRank,1);
  assert.ok(chart.games[0].capsule.includes('/2868840/6a19172e7bc3045dd4625018ca82dce8a18ed0ab/'));
  assert.ok(chart.games[0].hero?.includes('/library_hero_2x.jpg'));
  assert.equal(chart.end-chart.start,6*86400);
  assert.equal('currentPlayers' in chart.games[0],false);
});

test("a changed payload fails visibly instead of inventing a chart or running remote code", () => {
  assert.throws(()=>parseDeckAudience('<script>window.SSR.renderContext=evil()</script>'),/Missing/);
  assert.throws(()=>parseDeckAudience('x'.repeat(3_000_001)),/Invalid/);
  const invalid=structuredClone(sample);
  invalid.loaders=[];
  assert.throws(()=>parseDeckAudience(html(invalid)),/period/);
});
