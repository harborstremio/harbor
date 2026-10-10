import test from "node:test";
import assert from "node:assert/strict";
import {
  athleteImageUrl,
  espnAthleteRecordUrl,
  parseEspnAthleteBio,
  parseSportsDbAthleteBio,
} from "../src/lib/sports/athlete-identity.ts";
import { createAthleteCareerClient } from "../src/lib/sports/athlete-career.ts";

test("cricket identity preserves supplied Cricinfo record, player role and batting/bowling style", () => {
  const raw = {
    athlete: {
      id: "253802",
      displayName: "Virat Kohli",
      position: { name: "Top-order batter" },
      headshot: {
        href: "https://a.espncdn.com/i/headshots/cricket/players/full/253802.png",
      },
      batStyle: [{ description: "Right-hand bat" }],
      bowlStyle: [{ description: "Right-arm medium" }],
      links: [
        {
          href: "https://www.espncricinfo.com/ci/content/player/253802.html",
          rel: ["playercard"],
        },
      ],
    },
  };
  const result = parseEspnAthleteBio(raw, "253802");
  assert.deepEqual(result?.bio, ["Top-order batter", "Right-hand bat", "Right-arm medium"]);
  assert.equal(result?.recordUrl, raw.athlete.links[0].href);
  assert.equal(result?.image, raw.athlete.headshot.href);
  assert.equal(parseEspnAthleteBio(raw, "34170942"), null);
});

test("published record links must match provider and player, without credentials or guessed routes", () => {
  assert.equal(
    espnAthleteRecordUrl([{ href: "https://www.espn.com/nba/player/_/id/42/example" }], "42"),
    "https://www.espn.com/nba/player/_/id/42/example",
  );
  for (const href of [
    "https://espn.com.evil.test/player/42.html",
    "https://user:secret@www.espn.com/nba/player/_/id/42",
    "https://www.espn.com/nba/player/_/id/420",
    "javascript:alert(1)",
  ]) {
    assert.equal(espnAthleteRecordUrl([{ href }], "42"), "");
  }
  assert.equal(athleteImageUrl("https://user:pass@images.example.org/portrait.png"), "");
});

test("database athlete IDs and sports are checked; biography has no invented statistics or team logo", () => {
  const player = {
    idPlayer: "34170942",
    strPlayer: "Virat Kohli",
    strSport: "Cricket",
    strTeam: "Royal Challengers Bangalore",
    strPosition: "Batsman",
    strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/example.jpg",
  };
  const profile = parseSportsDbAthleteBio({ players: [player] }, "34170942", "cricket");
  assert.equal(profile?.name, player.strPlayer);
  assert.equal(profile?.team?.logo, "");
  assert.equal(profile?.recordUrl, "https://www.thesportsdb.com/player/34170942");
  assert.equal(parseSportsDbAthleteBio({ players: [player] }, "253802", "cricket"), null);
  assert.equal(parseSportsDbAthleteBio({ players: [player] }, "34170942", "lacrosse"), null);
  assert.equal(parseSportsDbAthleteBio({ players: [player, player] }, "34170942", "cricket"), null);
  assert.equal("categories" in profile!, false);
});

test("non-team database sports preserve identity and do not depend on ESPN paths", () => {
  for (const [group, sport] of [
    ["lacrosse", "Lacrosse"],
    ["volleyball", "Volleyball"],
    ["fieldhockey", "Field Hockey"],
    ["tabletennis", "Table Tennis"],
    ["winter", "Skiing"],
    ["aussie", "Australian Football"],
    ["esports", "Esports"],
  ]) {
    const result = parseSportsDbAthleteBio(
      {
        players: [{ idPlayer: "100", strPlayer: "Fixture athlete", strSport: sport }],
      },
      "100",
      group,
    );
    assert.equal(result?.name, "Fixture athlete", group);
  }
});

test("unsupported cricket career avoids known failing request, while lacrosse and volleyball can parse available stats", async () => {
  const urls: string[] = [];
  const career = createAthleteCareerClient(async (url) => {
    urls.push(url);
    return { categories: [{ name: "general", labels: ["GP"], totals: ["0"] }] };
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await career("cricket/8048", "253802", signal), []);
  assert.equal(urls.length, 0);
  assert.equal((await career("lacrosse/pll", "42", signal))[0].totals[0], "0");
  assert.equal(
    (await career("volleyball/womens-college-volleyball", "43", signal))[0].totals[0],
    "0",
  );
  assert.equal(urls.length, 2);
});
