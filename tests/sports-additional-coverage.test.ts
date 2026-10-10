import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import {
  ADDITIONAL_GROUPS,
  ADDITIONAL_LEAGUES,
  additionalSportOfficialWebsite,
} from "../src/lib/sports/additional-sports-catalog.ts";
import { LEAGUES } from "../src/lib/sports/espn-leagues.ts";
import { HUB_LEAGUES } from "../src/lib/sports/hub-data.ts";

test("additional sports have unique identities and cannot shadow established leagues", () => {
  const keys = HUB_LEAGUES.map((l) => l.key);
  const tags = HUB_LEAGUES.map((l) => l.tag);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(tags).size, tags.length);
  assert.equal(new Set(ADDITIONAL_LEAGUES.map((l) => l.path)).size, ADDITIONAL_LEAGUES.length);
  for (const league of ADDITIONAL_LEAGUES) {
    const registered = HUB_LEAGUES.filter((l) => l.key === league.key);
    assert.equal(registered.length, 1, league.key);
    assert.equal(registered[0].path, league.path);
    assert.equal(registered[0].tag, league.tag);
    // ESPN feeds also power existing team/standings routes. Public schedule IDs
    // belong only in the hub, where they cannot be sent to ESPN endpoints.
    const espnEntries = LEAGUES.filter((l) => l.key === league.key);
    assert.equal(espnEntries.length, league.coverage === "scoreboard" ? 1 : 0, league.key);
  }
});

test("volleyball keeps men's and women's college and international feeds separate", () => {
  const league = (key: string) => ADDITIONAL_LEAGUES.find((l) => l.key === key)!;
  assert.equal(league("NCAAW_VB").path, "volleyball/womens-college-volleyball");
  assert.equal(league("NCAAM_VB").path, "volleyball/mens-college-volleyball");
  assert.equal(league("VNL_M").path, "5083");
  assert.equal(league("VNL_W").path, "5084");
  assert.equal(league("VNL_W").coverage, "schedule");
  assert.equal(league("NCAAW_VB").coverage, "scoreboard");
});

test("softball uses ESPN's actual baseball endpoint while retaining its own sport category", () => {
  const league = ADDITIONAL_LEAGUES.find((l) => l.key === "NCAA_SOFTBALL")!;
  assert.equal(league.path, "baseball/college-softball");
  assert.equal(league.group, "softball");
  assert.equal(league.coverage, "scoreboard");
});

test("every added group can be browsed and every source has a public logo and official link", () => {
  for (const group of ADDITIONAL_GROUPS) {
    assert.ok(
      ADDITIONAL_LEAGUES.some((l) => l.group === group.key),
      group.key,
    );
  }
  for (const league of ADDITIONAL_LEAGUES) {
    assert.ok(
      ADDITIONAL_GROUPS.some((g) => g.key === league.group),
      league.key,
    );
    if (league.logo.startsWith("/sports/logos/")) {
      assert.ok(existsSync(new URL(`../public${league.logo}`, import.meta.url)), league.key);
    } else {
      assert.equal(new URL(league.logo).protocol, "https:");
    }
    const site = new URL(additionalSportOfficialWebsite(league.tag)!);
    assert.equal(site.protocol, "https:");
    assert.equal(site.username, "");
    assert.equal(site.password, "");
    assert.equal(league.coverage, /^\d+$/.test(league.path) ? "schedule" : "scoreboard");
  }
  assert.equal(additionalSportOfficialWebsite("NOT_A_LEAGUE"), undefined);
});
