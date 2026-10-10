// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import type { CfbdTeam } from "../src/lib/jl/sports/cfbd.ts";
import type { VisionTeam } from "../src/lib/jl/sports/vision-branding.ts";
import { linkVisionToCfbd, normalizeSchool } from "../src/lib/jl/sports/vision-cfbd-link.ts";

const team = (
  conference: string,
  slug: string,
  name: string,
  league: string,
  espn?: string,
): VisionTeam => ({
  key: `${conference}/football/${slug}`,
  conference,
  sport: "football",
  slug,
  name,
  mascot: null,
  league,
  logoPath: null,
  providerIds: espn ? [{ provider: "espn", league: "college-football", id: espn }] : [],
});
const cfbd = (
  id: string,
  school: string,
  classification: string,
  extra: Partial<CfbdTeam> = {},
): CfbdTeam => ({
  id,
  school,
  mascot: null,
  abbreviation: null,
  altNames: [],
  conference: null,
  classification,
  color: null,
  altColor: null,
  logos: [],
  ...extra,
});

test("school names are tidied before matching", () => {
  assert.equal(normalizeSchool("San José State"), "san jose state");
  assert.equal(normalizeSchool("Texas A&M"), "texas a and m");
  assert.equal(normalizeSchool("Hawai'i"), "hawaii");
});

test("exact names link; parentheses, alternate names and division break ties", () => {
  const links = linkVisionToCfbd(
    [
      team("acc", "miami-fl", "Miami (FL)", "ncaa-fbs"),
      team("mac", "miami-oh", "Miami (OH)", "ncaa-fbs"),
      team("mac", "umass", "UMass", "ncaa-fbs"),
      team("scac", "gallaudet", "Gallaudet", "ncaa-diii"),
      team("scac", "centenary-college", "Centenary College", "ncaa-diii"),
      team("big-ten", "oregon", "Oregon", "ncaa-fbs", "2483"),
      team("nfl-nfc-west", "seattle-seahawks", "Seattle Seahawks", "nfl"),
    ],
    [
      cfbd("2390", "Miami", "fbs"),
      cfbd("193", "Miami (OH)", "fbs"),
      cfbd("113", "Massachusetts", "fbs", { altNames: ["UMass"] }),
      cfbd("61", "Gallaudet", "iii"),
      cfbd("9001", "Centenary", "iii"),
      cfbd("2483", "Oregon", "fbs"),
    ],
  );
  assert.deepEqual(Object.fromEntries(links), {
    "espn:college-football:2390": "acc/football/miami-fl",
    "espn:college-football:193": "mac/football/miami-oh",
    "espn:college-football:113": "mac/football/umass",
    "espn:college-football:61": "scac/football/gallaudet",
    "espn:college-football:9001": "scac/football/centenary-college",
  });
});

test("ambiguous names are skipped, never guessed", () => {
  const links = linkVisionToCfbd(
    [team("x", "washington", "Washington", "ncaa-diii")],
    [cfbd("1", "Washington", "iii"), cfbd("2", "Washington", "iii", { altNames: ["W&J"] })],
  );
  assert.equal(links.size, 0);
});
