import test from "node:test";
import assert from "node:assert/strict";
import { parseSoccerCareer, soccerSeasonReferences } from "../src/lib/sports/athlete-soccer.ts";

const stats = (items: unknown[]) => ({
  splits: {
    categories: [{ name: "offensive", displayName: "Attacking", stats: items }],
  },
});
test("football career columns keep provider identities across reordered and missing seasons", () => {
  const result = parseSoccerCareer(
    stats([
      { name: "goals", abbreviation: "G", value: 20 },
      { name: "assists", abbreviation: "A", value: 5 },
    ]),
    [
      {
        season: "2025",
        data: stats([
          { name: "assists", value: 2 },
          { name: "goals", value: 0 },
        ]),
      },
      { season: "2024", data: stats([{ name: "goals", displayValue: "20" }]) },
    ],
  );
  assert.deepEqual(result[0].labels, ["G", "A"]);
  assert.deepEqual(result[0].totals, ["20", "5"]);
  assert.deepEqual(
    result[0].rows.map((row) => row.values),
    [
      ["0", "2"],
      ["20", "—"],
    ],
  );
  assert.equal(result[0].rows[0].team, "");
});
test("football season references stay in their actual competition and official host", () => {
  const ref = (url: string) => ({ $ref: url });
  const base = "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/";
  const result = soccerSeasonReferences(
    {
      items: [
        ref(base + "2023"),
        ref(base + "2025?lang=en"),
        ref(base + "2025"),
        ref(base + "2025/athletes"),
        ref(base.replace("eng.1", "ita.1") + "2024"),
        ref(base.replace("espn.com", "espn.com.evil.test") + "2024"),
        ref(base.replace("http:", "ftp:") + "2024"),
      ],
    },
    "eng.1",
  );
  assert.deepEqual(
    result.map((row) => row.season),
    ["2025", "2023"],
  );
  assert.ok(result.every((row) => row.url.startsWith("https://sports.core.api.espn.com/")));
});
