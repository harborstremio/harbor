import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

type Call = { name: string; args: any };

function compile(file: string) {
  const source = readFileSync(new URL(`../src/lib/music/${file}`, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function load(handle: (name: string, args: any) => unknown = async () => null) {
  const calls: Call[] = [];
  let listener: (event: any) => void = () => {};
  const module = { exports: {} };
  new Function("require", "module", "exports", compile("video.ts"))(
    (name: string) => {
      if (name === "@tauri-apps/api/core")
        return {
          invoke: async (command: string, args: any) => {
            calls.push({ name: command, args });
            return handle(command, args);
          },
        };
      if (name === "@tauri-apps/api/event")
        return {
          listen: async (_: string, callback: typeof listener) => {
            listener = callback;
            return () => {};
          },
        };
      throw Error(name);
    },
    module,
    module.exports,
  );
  return {
    api: module.exports as typeof import("../src/lib/music/video.ts"),
    resolved: () =>
      calls
        .filter((call) => call.name === "music_video_stream")
        .map((call) => call.args.track.sourceId as string),
    count: (name: string) => calls.filter((call) => call.name === name).length,
    event: (payload: any) => listener({ payload }),
  };
}

function loadDiscovery(handle: (name: string, args: any) => unknown) {
  const queries: string[] = [];
  const module = { exports: {} };
  new Function("require", "module", "exports", compile("video-discovery.ts"))(
    (name: string) => {
      assert.equal(name, "@tauri-apps/api/core");
      return {
        invoke: async (command: string, args: any) => {
          queries.push(args.query);
          return handle(command, args);
        },
      };
    },
    module,
    module.exports,
  );
  return { api: module.exports as typeof import("../src/lib/music/video-discovery.ts"), queries };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
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
const track = video as any;
const other = (sourceId: string) => ({ ...video, sourceId, id: `youtube:${sourceId}` }) as any;
const stream = (sourceId = "FGBhQbmPwH8") => ({
  url: `https://rr1.googlevideo.com/videoplayback?expire=${Math.round(Date.now() / 1000) + 3600}&id=${sourceId}`,
  audioUrl: null,
  httpHeaders: {},
});
const resolves = (name: string, args: any) =>
  name === "music_video_stream" ? stream(args.track.sourceId) : null;
const gated = (gates: Map<string, (value: unknown) => void>) => (name: string, args: any) =>
  name === "music_video_stream"
    ? new Promise((resolve) => gates.set(args.track.sourceId, resolve))
    : null;

test("a warm and the surface that follows it share one native resolution", async () => {
  const fixture = load(resolves);
  const warm = fixture.api.musicVideoStream(track);
  const surface = fixture.api.musicVideoStream({ ...track, title: "renamed" });
  assert.equal(fixture.count("music_video_stream"), 1);
  assert.equal(await warm, await surface);
  assert.equal(await fixture.api.musicVideoStream(track), await warm);
  assert.equal(fixture.count("music_video_stream"), 1);
});

test("replaying a video keeps it out of reach of eviction while never-replayed ones go", async () => {
  const fixture = load(resolves);
  const clip = (index: number) => other(`clip${String(index).padStart(2, "0")}`);
  for (let index = 0; index < 12; index += 1) await fixture.api.musicVideoStream(clip(index));
  await fixture.api.musicVideoStream(clip(0));
  assert.equal(fixture.count("music_video_stream"), 12);
  await fixture.api.musicVideoStream(clip(99));
  assert.equal(fixture.count("music_video_stream"), 13);
  await fixture.api.musicVideoStream(clip(0));
  assert.equal(fixture.count("music_video_stream"), 13);
  await fixture.api.musicVideoStream(clip(1));
  assert.equal(fixture.count("music_video_stream"), 14);
});

test("prefetching warms only the bounded head of a list, one resolution at a time", async () => {
  const gates = new Map<string, (value: unknown) => void>();
  const fixture = load(gated(gates));
  const settle = (sourceId: string) => {
    gates.get(sourceId)!(stream(sourceId));
    gates.delete(sourceId);
  };
  fixture.api.prefetchMusicVideoStreams([other("first"), other("second"), other("third")]);
  await flush();
  assert.deepEqual(fixture.resolved(), ["first"]);
  settle("first");
  await flush();
  assert.deepEqual(fixture.resolved(), ["first", "second"]);
  settle("second");
  await flush();
  assert.deepEqual(fixture.resolved(), ["first", "second"]);
  const warmed = await fixture.api.musicVideoStream(other("first"));
  assert.equal(warmed.url.includes("id=first"), true);
  assert.equal(fixture.count("music_video_stream"), 2);
});

test("a prefetch waits for the resolution the viewer is waiting on, and never rejects", async () => {
  const gates = new Map<string, (value: unknown) => void>();
  const fixture = load((name, args) => {
    if (name === "music_video_stream" && args.track.sourceId === "broken")
      return Promise.reject(Error("yt-dlp failed"));
    return gated(gates)(name, args);
  });
  const watching = fixture.api.musicVideoStream(other("watched"));
  fixture.api.prefetchMusicVideoStreams([other("broken"), other("nextup")]);
  await flush();
  assert.deepEqual(fixture.resolved(), ["watched"]);
  gates.get("watched")!(stream("watched"));
  await watching;
  await flush();
  await flush();
  assert.deepEqual(fixture.resolved(), ["watched", "broken", "nextup"]);
});

test("a prefetch skips what is already resolved and what is already being resolved", async () => {
  const gates = new Map<string, (value: unknown) => void>();
  const fixture = load(gated(gates));
  const cached = fixture.api.musicVideoStream(other("cached"));
  gates.get("cached")!(stream("cached"));
  await cached;
  const inflight = fixture.api.musicVideoStream(other("inflight"));
  fixture.api.prefetchMusicVideoStreams([other("cached"), other("inflight")]);
  gates.get("inflight")!(stream("inflight"));
  await inflight;
  await flush();
  await flush();
  assert.deepEqual(fixture.resolved(), ["cached", "inflight"]);
});

test("the video list being watched survives eviction that takes never-revisited searches", async () => {
  const fixture = loadDiscovery(async () => [video]);
  for (let index = 0; index < 12; index += 1)
    await fixture.api.searchMusicVideos(`artist ${index} music videos`);
  await fixture.api.searchMusicVideos("artist 0 music videos");
  assert.equal(fixture.queries.length, 12);
  await fixture.api.searchMusicVideos("artist 12 music videos");
  assert.equal(fixture.queries.length, 13);
  await fixture.api.searchMusicVideos("artist 0 music videos");
  assert.equal(fixture.queries.length, 13);
  await fixture.api.searchMusicVideos("artist 1 music videos");
  assert.equal(fixture.queries.length, 14);
});
