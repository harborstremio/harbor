import assert from "node:assert/strict";
import test from "node:test";
import { fetchXtreamVod, fetchXtreamSeries, fetchXtreamSeriesEpisodes, clearSeriesInfoCache } from "../src/lib/iptv/xtream-vod.ts";
import { buildVodLibrary, vodEpisodeFromChannel } from "../src/lib/iptv/vod.ts";
import { classifyChannel } from "../src/lib/iptv/vod-classify.ts";
import { matchVodMetadata, matchesVodSearch, vodSearchText } from "../src/lib/iptv/vod-match.ts";
import { scoreGroupForUser, sortChannelsByGroupRelevance } from "../src/lib/iptv/group-relevance.ts";
import { html5Transport } from "../src/lib/player/html5/transport.ts";
import type { IptvChannel, IptvPlaylist } from "../src/lib/iptv/types.ts";

const credentials = { base: "https://provider.invalid", username: "fixture", password: "synthetic-only" };
const channel = (id: string, name: string, overrides: Partial<IptvChannel> = {}): IptvChannel => ({ id, name, url: `https://media.invalid/${id}.mp4`, logo: null, group: null, tvgId: null, durationSec: null, catchupSource: null, attrs: {}, ...overrides });
const library = (channels: IptvChannel[]) => buildVodLibrary([{ id: "fixture", name: "Fixture", url: "", epgUrl: null, fetchedAt: 0, groups: [], channels } satisfies IptvPlaylist], new Map());

test("optional category failures do not discard movie and series catalogs", async t => {
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const action = new URL(input).searchParams.get("action")!;
    if (action.endsWith("categories")) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify(action === "get_vod_streams" ? [{ stream_id: 7, name: "Movie" }] : [{ series_id: 8, name: "Show" }]));
  });
  assert.equal((await fetchXtreamVod(credentials, "fixture"))[0].id, "fixture::xtvod::7");
  assert.equal((await fetchXtreamSeries(credentials, "fixture"))[0].id, "fixture::xtseries::8");
});

test("error-shaped catalogs are failures, not successful empty libraries", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "synthetic" })));
  await assert.rejects(fetchXtreamVod(credentials, "fixture"), /valid movie list/);
  await assert.rejects(fetchXtreamSeries(credentials, "fixture"), /valid series list/);
});

test("provider season zero, episode IDs and explicit numbers survive without reparsing display names", async t => {
  clearSeriesInfoCache();
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ episodes: { "0": [
    { id: 51, season: 0, episode_num: 2, title: "Special" },
    { id: 52, title: "Unnumbered bonus" },
    { id: 53, title: "Show S00E03" },
  ] } })));
  const channels = await fetchXtreamSeriesEpisodes(credentials, "fixture", { series_id: 1, name: "Show" });
  const episodes = channels.map(vodEpisodeFromChannel);
  assert.equal(episodes[0].season, 0);
  assert.equal(episodes[0].episode, 2);
  assert.equal(episodes[0].id, "fixture::xtep::51");
  assert.equal(episodes[1].numbered, false);
  assert.equal(episodes[2].season, 0);
  assert.equal(episodes[2].episode, 3);
  assert.match(episodes[0].url, /\/series\/fixture\/synthetic-only\/51$/);
});

test("failed episode replies are not cached and can be retried", async t => {
  clearSeriesInfoCache(); let requests = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(++requests === 1 ? { error: true } : { episodes: { "1": [{ id: 7, episode_num: 4 }] } })));
  await assert.rejects(fetchXtreamSeriesEpisodes(credentials, "fixture", { series_id: 9 }), /episode list/);
  assert.equal((await fetchXtreamSeriesEpisodes(credentials, "fixture", { series_id: 9 })).length, 1);
  assert.equal(requests, 2);
});

test("episode caches are isolated when a saved provider source changes", async t => {
  clearSeriesInfoCache(); let requests = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ episodes: { "1": [{ id: ++requests, episode_num: 1 }] } })));
  const first = await fetchXtreamSeriesEpisodes(credentials, "fixture", { series_id: 1 });
  const second = await fetchXtreamSeriesEpisodes({ ...credentials, username: "other-fixture" }, "fixture", { series_id: 1 });
  assert.notEqual(first[0].id, second[0].id);
  assert.equal(requests, 2);
});

test("cancelling an episode request does not publish or cache it", async t => {
  clearSeriesInfoCache(); const controller = new AbortController(); controller.abort();
  let requests = 0; t.mock.method(globalThis, "fetch", async () => { requests++; return new Response("{}"); });
  await assert.rejects(fetchXtreamSeriesEpisodes(credentials, "fixture", { series_id: 1 }, controller.signal), { name: "AbortError" });
  assert.equal(requests, 0);
});

test("distinct editions and language variants keep their provider IDs and headers", () => {
  const result = library([
    channel("a", "The Movie (2020)", { attrs: { "tvg-type": "movie", "http-user-agent": "FixtureAgent", "http-referrer": "https://provider.invalid" } }),
    channel("b", "The Movie (2020)", { group: "French", attrs: { "tvg-type": "movie" } }),
  ]);
  assert.deepEqual(result.movies.map(x => x.id), ["vod:a", "vod:b"]);
  assert.equal(result.movies[0].headers?.["User-Agent"], "FixtureAgent");
  assert.equal(result.movies[0].headers?.Referer, "https://provider.invalid");
});

test("different non-Latin series no longer collapse into one empty identity", () => {
  const result = library([channel("a", "日本物語 S01E01"), channel("b", "東京物語 S01E01")]);
  assert.equal(result.series.length, 2);
  assert.notEqual(result.series[0].id, result.series[1].id);
});

test("episode files remain series and signed query text never changes catalog type", () => {
  assert.equal(classifyChannel(channel("a", "Show S01E02")), "series");
  assert.equal(classifyChannel(channel("a", "Movie", { url: "https://media.invalid/movie.mp4?return=/live/test.m3u8" })), "movie");
  assert.equal(classifyChannel(channel("a", "News", { url: "https://media.invalid/live/1.ts?next=/movie/7.mp4" })), "live");
});

test("unknown M3U episode numbers are never fabricated from URL sorting", () => {
  const result = library([channel("b", "Show - Bonus B", { group: "Series" }), channel("a", "Show - Bonus A", { group: "Series" })]);
  assert.equal(result.series.length, 1);
  assert.ok(result.series[0].episodes.every(x => x.numbered === false));
  assert.deepEqual(new Set(result.series[0].episodes.map(x => x.id)), new Set(["a", "b"]));
});

test("search tolerates punctuation, word order and Latin accents without erasing Japanese marks", () => {
  assert.ok(matchesVodSearch(vodSearchText("Spider-Man: Across the Spider-Verse"), vodSearchText("spider verse")));
  assert.ok(matchesVodSearch(vodSearchText("Café Society"), vodSearchText("society cafe")));
  assert.notEqual(vodSearchText("バ"), vodSearchText("ハ"));
});

test("metadata requires a unique exact title/year and does not take the first search hit", () => {
  const wrong = { id: 1, title: "Other Movie", release_date: "2020-01-01" };
  const right = { id: 2, title: "The Movie", release_date: "2020-01-01" };
  assert.equal(matchVodMetadata([wrong, right], "The Movie", 2020), right);
  assert.equal(matchVodMetadata([wrong], "The Movie", null), null);
  assert.equal(matchVodMetadata([right], "The Movie", 2021), null);
  assert.equal(matchVodMetadata([right, { ...right, id: 3, release_date: "1990-01-01" }], "The Movie", null), null);
});

test("English/US category preference keeps all foreign and unlabelled sources", () => {
  assert.equal(scoreGroupForUser("United States Movies", "US", ["English"]), 100);
  assert.equal(scoreGroupForUser("New Zealand", "NZ", []), 100);
  const items = [{ group: "FR Movies" }, { group: null }, { group: "US Movies" }, { group: "English Series" }];
  const sorted = sortChannelsByGroupRelevance(items, "US", ["English"]);
  assert.equal(sorted[0], items[2]); assert.equal(sorted[1], items[3]);
  assert.deepEqual(new Set(sorted), new Set(items));
});

test("HTML fallback detects transport from path, never signed query tokens or compatibility hints", () => {
  assert.equal(html5Transport("https://media.invalid/movie.mp4?token=m3u8"), "file");
  assert.equal(html5Transport("https://media.invalid/playlist/file.mp4"), "file");
  assert.equal(html5Transport("https://media.invalid/playlist/opaque"), "hls");
  assert.equal(html5Transport("https://media.invalid/opaque?signature=x"), "file");
  assert.equal(html5Transport("https://media.invalid/live.m3u8?token=x#part"), "hls");
  assert.equal(html5Transport("https://media.invalid/live.ts?token=x"), "mpegts");
  assert.equal(html5Transport("https://media.invalid/live/1", true), "mpegts");
  assert.equal(html5Transport("https://media.invalid/file.mp4", true), "file");
});
