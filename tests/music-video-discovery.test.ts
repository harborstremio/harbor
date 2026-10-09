import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(invoke: (...args: any[]) => Promise<unknown>) {
  const source = readFileSync(
    new URL("../src/lib/music/video-discovery.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.equal(name, "@tauri-apps/api/core");
      return { invoke };
    },
    module,
    module.exports,
  );
  return module.exports as typeof import("../src/lib/music/video-discovery.ts");
}
const video = {
  mediaKind: "video",
  connectorId: "youtube",
  sourceId: "FGBhQbmPwH8",
  id: "youtube:FGBhQbmPwH8",
  title: "One More Time",
  artist: "Daft Punk",
  artwork: "https://i.ytimg.com/vi/FGBhQbmPwH8/hqdefault.jpg",
  durationSeconds: 320,
  durationLabel: "5:20",
};

test("video discovery retains provider identity and rejects wrong sources, malformed IDs and duplicates", () => {
  const api = load(async () => []);
  assert.deepEqual(
    api.musicVideoResults([
      video,
      video,
      { ...video, connectorId: "catalog" },
      { ...video, sourceId: "https://invalid" },
      { ...video, title: "" },
    ]),
    [video],
  );
  assert.deepEqual(api.musicVideoResults(null), []);
  assert.deepEqual(api.musicVideoResults([{ ...video, mediaKind: undefined }]), [video]);
});

test("concurrent discovery shares one bounded request, caches success, and refresh is explicit", async () => {
  const calls: any[] = [];
  let complete!: (data: unknown) => void;
  const api = load((...args) => {
    calls.push(args);
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const one = api.searchMusicVideos(" Daft Punk ");
  const two = api.searchMusicVideos("daft punk");
  assert.equal(calls.length, 1);
  const [command, payload] = calls[0] as [
    string,
    { query: string; limit: number; interviews: boolean },
  ];
  assert.equal(command, "music_search_videos");
  assert.equal(payload.query, "Daft Punk");
  assert.equal(payload.interviews, false);
  assert.ok(
    payload.limit >= 24 && payload.limit <= 48,
    `a music video search asking for only ${payload.limit} leaves More music videos nearly empty, and the native side clamps above 48`,
  );
  complete([video]);
  assert.deepEqual(await one, [video]);
  assert.deepEqual(await two, [video]);
  await api.searchMusicVideos("Daft Punk");
  assert.equal(calls.length, 1);
  const refresh = api.searchMusicVideos("Daft Punk", true);
  assert.equal(calls.length, 2);
  complete([]);
  assert.deepEqual(await refresh, []);
  await api.searchMusicVideos(" ");
  assert.equal(calls.length, 2);
});

test("failed requests are retryable and browsing never invokes playback or stream resolution", async () => {
  const calls: string[] = [];
  const api = load(async (name) => {
    calls.push(name);
    if (calls.length === 1) throw Error("offline");
    return [video];
  });
  await assert.rejects(api.searchMusicVideos("videos"), /offline/);
  assert.deepEqual(await api.searchMusicVideos("videos"), [video]);
  assert.deepEqual(calls, ["music_search_videos", "music_search_videos"]);
});

test("a caller that can render more than a rail gets more than a rail, and the default rail is unchanged", async () => {
  const many = Array.from({ length: 40 }, (_, index) => ({
    ...video,
    sourceId: `FGBhQbmPw${index.toString().padStart(2, "0")}`,
    id: `youtube:${index}`,
  }));
  const api = load(async () => many);
  assert.equal((await api.searchMusicVideos("daft punk")).length, 12);
  assert.equal((await api.searchMusicVideos("daft punk", false, false, 24)).length, 24);
  assert.equal((await api.searchMusicVideos("daft punk", false, false, 96)).length, 40);
  assert.equal((await api.searchMusicVideos("daft punk", false, false, 0)).length, 12);
});

test("a shared in-flight request still answers each caller at its own size", async () => {
  let complete!: (data: unknown) => void;
  const many = Array.from({ length: 30 }, (_, index) => ({
    ...video,
    sourceId: `AAAAAAAAA${index.toString().padStart(2, "0")}`,
    id: `youtube:${index}`,
  }));
  const api = load(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const rail = api.searchMusicVideos("shared");
  const list = api.searchMusicVideos("shared", false, false, 24);
  complete(many);
  assert.equal((await rail).length, 12);
  assert.equal((await list).length, 24);
});
