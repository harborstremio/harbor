import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanWikitext,
  findTemplates,
  liquipediaBrackets,
  liquipediaCredit,
  liquipediaLeague,
  liquipediaPageUrl,
  liquipediaWikitext,
  parseBrackets,
  parseLeagueInfobox,
  parseMoney,
  parsePrizePool,
  parseSections,
  reserveLiquipediaSlot,
  type LiquipediaReader,
} from "../src/lib/sports/esports-liquipedia.ts";

// Shaped on the wikitext forms recorded in scratchpad/notes/event-spec.md. No network anywhere in
// this file: every request path is driven through the injected reader.
const IEM = `{{DISPLAYTITLE:IEM Cologne 2026}}
{{Infobox league
|liquipediatier=1
|liquipediatiertype=
|publishertier=Major
|name=Intel Extreme Masters Cologne 2026
|shortname=IEM Cologne 2026
|series=[[Intel Extreme Masters]]
|organizer=[[ESL]]
|organizer2=[[DreamHack]]
|organizer3=
|country=Germany
|city=Cologne
|venue=[https://www.palladium-koeln.de/ Palladium]<!--|venue2={{half open -->
|format=[[Swiss]] into playoffs
|prizepool=1,000,000 USD
|prizepoolusd=1,000,000
|sdate=2026-07-23
|edate=2026-08-02
|team_number=24
|map1=Ancient
|map2=Anubis
|map3=Dust II
|map4=Inferno
|map5=Mirage
|map6=Nuke
|map7=Overpass
|previous=StarLadder/2025/Major{{!}}SL Budapest 2025
|next=[[BLAST/Open/2026/Fall|BLAST Open Fall]]
}}
'''Intel Extreme Masters Cologne 2026''' is an offline tournament<ref>{{cite|url=https://x/}}</ref>.

==Format==
===Swiss Stage===
==Prize Pool==
{{TeamPrizePool|localcurrency=EUR
|{{Slot|place=1|usdprize=400,000|{{TeamOpponent|spirit|p1=donk}}}}
|{{Slot|place=2|usdprize=170000|{{TeamOpponent|navi}}}}
|{{Slot|place=3-4|usdprize=80000|{{TeamOpponent|vitality}}|{{TeamOpponent|mouz}}}}
|{{Slot|place=17-24|usdprize=|{{TeamOpponent|fnatic}}}}
}}
{{TeamPrizePool/End}}

==Playoffs==
{{Bracket|Bracket/8|id=U9J2NxNQ87
|R1M1={{Match|bestof=3|winner=1|date=2026-08-01 - 17:00 {{Abbr/CEST}}
  |opponent1={{TeamOpponent|spirit|score=2|win=1}}
  |opponent2={{TeamOpponent|navi|score=0}}
  |map1={{Map|map=Overpass|t1ct=7|t1t=6|t2t=5|t2ct=3|winner=1|vod=https://www.twitch.tv/videos/1}}
  |map2={{Map|map=Mirage|score1=13|score2=9|winner=1}}
}}
|R1M2={{Match|bestof=3
  |opponent1={{TeamOpponent|vitality|score=2|win=1}}
  |opponent2={{TeamOpponent|mouz|score=1}}
}}
|R2M1={{Match|bestof=5
  |opponent1={{TeamOpponent}}
  |opponent2={{TeamOpponent}}
}}
}}
`;

// The measured transclusion case: prizepoolusd is a subpage whose whole body is the number.
const TI = `{{Infobox league
|name=The International 2025
|liquipediatier=1
|organizer=[[Valve]]
|country=Germany
|city=Hamburg
|prizepoolusd={{:The International/2025/prizepool}}
|sdate=2025-09-04
|edate=2025-09-14
}}
`;

// Measured: the LPDB wikis return the same template as seven empty stubs and zero teams.
const WORLDS = `==Knockout Stage==
{{Bracket|Bracket/8|id=Wrd25KnOut
|R1M1={{Match}}
|R1M2={{Match}}
|R1M3={{Match}}
|R1M4={{Match}}
|R2M1={{Match}}
|R2M2={{Match}}
|R3M1={{Match}}
}}
`;

function reader(pages: Record<string, string>, log: { url: string; headers: Record<string, string> }[]): LiquipediaReader {
  return async (url, headers) => {
    log.push({ url, headers });
    const title = new URL(url).searchParams.get("titles") ?? "";
    const content = pages[title];
    if (content === undefined) return { status: 404, ok: false, text: "" };
    return {
      status: 200,
      ok: true,
      text: JSON.stringify({
        query: { pages: [{ revisions: [{ slots: { main: { content } } }] }] },
      }),
    };
  };
}

test("template scanner keeps nested pipes with the child template", () => {
  const found = findTemplates("{{Slot|place=1|{{TeamOpponent|spirit|score=2}}}}", ["slot"]);
  assert.equal(found.length, 1);
  assert.equal(found[0].params.place, "1");
  assert.equal(found[0].args[0], "{{TeamOpponent|spirit|score=2}}");
  assert.equal(findTemplates("{{SlotWidth|8}}", ["slot"]).length, 0);
});

test("cleanWikitext resolves links, pipe escapes and refs", () => {
  assert.equal(cleanWikitext("[[Intel Extreme Masters]]"), "Intel Extreme Masters");
  assert.equal(cleanWikitext("[[ESL|ESL Gaming]]"), "ESL Gaming");
  assert.equal(cleanWikitext("A{{!}}B"), "A|B");
  assert.equal(cleanWikitext("'''Bold''' text<ref>{{cite|url=https://x/}}</ref>"), "Bold text");
  assert.equal(cleanWikitext("[https://host/ Label]"), "Label");
});

test("parseMoney reads every recorded prize format", () => {
  assert.equal(parseMoney("2,881,791"), 2881791);
  assert.equal(parseMoney("$1,000,000.00"), 1000000);
  assert.equal(parseMoney("2.881.791"), 2881791);
  assert.equal(parseMoney(""), undefined);
  assert.equal(parseMoney("TBD"), undefined);
});

test("infobox league yields the at-a-glance block", () => {
  const league = parseLeagueInfobox(IEM, "counterstrike", "Intel_Extreme_Masters/2026/Cologne");
  assert.ok(league);
  assert.equal(league.name, "Intel Extreme Masters Cologne 2026");
  assert.equal(league.series, "Intel Extreme Masters");
  assert.deepEqual(league.organisers, ["ESL", "DreamHack"]);
  assert.equal(league.country, "Germany");
  assert.equal(league.city, "Cologne");
  assert.equal(league.format, "Swiss into playoffs");
  assert.equal(league.teamCount, 24);
  assert.equal(league.prizePoolUsd, 1000000);
  assert.equal(league.prizePoolRaw, "1,000,000 USD");
  assert.equal(league.prizePoolPage, undefined);
  assert.deepEqual(league.tier, {
    liquipedia: "S-Tier",
    publisher: "Major",
    type: undefined,
    raw: "1",
  });
  assert.equal(league.startMs, Date.UTC(2026, 6, 23));
  assert.equal(league.endMs, Date.UTC(2026, 7, 2) + 86_399_999);
  assert.equal(league.page, "Intel Extreme Masters/2026/Cologne");
  assert.equal(league.credit.licence, "CC BY-SA 3.0");
  assert.equal(
    league.credit.pageUrl,
    "https://liquipedia.net/counterstrike/Intel_Extreme_Masters/2026/Cologne",
  );
});

test("venue is split into label and url, never rendered raw", () => {
  const league = parseLeagueInfobox(IEM, "counterstrike", "x");
  assert.deepEqual(league?.venue, {
    label: "Palladium",
    url: "https://www.palladium-koeln.de/",
  });
});

test("map pool joins cs2-maps by exact string", () => {
  const league = parseLeagueInfobox(IEM, "counterstrike", "x");
  assert.deepEqual(league?.mapPool, [
    "Ancient",
    "Anubis",
    "Dust II",
    "Inferno",
    "Mirage",
    "Nuke",
    "Overpass",
  ]);
});

test("previous and next survive the pipe escape and the wiki link form", () => {
  const league = parseLeagueInfobox(IEM, "counterstrike", "x");
  assert.deepEqual(league?.previous, {
    page: "StarLadder/2025/Major",
    label: "SL Budapest 2025",
  });
  assert.deepEqual(league?.next, { page: "BLAST/Open/2026/Fall", label: "BLAST Open Fall" });
});

test("a prizepoolusd transclusion is reported rather than rendered as markup", () => {
  const league = parseLeagueInfobox(TI, "dota2", "The International/2025");
  assert.equal(league?.prizePoolPage, "The International/2025/prizepool");
  assert.equal(league?.prizePoolUsd, undefined);
  assert.equal(league?.prizePoolRaw, undefined);
});

test("TeamPrizePool gives placement-by-placement money", () => {
  const slots = parsePrizePool(IEM);
  assert.equal(slots.length, 4);
  assert.deepEqual(slots[0], {
    place: "1",
    rank: 1,
    usd: 400000,
    local: undefined,
    teams: ["spirit"],
  });
  assert.equal(slots[1].usd, 170000);
  assert.deepEqual(slots[2], {
    place: "3-4",
    rank: 3,
    usd: 80000,
    local: undefined,
    teams: ["vitality", "mouz"],
  });
  // A slot with no money still carries its placement, so a 17-24 band is not dropped.
  assert.equal(slots[3].usd, undefined);
  assert.equal(slots[3].rank, 17);
});

test("an inlined bracket resolves rounds, scores and per-map VODs", () => {
  const brackets = parseBrackets(IEM);
  assert.equal(brackets.length, 1);
  const bracket = brackets[0];
  assert.equal(bracket.status, "ready");
  assert.equal(bracket.layout, "Bracket/8");
  assert.equal(bracket.id, "U9J2NxNQ87");
  assert.equal(bracket.matchCount, 3);
  assert.equal(bracket.resolvedCount, 2);
  assert.deepEqual(
    bracket.rounds.map((round) => [round.round, round.matches.length]),
    [
      [1, 2],
      [2, 1],
    ],
  );
  const first = bracket.rounds[0].matches[0];
  assert.equal(first.key, "r1m1");
  assert.equal(first.bestOf, 3);
  assert.equal(first.winner, 1);
  assert.equal(first.dateRaw, "2026-08-01 - 17:00");
  assert.deepEqual(first.opponents[0], {
    name: "spirit",
    score: 2,
    scoreRaw: "2",
    winner: true,
  });
  assert.equal(first.opponents[1].name, "navi");
  assert.equal(first.opponents[1].winner, undefined);
  // Per-half CT/T round wins are summed because CS2 inlines halves instead of a map score.
  assert.deepEqual(first.maps[0], {
    name: "Overpass",
    scores: [13, 8],
    winner: 1,
    vod: "https://www.twitch.tv/videos/1",
  });
  assert.deepEqual(first.maps[1].scores, [13, 9]);
  assert.equal(first.maps[1].vod, undefined);
});

test("empty Match stubs report no bracket instead of a ghost tree", () => {
  const brackets = parseBrackets(WORLDS);
  assert.equal(brackets.length, 1);
  assert.equal(brackets[0].matchCount, 7);
  assert.equal(brackets[0].resolvedCount, 0);
  assert.equal(brackets[0].status, "empty");
  assert.equal(brackets[0].reason, "empty-match-stubs");
  assert.deepEqual(parseBrackets("== Knockout Stage =="), []);
});

test("a wiki that never inlines brackets is answered without a request", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const result = await liquipediaBrackets("leagueoflegends", "Worlds/2025", {
    read: reader({ "Worlds/2025": WORLDS }, calls),
  });
  assert.deepEqual(result, { brackets: [], gap: "unsupported-wiki" });
  assert.equal(calls.length, 0);
});

test("section outline comes out of wikitext, off the 30 second parse lane", () => {
  assert.deepEqual(parseSections(IEM), [
    { line: "Format", level: 2, anchor: "Format" },
    { line: "Swiss Stage", level: 3, anchor: "Swiss_Stage" },
    { line: "Prize Pool", level: 2, anchor: "Prize_Pool" },
    { line: "Playoffs", level: 2, anchor: "Playoffs" },
  ]);
});

test("page urls underscore each segment of a subpage", () => {
  assert.equal(
    liquipediaPageUrl("dota2", "The International/2025"),
    "https://liquipedia.net/dota2/The_International/2025",
  );
  assert.equal(liquipediaCredit("dota2", "x").licenceUrl.startsWith("https://"), true);
});

test("the queue honours both published rate limits", () => {
  const first = reserveLiquipediaSlot({ generalAt: 0, parseAt: 0 }, false, 1_000);
  assert.equal(first.at, 1_000);
  assert.deepEqual(first.lanes, { generalAt: 3_000, parseAt: 0 });
  // A second plain read waits the full 2 seconds, not the 100ms the caller asked for.
  const second = reserveLiquipediaSlot(first.lanes, false, 1_100);
  assert.equal(second.at, 3_000);
  // A parse still waits on the general lane, and books 30 seconds of its own.
  const parse = reserveLiquipediaSlot(second.lanes, true, 3_100);
  assert.equal(parse.at, 5_000);
  assert.equal(parse.lanes.parseAt, 35_000);
  assert.equal(reserveLiquipediaSlot(parse.lanes, true, 7_000).at, 35_000);
  // ...but a plain read is never held behind the parse lane.
  assert.equal(reserveLiquipediaSlot(parse.lanes, false, 7_100).at, 7_100);
});

test("league read sends the required headers and resolves the transclusion", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const league = await liquipediaLeague("dota2", "The International/2025", {
    read: reader(
      { "The International/2025": TI, "The International/2025/prizepool": "2,881,791" },
      calls,
    ),
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/liquipedia\.net\/dota2\/api\.php\?/);
  assert.ok(calls[0].url.includes("prop=revisions"));
  assert.ok(calls[0].url.includes("rvslots=main"));
  assert.equal(calls[0].headers["Accept-Encoding"], "gzip");
  assert.equal(calls[0].headers["User-Agent"], calls[0].headers["Api-User-Agent"]);
  assert.match(calls[0].headers["User-Agent"], /^HarborEsports\/1\.0 \(https:\/\/harbor\.site; /);
  assert.equal(new URL(calls[1].url).searchParams.get("titles"), "The International/2025/prizepool");
  assert.equal(league?.prizePoolUsd, 2881791);
  assert.equal(league?.city, "Hamburg");
});

test("a cached page costs no request, and a failed refetch serves it stale", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const warm = await liquipediaWikitext("dota2", "The International/2025", {
    read: reader({ "The International/2025": TI }, calls),
  });
  assert.equal(calls.length, 0);
  assert.equal(warm?.stale, false);
  assert.ok(warm?.text.includes("Infobox league"));
  const stale = await liquipediaWikitext("dota2", "The International/2025", {
    ttlMs: 0,
    read: async () => {
      throw new Error("edge is down");
    },
  });
  assert.equal(stale?.stale, true);
  assert.ok(stale?.text.includes("Infobox league"));
});
