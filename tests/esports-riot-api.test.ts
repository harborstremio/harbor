import assert from "node:assert/strict";
import test from "node:test";
import {
  RIOT_ESPORTS_API_KEY,
  RiotFeedError,
  assertRiotTitle,
  detectRiotTitle,
  fetchRiotEventDetails,
  fetchRiotLive,
  fetchRiotSchedule,
  parseRiotEventVods,
  parseRiotLive,
  parseRiotSchedule,
  parseRiotStreams,
  requestRiotJson,
  riotEventDetailsUrl,
  riotFeedFailure,
  riotGameIds,
  riotLiveStatsWindowUrl,
  riotLiveUrl,
  riotScheduleUrl,
  riotSlugTitle,
} from "../src/lib/sports/esports-riot-api.ts";

const now = Date.parse("2026-09-30T12:00:00Z");
const UPCOMING = "2026-09-30T14:00:00Z";
const LIVE = "2026-09-30T11:00:00Z";
const COMPLETED = "2026-09-29T16:00:00Z";

const team = (code: string, name: string, extra: Record<string, unknown> = {}) => ({
  code,
  name,
  image: `http://static.lolesports.com/teams/${code.toLowerCase()}.png`,
  result: { outcome: null, gameWins: 0 },
  record: { wins: 3, losses: 1 },
  ...extra,
});

const valEvent = (overrides: Record<string, unknown> = {}) => ({
  startTime: UPCOMING,
  state: "unstarted",
  type: "match",
  blockName: "Playoffs",
  league: {
    name: "VCT Pacific",
    slug: "vct_pacific",
    image: "http://static.lolesports.com/leagues/vct_pacific.png",
    priority: 101,
  },
  match: {
    id: "113475181156537362",
    flags: ["hasVod"],
    teams: [team("GEN", "Gen.G"), team("DRX", "DRX")],
    strategy: { type: "bestOf", count: 3 },
  },
  ...overrides,
});

const lolEvent = (overrides: Record<string, unknown> = {}) => ({
  startTime: COMPLETED,
  state: "completed",
  type: "match",
  blockName: "Week 3",
  league: { name: "LEC", slug: "lec", image: "https://static.lolesports.com/leagues/lec.png" },
  tournament: { id: "113478100418307191" },
  match: {
    id: "113478100418307222",
    teams: [
      team("G2", "G2 Esports", { result: { outcome: "win", gameWins: 2 } }),
      team("FNC", "Fnatic", { result: { outcome: "loss", gameWins: 1 } }),
    ],
    strategy: { type: "bestOf", count: 3 },
  },
  ...overrides,
});

const schedule = (...events: unknown[]) => ({
  data: { schedule: { pages: { older: "older", newer: null }, events } },
});

const twitchStream = (parameter: string, locale: string, translatedName: string) => ({
  parameter,
  locale,
  mediaLocale: { locale, englishName: translatedName, translatedName },
  provider: "twitch",
  countries: locale === "en-GB" ? ["GB", "IE"] : [],
  offset: -60_000,
  statsStatus: "enabled",
});

type StubInit = { status?: number; text?: string };
function stubFetch(body: unknown, init: StubInit = {}) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const status = init.status ?? 200;
  const fetchImpl = async (url: string, request: { headers: Record<string, string> }) => {
    calls.push({ url, headers: request.headers });
    return {
      ok: status < 400,
      status,
      text: async () => init.text ?? JSON.stringify(body),
    };
  };
  return { fetchImpl, calls };
}

const failureOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return riotFeedFailure(error);
  }
};

test("VALORANT needs both the val path and sport=val; LoL must not carry the sport param", () => {
  assert.equal(
    riotScheduleUrl("valorant"),
    "https://esports-api.lolesports.com/persisted/val/getSchedule?hl=en-US&sport=val",
  );
  assert.equal(
    riotScheduleUrl("lol"),
    "https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US",
  );
  assert.equal(
    riotLiveUrl("valorant", "ar-AE"),
    "https://esports-api.lolesports.com/persisted/val/getLive?hl=ar-AE&sport=val",
  );
  assert.equal(
    riotEventDetailsUrl("lol", "113478100418307222"),
    "https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=en-US&id=113478100418307222",
  );
  assert.equal(
    failureOf(() => riotEventDetailsUrl("lol", "../getSchedule")),
    "malformed",
  );
});

test("the mandatory key ships as a constant and travels as x-api-key", () => {
  assert.equal(RIOT_ESPORTS_API_KEY, "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z");
  const stub = stubFetch(schedule(valEvent()));
  return requestRiotJson(riotScheduleUrl("valorant"), { fetchImpl: stub.fetchImpl }).then(() => {
    assert.deepEqual(stub.calls[0].headers, { "x-api-key": RIOT_ESPORTS_API_KEY });
  });
});

test("a 403 is a rotated key, never an empty schedule", async () => {
  const stub = stubFetch(null, { status: 403, text: '{"message":"Forbidden"}' });
  await assert.rejects(
    fetchRiotSchedule("valorant", { fetchImpl: stub.fetchImpl }),
    (error: unknown) => {
      const thrown = error instanceof RiotFeedError ? error : null;
      assert.equal(thrown?.failure, "key-rotated");
      assert.equal(thrown?.status, 403);
      return true;
    },
  );
});

test("other transport faults stay distinguishable from a rotated key", async () => {
  const server = stubFetch(null, { status: 500, text: "oops" });
  assert.equal(
    await requestRiotJson("https://esports-api.lolesports.com/x", {
      fetchImpl: server.fetchImpl,
    }).then(
      () => null,
      (error: unknown) => riotFeedFailure(error),
    ),
    "unavailable",
  );
  const garbage = stubFetch(null, { text: "<html>maintenance</html>" });
  assert.equal(
    await requestRiotJson("https://esports-api.lolesports.com/x", {
      fetchImpl: garbage.fetchImpl,
    }).then(
      () => null,
      (error: unknown) => riotFeedFailure(error),
    ),
    "malformed",
  );
  const offline = async () => {
    throw new Error("network down");
  };
  assert.equal(
    await requestRiotJson("https://esports-api.lolesports.com/x", { fetchImpl: offline }).then(
      () => null,
      (error: unknown) => riotFeedFailure(error),
    ),
    "unavailable",
  );
});

test("a caller abort is rethrown rather than reported as an unavailable feed", async () => {
  const aborted = async () => {
    throw Object.assign(new Error("Aborted"), { name: "AbortError" });
  };
  await assert.rejects(
    requestRiotJson("https://esports-api.lolesports.com/x", { fetchImpl: aborted }),
    (error: unknown) => (error as Error).name === "AbortError",
  );
});

test("a league slug is the only proof of which title answered", () => {
  assert.equal(riotSlugTitle("vct_americas"), "valorant");
  assert.equal(riotSlugTitle("game_changers_na"), "valorant");
  assert.equal(riotSlugTitle("champions"), "valorant");
  assert.equal(riotSlugTitle("lck"), "lol");
  assert.equal(riotSlugTitle("emea_masters"), "lol");
  assert.equal(riotSlugTitle("some_new_league"), null);
  assert.equal(detectRiotTitle(schedule(valEvent())), "valorant");
  assert.equal(detectRiotTitle(schedule(lolEvent())), "lol");
  assert.equal(detectRiotTitle(schedule(lolEvent(), valEvent())), null);
});

test("the val endpoint answering with LoL data throws rather than filling the rail", () => {
  const lolPayload = schedule(
    lolEvent(),
    lolEvent({ match: { id: "113478100418307333", teams: [team("T1", "T1"), team("HLE", "HLE")] } }),
  );
  assert.equal(
    failureOf(() => assertRiotTitle(lolPayload, "valorant")),
    "title-mismatch",
  );
  assert.equal(
    failureOf(() => parseRiotSchedule(lolPayload, "valorant", now)),
    "title-mismatch",
  );
  assert.equal(parseRiotSchedule(lolPayload, "lol", now).length, 2);
});

test("an unrecognizable or empty schedule is reported, not shown as nothing scheduled", () => {
  const unknown = schedule(valEvent({ league: { name: "New Cup", slug: "new_cup" } }));
  assert.equal(
    failureOf(() => parseRiotSchedule(unknown, "valorant", now)),
    "title-unknown",
  );
  assert.equal(
    failureOf(() => parseRiotSchedule(schedule(), "valorant", now)),
    "title-unknown",
  );
  assert.equal(
    failureOf(() => parseRiotSchedule({ errors: [{ message: "x" }] }, "valorant", now)),
    "malformed",
  );
});

test("schedule rows carry Harbor's match shape, league name first for the rail filter", () => {
  const [match] = parseRiotSchedule(schedule(valEvent()), "valorant", now);
  assert.equal(match.id, "113475181156537362");
  assert.equal(match.game, "valorant");
  assert.equal(match.state, "upcoming");
  assert.equal(match.startMs, Date.parse(UPCOMING));
  assert.equal(match.event.name, "VCT Pacific");
  assert.equal(match.event.name.split("·")[0].trim().toUpperCase(), "VCT PACIFIC");
  assert.equal(match.event.stage, "Playoffs");
  assert.equal(match.event.logo, "https://static.lolesports.com/leagues/vct_pacific.png");
  assert.equal(match.teams[0].name, "Gen.G");
  assert.equal(match.teams[0].code, "GEN");
  assert.equal(match.teams[0].id, "gen");
  assert.equal(match.teams[0].logo, "https://static.lolesports.com/teams/gen.png");
  assert.equal(match.teams[0].score, undefined);
  assert.equal(match.bestOf, 3);
  assert.deepEqual(match.streams, []);
  assert.equal(match.sourceUrl, "https://valorantesports.com/en-US/schedule");
});

test("a finished row keeps scores, the winner and the tournament deep link", () => {
  const [match] = parseRiotSchedule(schedule(lolEvent()), "lol", now);
  assert.equal(match.state, "recent");
  assert.equal(match.teams[0].score, 2);
  assert.equal(match.teams[0].winner, true);
  assert.equal(match.teams[1].score, 1);
  assert.equal(match.teams[1].winner, false);
  assert.equal(match.sourceUrl, "https://lolesports.com/en-US/tournament/113478100418307191");
});

test("playAll series are not reported as a best of, and non match rows never reach teams", () => {
  const playAll = lolEvent({
    match: { id: "113478100418307223", teams: [team("T1", "T1"), team("GEN", "Gen.G")] },
  });
  assert.equal(parseRiotSchedule(schedule(playAll), "lol", now)[0].bestOf, undefined);
  const noTeams = lolEvent({ match: { id: "113478100418307224" } });
  assert.deepEqual(parseRiotSchedule(schedule(noTeams), "lol", now), []);
});

test("a live show with no match object yields a broadcast card and never a crash", () => {
  const show = {
    id: "114110073306867810",
    startTime: LIVE,
    state: "inProgress",
    type: "show",
    blockName: "Opening ceremony",
    league: { id: "98767991302996019", slug: "lec", name: "LEC" },
    tournament: { id: "113478100418307191" },
    streams: [twitchStream("lec", "en-GB", "English (Europe)")],
  };
  const board = parseRiotLive({ data: { schedule: { events: [show] } } }, "lol", now);
  assert.deepEqual(board.matches, []);
  assert.equal(board.broadcasts.length, 1);
  assert.equal(board.broadcasts[0].id, "114110073306867810");
  assert.equal(board.broadcasts[0].state, "live");
  assert.equal(board.broadcasts[0].event.name, "LEC");
  assert.equal(board.broadcasts[0].streams[0].url, "https://www.twitch.tv/lec");
  assert.equal(
    board.broadcasts[0].sourceUrl,
    "https://lolesports.com/en-US/tournament/113478100418307191",
  );
});

test("an empty live board is normal, while a changed live envelope is not", () => {
  assert.deepEqual(parseRiotLive(schedule(), "valorant", now), { matches: [], broadcasts: [] });
  assert.equal(
    failureOf(() => parseRiotLive({ data: {} }, "valorant", now)),
    "malformed",
  );
});

test("live matches arrive with their per language channels attached", () => {
  const live = valEvent({
    startTime: LIVE,
    state: "inProgress",
    match: {
      id: "113475181156537362",
      teams: [
        team("GEN", "Gen.G", { result: { outcome: null, gameWins: 1 } }),
        team("DRX", "DRX", { result: { outcome: null, gameWins: 0 } }),
      ],
      strategy: { type: "bestOf", count: 3 },
    },
    streams: [
      twitchStream("valorant_pacific", "en-US", "English"),
      twitchStream("valorant_pacific_ko", "ko-KR", "한국어"),
    ],
  });
  const board = parseRiotLive({ data: { schedule: { events: [live] } } }, "valorant", now);
  assert.equal(board.matches.length, 1);
  assert.equal(board.matches[0].state, "live");
  assert.equal(board.matches[0].teams[0].score, 1);
  assert.deepEqual(
    board.matches[0].streams.map((stream) => stream.url),
    ["https://www.twitch.tv/valorant_pacific", "https://www.twitch.tv/valorant_pacific_ko"],
  );
  assert.deepEqual(board.broadcasts, []);
});

test("stream extraction keeps the translated language label, locale and countries", () => {
  const streams = parseRiotStreams([
    twitchStream("lec", "en-GB", "English (Europe)"),
    twitchStream("lec", "en-GB", "English (Europe)"),
    { provider: "youtube", parameter: "dQw4w9WgXcQ", locale: "pt-BR", mediaLocale: {} },
    { provider: "huya", parameter: "123456", locale: "zh-CN", mediaLocale: {} },
    { provider: "twitch", parameter: "not a channel!", locale: "fr-FR", mediaLocale: {} },
  ]);
  assert.equal(streams.length, 2);
  assert.equal(streams[0].title, "English (Europe)");
  assert.equal(streams[0].platform, "twitch");
  assert.equal(streams[0].locale, "en-GB");
  assert.deepEqual(streams[0].countries, ["GB", "IE"]);
  assert.equal(streams[1].url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(streams[1].platform, "youtube");
  assert.equal(streams[1].title, "pt-BR");
});

const details = {
  data: {
    event: {
      id: "113478100418307222",
      type: "match",
      tournament: { id: "113478100418307191" },
      league: { id: "98767991302996019", slug: "lec", name: "LEC" },
      match: {
        strategy: { type: "bestOf", count: 5 },
        teams: [team("G2", "G2 Esports"), team("FNC", "Fnatic")],
        games: [
          {
            number: 1,
            id: "113478100418307999",
            state: "completed",
            vods: [
              {
                parameter: "dQw4w9WgXcQ",
                locale: "en-US",
                mediaLocale: { locale: "en-US", translatedName: "English" },
                provider: "youtube",
                startMillis: 93_000,
                endMillis: null,
              },
              {
                parameter: "2345678901",
                locale: "ko-KR",
                mediaLocale: { locale: "ko-KR", translatedName: "한국어" },
                provider: "twitch",
                startMillis: 3_723_000,
              },
            ],
          },
          { number: 2, id: "unplayed", state: "unneeded", vods: [] },
        ],
      },
      streams: [twitchStream("lec", "en-GB", "English (Europe)")],
    },
  },
};

test("event details expose per locale vods with their seek offsets", () => {
  const vods = parseRiotEventVods(details);
  assert.equal(vods.length, 2);
  assert.equal(vods[0].gameId, "113478100418307999");
  assert.equal(vods[0].gameNumber, 1);
  assert.equal(vods[0].locale, "en-US");
  assert.equal(vods[0].startMs, 93_000);
  assert.equal(vods[0].url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=93");
  assert.equal(vods[1].platform, "twitch");
  assert.equal(vods[1].url, "https://www.twitch.tv/videos/2345678901?t=1h2m3s");
});

test("the keyless live stats window only ever takes a game id", () => {
  const ids = riotGameIds(details);
  assert.deepEqual(ids, ["113478100418307999"]);
  assert.ok(!ids.includes("113478100418307222"), "a match id must never reach live stats");
  assert.equal(
    riotLiveStatsWindowUrl(ids[0]),
    "https://feed.lolesports.com/livestats/v1/window/113478100418307999",
  );
  assert.equal(
    riotLiveStatsWindowUrl(ids[0], "2026-09-30T11:00:00Z"),
    "https://feed.lolesports.com/livestats/v1/window/113478100418307999?startingTime=2026-09-30T11%3A00%3A00Z",
  );
  assert.equal(
    failureOf(() => riotLiveStatsWindowUrl("unplayed")),
    "malformed",
  );
});

test("the fetch wrappers request the right URL and return parsed matches", async () => {
  const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const stub = stubFetch(schedule(valEvent({ startTime: soon })));
  const matches = await fetchRiotSchedule("valorant", { fetchImpl: stub.fetchImpl });
  assert.equal(stub.calls[0].url, riotScheduleUrl("valorant"));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].game, "valorant");

  const liveStub = stubFetch(schedule());
  const board = await fetchRiotLive("lol", { fetchImpl: liveStub.fetchImpl });
  assert.equal(liveStub.calls[0].url, riotLiveUrl("lol"));
  assert.deepEqual(board, { matches: [], broadcasts: [] });

  const detailStub = stubFetch(details);
  const detail = await fetchRiotEventDetails("lol", "113478100418307222", {
    fetchImpl: detailStub.fetchImpl,
  });
  assert.equal(detailStub.calls[0].url, riotEventDetailsUrl("lol", "113478100418307222"));
  assert.equal(detail.vods.length, 2);
  assert.deepEqual(detail.gameIds, ["113478100418307999"]);
  assert.equal(detail.streams[0].url, "https://www.twitch.tv/lec");
});
