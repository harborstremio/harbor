import assert from "node:assert/strict";
import test from "node:test";
import { EXPANDED_SPORTS_LEAGUES } from "../src/lib/sports/expanded-sports-catalog.ts";
import {
  AUSTRALIAN_DB_LEAGUES,
  AUSTRALIAN_COMPETITION_GUIDES,
} from "../src/lib/sports/australian-sports-catalog.ts";
import { leagueLogoSource } from "../src/lib/sports/league-logo-source.ts";

test("new schedule identities remain unique and separate from official-only directories", () => {
  const schedules = [...EXPANDED_SPORTS_LEAGUES, ...AUSTRALIAN_DB_LEAGUES];
  assert.equal(new Set(schedules.map((row) => row.key)).size, schedules.length);
  assert.equal(new Set(schedules.map((row) => row.tag)).size, schedules.length);
  assert.equal(new Set(schedules.map((row) => row.path)).size, schedules.length);
  for (const row of schedules) {
    assert.match(row.path, /^\d+$/);
    assert.equal(row.coverage, "schedule");
    assert.match(row.officialWebsite, /^https:\/\//);
  }
  for (const guide of AUSTRALIAN_COMPETITION_GUIDES) {
    assert.equal(guide.coverage, "directory");
    assert.equal("path" in guide, false);
    assert.ok(!schedules.some((row) => row.key === guide.key));
    assert.match(guide.fixturesUrl, /^https:\/\//);
  }
});

test("competition branding replaces generic artwork without fabricating missing logos", () => {
  const generic = "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png";
  assert.equal(
    leagueLogoSource({ key: "TENNIS", logo: generic }),
    "/sports/logos/league-atp-header.png",
  );
  assert.equal(
    leagueLogoSource({ key: "NCAA_FIELDHOCKEY", logo: generic }),
    "/sports/logos/league-ncaa.svg",
  );
  assert.equal(leagueLogoSource({ key: "UNKNOWN", logo: generic }), "");
  assert.equal(leagueLogoSource({ key: "UNKNOWN", logo: "data:image/svg+xml,placeholder" }), "");
  assert.equal(
    leagueLogoSource({ key: "AFL", logo: "https://publisher.test/afl.png" }),
    "https://publisher.test/afl.png",
  );
});
