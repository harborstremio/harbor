// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  ART_HIT_TTL_MS,
  ART_STORAGE_KEY,
  chooseGameArt,
  compactRoster,
  createTeamArtCache,
  leagueTeamsUrl,
  parseArtCache,
  pickTeamArt,
  stableIndex,
  teamSearchUrl,
  trimArtCache,
  type TeamArt,
} from "../src/lib/jl/sports/fanart.ts";

const IMG = "https://img.example/";

const teams = [
  {
    idESPN: "9",
    strTeam: "Golden State Warriors",
    strSport: "Basketball",
    strFanart1: `${IMG}gsw1.jpg`,
    strFanart2: `http://img.example/gsw2.jpg`,
  },
  { idESPN: "", strTeam: "Warriors", strSport: "Rugby", strFanart1: `${IMG}rugby.jpg` },
  {
    idESPN: "",
    strTeam: "Kansas City Chiefs",
    strSport: "American Football",
    strBanner: `${IMG}kc-banner.jpg`,
    strColour1: "#E31837",
  },
];

const art = (over: Partial<TeamArt> = {}): TeamArt => ({
  fanart: [],
  banner: null,
  stadium: null,
  badge: null,
  colors: [],
  ...over,
});

test("teams match by ESPN id first, then by name in the same sport", () => {
  const gsw = pickTeamArt(teams, { id: "9", name: "Warriors", abbr: "GS" }, "NBA");
  assert.deepEqual(gsw?.fanart, [`${IMG}gsw1.jpg`, "https://img.example/gsw2.jpg"]);
  // Same nickname in another sport is never picked.
  assert.equal(pickTeamArt(teams, { id: "1", name: "Warriors", abbr: "" }, "NBA"), null);
  const kc = pickTeamArt(teams, { id: "12", name: "Kansas City Chiefs", abbr: "KC" }, "NFL");
  assert.deepEqual(kc, art({ banner: `${IMG}kc-banner.jpg`, colors: ["e31837"] }));
  assert.equal(pickTeamArt(null, { id: "9", name: "x", abbr: "" }, "NBA"), null);
});

const COLLEGE = [
  {
    strTeam: "Stanford Cardinal",
    strSport: "American Football",
    strBadge: `${IMG}stan.png`,
    strStadiumThumb: `${IMG}stan-stadium.jpg`,
  },
  {
    strTeam: "Miami (FL) Hurricanes",
    strSport: "American Football",
    strFanart1: `${IMG}miami.jpg`,
  },
  { strTeam: "Miami (OH) RedHawks", strSport: "American Football", strBadge: `${IMG}moh.png` },
  {
    strTeam: "Mississippi Rebels",
    strTeamAlternate: "Ole Miss Rebels, Ole Miss",
    strSport: "American Football",
    strBadge: `${IMG}olemiss.png`,
  },
  {
    strTeam: "Notre Dame Fighting Irish",
    strTeamShort: "ND",
    strSport: "American Football",
    strColour1: "0C2340",
  },
  { strTeam: "Texas Longhorns", strSport: "American Football", strBadge: `${IMG}tex.png` },
  { strTeam: "Texas Tech Red Raiders", strSport: "American Football", strBadge: `${IMG}ttu.png` },
  { strTeam: "Bare Team", strSport: "American Football" },
];

test("college teams match by full name, alternates, loose names, school and abbreviation", () => {
  // ESPN's display name, no idESPN on TheSportsDB's side.
  assert.equal(
    pickTeamArt(COLLEGE, { id: "24", name: "Stanford Cardinal", abbr: "STAN" }, "NCAAF")?.stadium,
    `${IMG}stan-stadium.jpg`,
  );
  // "Miami Hurricanes" = "Miami (FL) Hurricanes", never the RedHawks.
  assert.deepEqual(
    pickTeamArt(COLLEGE, { id: "2390", name: "Miami Hurricanes", abbr: "MIA" }, "NCAAF")?.fanart,
    [`${IMG}miami.jpg`],
  );
  // An alternate name.
  assert.equal(
    pickTeamArt(COLLEGE, { id: "145", name: "Ole Miss Rebels", abbr: "MISS" }, "NCAAF")?.badge,
    `${IMG}olemiss.png`,
  );
  // School + mascot when the display name differs.
  assert.equal(
    pickTeamArt(
      COLLEGE,
      {
        id: "87",
        name: "Notre Dame",
        location: "Notre Dame",
        nickname: "Fighting Irish",
        abbr: "ND",
      },
      "NCAAF",
    )?.colors[0],
    "0c2340",
  );
  assert.equal(
    pickTeamArt(
      COLLEGE,
      { id: "251", name: "Texas", location: "Texas", nickname: "Longhorns", abbr: "TX" },
      "NCAAF",
    )?.badge,
    `${IMG}tex.png`,
  );
  // Never a guess between two schools: "Texas" alone could be Texas Tech, "Miami" is two teams.
  assert.equal(
    pickTeamArt(COLLEGE, { id: "251", name: "Texas", location: "Texas", abbr: "" }, "NCAAF"),
    null,
  );
  assert.equal(
    pickTeamArt(COLLEGE, { id: "1", name: "Miami", location: "Miami", abbr: "" }, "NCAAF"),
    null,
  );
  // "Stanford" + "Cardinal" against a longer listed name.
  assert.equal(
    pickTeamArt(
      [
        {
          strTeam: "Stanford University Cardinal",
          strSport: "American Football",
          strBadge: `${IMG}s.png`,
        },
      ],
      { id: "24", name: "Stanford", location: "Stanford", nickname: "Cardinal", abbr: "" },
      "NCAAF",
    )?.badge,
    `${IMG}s.png`,
  );
  // The abbreviation, when unique.
  assert.equal(
    pickTeamArt(COLLEGE, { id: "87", name: "Irish", abbr: "ND" }, "NCAAF")?.colors[0],
    "0c2340",
  );
  // A team with no artwork at all is not a hit.
  assert.equal(pickTeamArt(COLLEGE, { id: "9", name: "Bare Team", abbr: "" }, "NCAAF"), null);
  // Other sports never match.
  assert.equal(
    pickTeamArt(COLLEGE, { id: "24", name: "Stanford Cardinal", abbr: "" }, "NCAAB"),
    null,
  );
});

test("game art: fan art (home first, stable per game), then stadium, then banner", () => {
  const home = art({ fanart: ["a", "b", "c"], banner: "hb" });
  const away = art({ fanart: ["z"] });
  const first = chooseGameArt({ id: "401" }, home, away);
  assert.equal(chooseGameArt({ id: "401" }, home, away), first);
  assert.ok(home.fanart.includes(first ?? ""));
  assert.equal(chooseGameArt({ id: "1" }, art({ banner: "hb" }), away), "z");
  assert.equal(chooseGameArt({ id: "1" }, art({ banner: "hb" }), art({ stadium: "as" })), "as");
  assert.equal(chooseGameArt({ id: "1" }, art({ banner: "hb" }), null), "hb");
  assert.equal(chooseGameArt({ id: "1" }, null, null), null);
  assert.equal(stableIndex("x", 0), 0);
});

test("URLs refuse unsafe keys; league lists only for leagues TheSportsDB has", () => {
  assert.equal(teamSearchUrl("a/b", "Chiefs"), null);
  assert.match(
    teamSearchUrl("abc", "Kansas City Chiefs") ?? "",
    /searchteams\.php\?t=Kansas%20City%20Chiefs$/,
  );
  assert.match(leagueTeamsUrl("abc", "NFL") ?? "", /lookup_all_teams\.php\?id=\d+$/);
  assert.equal(leagueTeamsUrl("abc", "UFC"), null);
  assert.equal(leagueTeamsUrl("a b", "NFL"), null);
});

test("league lists are stored small: only teams with art, only the fields used", () => {
  const rows = compactRoster([...COLLEGE, null, { ...COLLEGE[0], strDescriptionEN: "long text" }]);
  assert.equal(rows.length, COLLEGE.length);
  assert.ok(rows.every((r) => !("strDescriptionEN" in r)));
});

test("stored cache drops expired and malformed entries and is capped", () => {
  const raw = JSON.stringify({
    fresh: { art: { fanart: ["u", 3], banner: null }, expires: 200 },
    miss: { art: null, expires: 200 },
    old: { art: null, expires: 50 },
    bad: { art: "x", expires: 200 },
  });
  const rec = parseArtCache(raw, 100);
  assert.deepEqual(Object.keys(rec).sort(), ["fresh", "miss"]);
  assert.deepEqual(rec.fresh.art, art({ fanart: ["u"] }));
  assert.deepEqual(parseArtCache("{nope", 0), {});
  const big = Object.fromEntries(
    Array.from({ length: 5 }, (_, i) => [`k${i}`, { art: null, expires: i }]),
  );
  assert.deepEqual(Object.keys(trimArtCache(big, 2)).sort(), ["k3", "k4"]);
});

function harness(answer: (url: string) => { status: number; json: unknown }) {
  let clock = 1000;
  const urls: string[] = [];
  const slept: number[] = [];
  const store = new Map<string, string>();
  const cache = createTeamArtCache({
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    spacingMs: 2000,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    fetchJson: async (url) => {
      urls.push(url);
      return answer(url);
    },
  });
  return { cache, urls, slept, store, advance: (ms: number) => (clock += ms), now: () => clock };
}

test("one league list serves every team in it; teams it lacks fall back to a search", async () => {
  const h = harness((url) =>
    url.includes("lookup_all_teams")
      ? { status: 200, json: { teams: COLLEGE } }
      : {
          status: 200,
          json: {
            teams: [
              {
                strTeam: "Gallaudet Bison",
                strSport: "American Football",
                strBadge: `${IMG}gu.png`,
              },
            ],
          },
        },
  );
  const sides = [
    { id: "24", name: "Stanford Cardinal", abbr: "" },
    { id: "2390", name: "Miami Hurricanes", abbr: "" },
    { id: "145", name: "Ole Miss Rebels", abbr: "" },
    { id: "417", name: "Gallaudet Bison", abbr: "" },
  ];
  const found = await Promise.all(sides.map((s) => h.cache.request("key", "NCAAF", s)));
  assert.equal(h.urls.filter((u) => u.includes("lookup_all_teams")).length, 1);
  assert.equal(h.urls.filter((u) => u.includes("searchteams")).length, 1);
  assert.ok(found.every(Boolean));
  assert.equal(h.cache.get("NCAAF:417")?.badge, `${IMG}gu.png`);
  // Requests are spaced to the plan's limit.
  assert.deepEqual(h.slept, [2000]);
  const stored = parseArtCache(h.store.get(ART_STORAGE_KEY) ?? null, h.now());
  assert.ok(stored["NCAAF:24"].expires >= h.now() + ART_HIT_TTL_MS - 5000);
  // Cached answers (and the cached league list) need no request.
  await h.cache.request("key", "NCAAF", sides[0]);
  await h.cache.request("key", "NCAAF", { id: "251", name: "Texas Longhorns", abbr: "" });
  assert.equal(h.urls.length, 2);
});

test("leagues TheSportsDB doesn't list go straight to the search, deduped", async () => {
  const h = harness(() => ({ status: 200, json: { teams } }));
  const side = { id: "9", name: "Golden State Warriors", abbr: "" };
  const [a, b] = await Promise.all([
    h.cache.request("key", "XYZ", side),
    h.cache.request("key", "XYZ", side),
  ]);
  assert.equal(a, b);
  assert.equal(h.urls.length, 1);
});

test("failed requests are retried later instead of cached as no art", async () => {
  const h = harness(() => ({ status: 429, json: null }));
  await h.cache.request("key", "NBA", { id: "9", name: "Warriors", abbr: "" });
  assert.equal(h.cache.get("NBA:9"), null);
  h.advance(11 * 60_000);
  assert.equal(h.cache.get("NBA:9"), undefined);
});
