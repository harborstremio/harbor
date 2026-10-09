import assert from "node:assert/strict";
import test from "node:test";
import { AUDIENCE_REPORT, audienceChart, audiencePage } from "../src/lib/games/audience-charts.ts";
import { detailEditionTarget } from "../src/lib/games/detail-edition.ts";

test("published PC order includes non-Steam leaders without inventing player totals", () => {
  const chart=audienceChart("pc");
  assert.deepEqual(chart.map(game=>game.igdbId),[242408,135400,1905,17269,115,3212,126459,2963,11198,125174]);
  assert.deepEqual(chart.map(game=>game.chartRank),[1,2,3,4,5,6,7,8,9,10]);
  for(const game of chart)assert.equal("currentPlayers" in game,false);
  for(const id of [135400,1905,17269,115,126459])assert.equal(chart.find(game=>game.igdbId===id)?.steamId,undefined);
});
test("console ranks retain their cohort, aggregate HQ and exact editions", () => {
  const chart=audienceChart("console");
  assert.equal(chart[0].igdbId,1905);
  assert.equal(chart[1].igdbId,353848); // FC26, not current storefront FC27.
  assert.equal(chart[4].steamId,1938090); // HQ, not the 2003 original or a single recent release.
  assert.equal(chart[4].igdbId,undefined);
  assert.equal(chart[7].igdbId,1122); // Black Ops II, not a sequel inferred from popularity.
  assert.equal(chart[9].igdbId,353901);
  assert.equal(AUDIENCE_REPORT.month,"2026-08-01");
  assert.deepEqual(AUDIENCE_REPORT.excludes,["China","India"]);
});
test("PC chart opens verified Steam identities while console and non-Steam editions remain intact", () => {
  const pc=audienceChart("pc");
  const cs2=pc.find(game=>game.igdbId===242408)!;
  assert.equal(cs2.id,"steam:730");
  assert.equal(detailEditionTarget(cs2).steamId,730);
  assert.equal(cs2.igdbId,242408);
  assert.equal(pc.find(game=>game.igdbId===1905)?.id,"igdb:1905");
  const blackOps=audienceChart("console").find(game=>game.igdbId===1122)!;
  assert.equal(blackOps.id,"igdb:1122");
  assert.equal(detailEditionTarget(blackOps).steamId,undefined);
});
test("partial final pages remain full, reachable and preserve published ranks", () => {
  const chart=audienceChart("pc"),first=audiencePage(chart,0),last=audiencePage(chart,1);
  assert.equal(first.length,6);assert.equal(last.length,6);
  assert.equal(new Set([...first,...last].map(game=>game.id)).size,10);
  assert.deepEqual(last.map(game=>game.chartRank),[5,6,7,8,9,10]);
  assert.deepEqual(audiencePage(chart,999),last);
  assert.deepEqual(audiencePage([],0),[]);
  assert.deepEqual(audiencePage(chart.slice(0,3),0),chart.slice(0,3));
});

test("non-Steam leaders have original wordmarks and FC26 retains its verified image fallback", () => {
  const pc=audienceChart("pc");
  for (const id of [1905,115,17269,126459,135400]) assert.ok(pc.find(game=>game.igdbId===id)?.logo);
  const consoleChart=audienceChart("console");
  assert.match(consoleChart.find(game=>game.igdbId===353848)!.capsule, /images\.igdb\.com/);
  assert.equal(consoleChart.find(game=>game.steamId===1938090)?.name,"Call of Duty");
});
