import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import {
  createYoutubeRequestPool,
  decodeSportsYoutubeCache,
  parseSportsYoutubeFeed,
  parseSportsYoutubeChannelPage,
  sportsYoutubeRelevant,
  sportsYoutubeVideoId,
  selectSportsYoutubeVideos,
} from "../src/lib/sports/youtube-videos.ts";

const now = Date.parse("2026-09-14T00:00:00Z");
const published = "2026-09-13T11:45:22+00:00";
const event = {
  names: ["Joshua Van", "Alexandre Pantoja"],
  league: "UFC",
  eventTitle: "UFC 331: Van vs. Pantoja 2",
  eventStartMs: Date.parse("2026-09-20T00:00:00Z"),
};

const leagueClip = (overrides: Record<string, unknown> = {}) => ({
  id: "ulj_IZbwCo8",
  title: "ALL GOALS MATCHDAY 4 | LALIGA EA SPORTS 2026/27",
  description: "Official league highlights",
  published,
  channel: "LALIGA",
  url: "https://www.youtube.com/watch?v=ulj_IZbwCo8",
  image: "https://i.ytimg.com/vi/ulj_IZbwCo8/hqdefault.jpg",
  ...overrides,
});
const leagueQuery = {
  league: "LALIGA",
  names: ["Real Madrid", "Valencia"],
  eventTitle: "Real Madrid vs Valencia",
};

test("unrelated league footage is never returned, even with a leftover opt-in flag", () => {
  assert.deepEqual(selectSportsYoutubeVideos([leagueClip()], leagueQuery, now), []);
  assert.deepEqual(
    selectSportsYoutubeVideos([leagueClip()], { ...leagueQuery, allowLeaguePreview: true }, now),
    [],
  );
  const exact = leagueClip({
    id: "x1YVBfP4TTs",
    title: "Real Madrid vs Valencia | Match Preview",
  });
  const clips = selectSportsYoutubeVideos([leagueClip(), exact, exact], leagueQuery, now);
  assert.deepEqual(
    clips.map((clip) => clip.id),
    ["x1YVBfP4TTs"],
  );
  assert.equal(clips[0].scope, "event");
});

const basketball = {
  league: "NBA",
  names: ["New York Knicks", "Los Angeles Lakers"],
  eventTitle: "New York Knicks vs Los Angeles Lakers",
  eventStartMs: Date.parse("2026-09-15T23:00:00Z"),
  participants: [
    { name: "Los Angeles Lakers", abbr: "LAL" },
    { name: "New York Knicks", abbr: "NYK" },
  ],
};
const football = {
  league: "EPL",
  names: ["Manchester United", "Tottenham Hotspur"],
  eventTitle: "Manchester United v Tottenham Hotspur",
  eventStartMs: Date.parse("2026-09-15T19:00:00Z"),
};

test("matches common team naming, punctuation, away/home order and provided abbreviations", () => {
  for (const title of [
    "NY Knicks @ LA Lakers | Preview",
    "N.Y. Knicks vs. L.A. Lakers | Preview",
    "Lakers v Knicks - Game Preview",
    "NYK at LAL | Preview",
    "LAL vs NYK | PREVIEW",
  ])
    assert.equal(sportsYoutubeRelevant(title, "", published, basketball, now), true, title);
  for (const title of [
    "Man Utd v Spurs | Match Preview",
    "Tottenham versus Manchester Utd | Preview",
    "Manchester United FC vs Spurs | PREVIEW",
  ])
    assert.equal(sportsYoutubeRelevant(title, "", published, football, now), true, title);
  assert.equal(
    sportsYoutubeRelevant(
      "Atlético Madrid vs. Real Madrid Preview",
      "",
      published,
      {
        league: "LALIGA",
        names: ["Atletico Madrid", "Real Madrid"],
        eventTitle: "Atletico Madrid v Real Madrid",
      },
      now,
    ),
    true,
  );
});

test("rejects ambiguous cities, one-sided names, wrong opponents and conflicting metadata aliases", () => {
  assert.equal(
    sportsYoutubeRelevant(
      "Premier League Matchweek 5 Preview",
      "Manchester United vs Tottenham Hotspur leads our roundup",
      published,
      football,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Knicks Game Preview",
      "New York Knicks face Los Angeles Lakers on Tuesday",
      published,
      basketball,
      now,
    ),
    true,
  );
  for (const title of [
    "New York vs Los Angeles | Preview",
    "Knicks vs Clippers | Preview",
    "Knicks Game Preview",
    "Lakers vs Nets | Preview",
    "LA vs NY | Preview",
  ])
    assert.equal(
      sportsYoutubeRelevant(
        title,
        "New York Knicks and Los Angeles Lakers are discussed.",
        published,
        basketball,
        now,
      ),
      false,
      title,
    );
  assert.equal(
    sportsYoutubeRelevant(
      "Man Utd v Chelsea | Preview",
      "Manchester United meet Tottenham Hotspur next week.",
      published,
      football,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Manchester v Manchester | Preview",
      "",
      published,
      { ...football, names: ["Manchester United", "Manchester City"] },
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Spurs vs Lakers Preview",
      "",
      published,
      { ...basketball, names: ["Tottenham Hotspur", "Los Angeles Lakers"] },
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "NYK vs LAL Preview",
      "",
      published,
      { ...basketball, participants: [{ name: "New York Nets", abbr: "NYK" }] },
      now,
    ),
    false,
  );
});

test("surname-only fighter titles need full identities in description or the matching event number", () => {
  const title = "Van vs Pantoja 2 | Preview";
  assert.equal(sportsYoutubeRelevant(title, "", published, event, now), false);
  assert.equal(
    sportsYoutubeRelevant(
      title,
      "Joshua Van faces Alexandre Pantoja in the rematch.",
      published,
      event,
      now,
    ),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant("UFC 331: Van vs Pantoja 2 | Countdown", "", published, event, now),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "UFC 330: Van vs Pantoja 2 | Countdown",
      "Joshua Van faces Alexandre Pantoja",
      published,
      event,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant("UFC 331: Van vs Pantoja 1 | Preview", "", published, event, now),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "UFC 331: Van vs Moreno | Preview",
      "Joshua Van faces Alexandre Pantoja",
      published,
      event,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Adam Van vs Pantoja 2 | Preview",
      "Joshua Van faces Alexandre Pantoja",
      published,
      event,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Van vs Van | Preview",
      "Joshua Van faces Danny Van",
      published,
      {
        ...event,
        names: ["Joshua Van", "Danny Van"],
        eventTitle: "Joshua Van vs Danny Van",
      },
      now,
    ),
    false,
  );
});

test("future fixtures reject previous-game highlights and dated previews of another meeting", () => {
  for (const title of [
    "Knicks vs Lakers | FULL GAME HIGHLIGHTS",
    "NYK at LAL | Full Game",
    "Lakers vs Knicks | Postgame reaction",
    "Knicks vs Lakers | Preview September 12, 2026",
    "Knicks vs Lakers | Preview 2026-09-12",
    "Knicks vs Lakers | Preview 9/12/26",
    "Knicks vs Lakers | Preview 2025",
  ])
    assert.equal(sportsYoutubeRelevant(title, "", published, basketball, now), false, title);
  assert.equal(
    sportsYoutubeRelevant(
      "Knicks vs Lakers | Preview September 15, 2026",
      "",
      published,
      basketball,
      now,
    ),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant("Knicks vs Lakers | Preview 9/15/26", "", published, basketball, now),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Van vs Pantoja | Highlights",
      "Joshua Van and Alexandre Pantoja",
      published,
      event,
      now,
    ),
    false,
  );
});

test("completed-event highlights must follow the selected fixture rather than a previous game", () => {
  const completed = {
    ...basketball,
    eventStartMs: Date.parse("2026-09-13T01:00:00Z"),
  };
  assert.equal(
    sportsYoutubeRelevant("Knicks vs Lakers | Game Highlights", "", published, completed, now),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Knicks vs Lakers | Game Highlights",
      "",
      "2026-09-11T12:00:00Z",
      completed,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Knicks vs Lakers | Game Highlights 9/10/26",
      "",
      published,
      completed,
      now,
    ),
    false,
  );
});

test("a specific Contender Series episode matches before fighters appear in its title", () => {
  const query = {
    ...event,
    eventTitle: "Dana White’s Contender Series: Season10, Week6",
  };
  assert.equal(
    sportsYoutubeRelevant(
      "Dana White's Contender Series: Season 10, Week 6 | Preview",
      "",
      published,
      query,
      now,
    ),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Dana White's Contender Series: Season 10, Week 7 | Preview",
      "Joshua Van and Alexandre Pantoja",
      published,
      query,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Dana White's Contender Series: Season 9, Week 6 | Preview",
      "",
      published,
      query,
      now,
    ),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant(
      "Premier League Round 6 Preview",
      "",
      published,
      { ...football, eventTitle: "Premier League Round 6" },
      now,
    ),
    false,
  );
});

test("restores only bounded, recent official-channel cache and rebuilds safe URLs", () => {
  const video = {
    id: "x1YVBfP4TTs",
    title: "UFC 331 Countdown",
    published,
    url: "https://evil.test",
    image: "https://evil.test",
    channel: "Imposter",
    description: "Joshua Van",
  };
  const feed = {
    id: "UCvgfXK4nTYKudb0rFR6noLA",
    at: now - 60_000,
    videos: [video],
  };
  const read = (feeds: unknown[]) =>
    decodeSportsYoutubeCache(JSON.stringify({ version: 1, feeds }), now);
  const cache = read([feed]);
  assert.equal(cache.length, 1);
  assert.equal(cache[0][1].videos[0].url, "https://www.youtube.com/watch?v=x1YVBfP4TTs");
  assert.equal(cache[0][1].videos[0].channel, "UFC");
  assert.equal(read([{ ...feed, id: "unverified" }]).length, 0);
  assert.equal(read([{ ...feed, at: now - 86_400_000 }]).length, 0);
  assert.equal(read([{ ...feed, at: now + 86_400_000 }]).length, 0);
  assert.equal(read([{ ...feed, videos: Array(40).fill(video) }])[0][1].videos.length, 30);
  assert.equal(read(Array(30).fill(feed)).length, 21);
  assert.equal(decodeSportsYoutubeCache("x".repeat(1_000_001), now).length, 0);
  assert.equal(decodeSportsYoutubeCache("{malformed", now).length, 0);
});

test("accepts only canonical public YouTube video identifiers", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=x1YVBfP4TTs&feature=share",
    "https://youtu.be/x1YVBfP4TTs",
    "https://youtube.com/shorts/x1YVBfP4TTs",
    "https://youtube-nocookie.com/embed/x1YVBfP4TTs",
  ])
    assert.equal(sportsYoutubeVideoId(url), "x1YVBfP4TTs");
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=x1YVBfP4TTs",
    "https://youtube.com@evil.test/watch?v=x1YVBfP4TTs",
    "https://user@youtube.com/watch?v=x1YVBfP4TTs",
    "http://youtube.com/watch?v=x1YVBfP4TTs",
    "https://youtu.be/x1YVBfP4TTs/another",
    "https://youtube.com/playlist?list=x1YVBfP4TTs",
    "https://youtube.com/watch?v=invalid",
  ])
    assert.equal(sportsYoutubeVideoId(url), null, url);
});

test("matches the exact numbered event with shortened names and rejects another card", () => {
  assert.equal(
    sportsYoutubeRelevant("Crypto.com UFC 331 Countdown - Full Episode", "", published, event, now),
    true,
  );
  assert.equal(sportsYoutubeRelevant("UFC331 Countdown", "", published, event, now), true);
  assert.equal(
    sportsYoutubeRelevant(
      "UFC 330 Highlights",
      "Joshua Van and Alexandre Pantoja",
      published,
      event,
      now,
    ),
    false,
  );
  assert.equal(sportsYoutubeRelevant("UFC 331 Throwback", "", published, event, now), false);
  assert.equal(sportsYoutubeRelevant("UFC 331 Preview 2025", "", published, event, now), false);
  assert.equal(
    sportsYoutubeRelevant("UFC 331 Countdown", "", "2026-07-01T00:00:00Z", event, now),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant("UFC 331 Countdown", "", "2026-09-15T00:00:00Z", event, now),
    false,
  );
});

test("requires every matchup name or the athlete's full name", () => {
  const query = { names: ["Joshua Van"] };
  assert.equal(
    sportsYoutubeRelevant(
      "Meet the champion",
      "Joshua Van prepares for his fight.",
      published,
      query,
      now,
    ),
    true,
  );
  assert.equal(sportsYoutubeRelevant("Van Highlights", "", published, query, now), false);
  assert.equal(sportsYoutubeRelevant("Joshua Van interview", "", published, event, now), false);
  assert.equal(
    sportsYoutubeRelevant("Joshua Van and Alexandre Pantoja face off", "", published, event, now),
    true,
  );
  assert.equal(
    sportsYoutubeRelevant("Anything UFC", "", published, { names: ["TBA"] }, now),
    false,
  );
  assert.equal(
    sportsYoutubeRelevant("Joshua Van interview", "", "2026-01-01T00:00:00Z", query, now),
    false,
  );
});

test("binds parsed RSS entries to the official channel and bounds malformed input", () => {
  const channel = { id: "UCvgfXK4nTYKudb0rFR6noLA", name: "UFC" };
  const entry = `<entry><yt:videoId>x1YVBfP4TTs</yt:videoId><yt:channelId>${channel.id}</yt:channelId><title>UFC 331 &amp; Countdown</title><published>${published}</published><media:description><![CDATA[Joshua Van & Alexandre Pantoja]]></media:description></entry>`;
  const parsed = parseSportsYoutubeFeed(`<feed>${entry}</feed>`, channel);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "UFC 331 & Countdown");
  assert.equal(parsed[0].description, "Joshua Van & Alexandre Pantoja");
  assert.equal(parsed[0].image, "https://i.ytimg.com/vi/x1YVBfP4TTs/hqdefault.jpg");
  assert.equal(
    parseSportsYoutubeFeed(`<feed>${entry}</feed>`, {
      ...channel,
      id: "another-channel",
    }).length,
    0,
  );
  assert.equal(
    parseSportsYoutubeFeed(
      `<!DOCTYPE feed SYSTEM 'http://example.test/entity'><feed>${entry}</feed>`,
      channel,
    ).length,
    0,
  );
  assert.equal(
    parseSportsYoutubeFeed("<feed>" + "x".repeat(600_000) + "</feed>", channel).length,
    0,
  );
  assert.equal(parseSportsYoutubeFeed(`<feed>${entry.repeat(40)}</feed>`, channel).length, 30);
});

function controlledFetcher() {
  const started: string[] = [];
  const jobs = new Map<string, { signal: AbortSignal; finish: (value: string) => void }>();
  const fetcher = (url: string, signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      started.push(url);
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      jobs.set(url, {
        signal,
        finish: (value) => {
          signal.removeEventListener("abort", abort);
          resolve(value);
        },
      });
    });
  return { fetcher, started, jobs };
}

test("official channel fallback reads published JSON and excludes live/upcoming clips", () => {
  const channel = { id: "UCvgfXK4nTYKudb0rFR6noLA", name: "UFC" };
  const clip = {
    videoId: "x1YVBfP4TTs",
    title: { runs: [{ text: "UFC 331 Countdown" }] },
    description: { runs: [{ text: "Joshua Van faces Alexandre Pantoja" }] },
    publishedTimeText: { runs: [{ text: "16 hours ago" }] },
  };
  const page = (clips: unknown[], id = channel.id) =>
    `<script>var ytInitialData = ${JSON.stringify({ metadata: { channelMetadataRenderer: { externalId: id } }, contents: clips })};</script>`;
  const good = parseSportsYoutubeChannelPage(
    page([{ channelVideoPlayerRenderer: clip }]),
    channel,
    now,
  );
  assert.equal(good.length, 1);
  assert.equal(good[0].publishedApproximate, true);
  assert.equal(
    parseSportsYoutubeChannelPage(
      page([
        {
          videoRenderer: {
            ...clip,
            ownerText: {
              runs: [
                {
                  navigationEndpoint: {
                    browseEndpoint: { browseId: "another-publisher" },
                  },
                },
              ],
            },
          },
        },
      ]),
      channel,
      now,
    ).length,
    0,
  );
  assert.equal(Date.parse(good[0].published), now - 16 * 3_600_000);
  assert.equal(
    sportsYoutubeRelevant(good[0].title, good[0].description, good[0].published, event, now),
    true,
  );
  assert.equal(
    parseSportsYoutubeChannelPage(page([{ videoRenderer: clip }], "other"), channel, now).length,
    0,
  );
  assert.equal(
    parseSportsYoutubeChannelPage(
      page([{ videoRenderer: { ...clip, upcomingEventData: { startTime: "123" } } }]),
      channel,
      now,
    ).length,
    0,
  );
  assert.equal(
    parseSportsYoutubeChannelPage(
      page([
        {
          videoRenderer: {
            ...clip,
            badges: [{ metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_LIVE_NOW" } }],
          },
        },
      ]),
      channel,
      now,
    ).length,
    0,
  );
  assert.equal(
    parseSportsYoutubeChannelPage(
      page([
        {
          videoRenderer: {
            ...clip,
            publishedTimeText: { simpleText: "Scheduled for tomorrow" },
          },
        },
      ]),
      channel,
      now,
    ).length,
    0,
  );
  assert.equal(
    parseSportsYoutubeChannelPage("<script>not published JSON</script>", channel, now).length,
    0,
  );
  assert.equal(parseSportsYoutubeChannelPage("x".repeat(4_000_001), channel, now).length, 0);
});

test("caps active and queued requests and reserves freed slots in queue order", async () => {
  const { fetcher, started, jobs } = controlledFetcher();
  const request = createYoutubeRequestPool(fetcher, 2, 2);
  const controller = new AbortController();
  const first = request("first", controller.signal);
  const second = request("second", controller.signal);
  const third = request("third", controller.signal);
  const fourth = request("fourth", controller.signal);
  await assert.rejects(request("overflow", controller.signal), /busy/);
  await tick();
  assert.deepEqual(started, ["first", "second"]);
  jobs.get("first")!.finish("one");
  assert.equal(await first, "one");
  const fifth = request("fifth", controller.signal);
  await tick();
  assert.deepEqual(started, ["first", "second", "third"]);
  jobs.get("second")!.finish("two");
  assert.equal(await second, "two");
  await tick();
  assert.deepEqual(started, ["first", "second", "third", "fourth"]);
  jobs.get("third")!.finish("three");
  assert.equal(await third, "three");
  await tick();
  assert.deepEqual(started, ["first", "second", "third", "fourth", "fifth"]);
  jobs.get("fourth")!.finish("four");
  jobs.get("fifth")!.finish("five");
  assert.deepEqual(await Promise.all([fourth, fifth]), ["four", "five"]);
});

test("leaving a hover removes its queued request without ever fetching it", async () => {
  const { fetcher, started, jobs } = controlledFetcher();
  const request = createYoutubeRequestPool(fetcher, 1, 1);
  const current = new AbortController();
  const departed = new AbortController();
  const first = request("current", current.signal);
  const abandoned = request("departed", departed.signal);
  const rejected = assert.rejects(abandoned, { name: "AbortError" });
  departed.abort();
  await rejected;
  const next = request("next", current.signal);
  await tick();
  assert.deepEqual(started, ["current"]);
  jobs.get("current")!.finish("one");
  await first;
  await tick();
  assert.deepEqual(started, ["current", "next"]);
  jobs.get("next")!.finish("two");
  await next;
});

test("leaving an active hover aborts its transport and allows the next caller through", async () => {
  const { fetcher, started, jobs } = controlledFetcher();
  const request = createYoutubeRequestPool(fetcher, 1, 1);
  const departed = new AbortController();
  const remaining = new AbortController();
  const active = request("departed", departed.signal);
  const rejected = assert.rejects(active, { name: "AbortError" });
  const next = request("remaining", remaining.signal);
  await tick();
  departed.abort();
  await rejected;
  await tick();
  assert.equal(jobs.get("departed")!.signal.aborted, true);
  assert.deepEqual(started, ["departed", "remaining"]);
  assert.equal(jobs.get("remaining")!.signal.aborted, false);
  jobs.get("remaining")!.finish("next");
  assert.equal(await next, "next");
});

test("an already aborted request never takes a slot; timeout aborts a hung transport", async () => {
  let calls = 0;
  let transportSignal: AbortSignal | undefined;
  const request = createYoutubeRequestPool(
    (_url, signal) => {
      calls++;
      transportSignal = signal;
      return new Promise<string>(() => {});
    },
    1,
    1,
    20,
  );
  const departed = new AbortController();
  departed.abort();
  await assert.rejects(request("cancelled", departed.signal), {
    name: "AbortError",
  });
  assert.equal(calls, 0);
  await assert.rejects(request("hung", new AbortController().signal), {
    name: "TimeoutError",
  });
  assert.equal(calls, 1);
  assert.equal(transportSignal!.aborted, true);
});
