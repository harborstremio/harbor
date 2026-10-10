import assert from "node:assert/strict";
import test from "node:test";
import { decodeBase64, fetchXtreamLiveChannels } from "../src/lib/iptv/xtream.ts";
import { fetchXtreamSeries, fetchXtreamSeriesEpisodes, fetchXtreamVod } from "../src/lib/iptv/xtream-vod.ts";

test("provider names decode valid UTF-8 while plain, malformed and control-bearing names survive", () => {
  for (const title of ["Café cinéma", "الأخبار", "Movie Night"]) {
    assert.equal(decodeBase64(Buffer.from(title).toString("base64")), title);
  }
  for (const title of ["News", "BBC One", "////", "AAA=", "not-base64"]) {
    assert.equal(decodeBase64(title), title);
  }
  assert.equal(decodeBase64(undefined), "");
});

test("live, movie, series and episode lists present decoded provider titles", async (t) => {
  const encoded = Buffer.from("Café cinéma").toString("base64");
  const payloads: Record<string, unknown> = {
    get_live_categories: [], get_vod_categories: [], get_series_categories: [],
    get_live_streams: [{ stream_id: 1, name: encoded }, { stream_id: 2, name: "BBC One" }],
    get_vod_streams: [{ stream_id: 3, name: encoded }, { stream_id: 4 }],
    get_series: [{ series_id: 5, name: encoded }],
    get_series_info: { episodes: { "1": [{ id: 6, episode_num: 2 }] } },
  };
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const action = new URL(input).searchParams.get("action")!;
    assert.ok(action in payloads, action);
    return new Response(JSON.stringify(payloads[action]));
  });
  const credentials = { base: "https://provider.invalid", username: "test", password: "fixture" };
  assert.deepEqual((await fetchXtreamLiveChannels(credentials, "names")).map(x => x.name), ["Café cinéma", "BBC One"]);
  assert.deepEqual((await fetchXtreamVod(credentials, "names")).map(x => x.name), ["Café cinéma", "Movie 4"]);
  assert.deepEqual((await fetchXtreamSeries(credentials, "names")).map(x => x.name), ["Café cinéma"]);
  assert.equal((await fetchXtreamSeriesEpisodes(credentials, "names", { series_id: 5, name: encoded }))[0].name, "Café cinéma S1E2");
});
