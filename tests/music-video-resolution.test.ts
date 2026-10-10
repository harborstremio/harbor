import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

type Call = { name: string; args: any };

function load(handle: (name: string, args: any) => unknown = async () => null) {
  const calls: Call[] = [];
  let listener: (event: any) => void = () => {};
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/lib/music/video.ts", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
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
    calls,
    count: (name: string) => calls.filter((call) => call.name === name).length,
    event: (payload: any) => listener({ payload }),
  };
}

const track = {
  id: "youtube:FGBhQbmPwH8",
  sourceId: "FGBhQbmPwH8",
  connectorId: "youtube",
  title: "One More Time",
  artist: "Daft Punk",
  artwork: "",
  durationSeconds: 320,
  durationLabel: "5:20",
} as any;
const signed = (seconds: number) =>
  `https://rr1.googlevideo.com/videoplayback?expire=${seconds}&itag=137`;
const stream = (seconds: number) => ({ url: signed(seconds), audioUrl: null, httpHeaders: {} });

test("a resolution is identified by its connector and that connector's own id", () => {
  const { api } = load();
  assert.equal(api.musicVideoStreamKey(track), "youtube:FGBhQbmPwH8");
  assert.equal(api.musicVideoStreamKey({ id: "local:42" } as any), ":local:42");
  assert.equal(api.musicVideoStreamKey({ id: "a", connectorId: "youtube" } as any), "youtube:a");
});

test("cache lifetime follows the signature on the URLs and falls back to a bounded ttl", () => {
  const { api } = load();
  const now = 1_700_000_000_000;
  const at = (offsetSeconds: number) => now / 1000 + offsetSeconds;
  assert.equal(api.streamExpiry(stream(at(120)), now), now + 90_000);
  assert.equal(
    api.streamExpiry({ url: signed(at(600)), audioUrl: signed(at(120)) }, now),
    now + 90_000,
  );
  assert.equal(
    api.streamExpiry(
      { url: `https://rr1.googlevideo.com/expire/${at(120)}/id/abc`, audioUrl: null },
      now,
    ),
    now + 90_000,
  );
  assert.equal(api.streamExpiry(stream(at(100_000)), now), now + 8 * 60_000);
  assert.equal(
    api.streamExpiry({ url: "https://example.test/video.mp4", audioUrl: null }, now),
    now + 8 * 60_000,
  );
});

test("concurrent resolution shares one native call, a replay reuses it and refresh is explicit", async () => {
  const resolved = stream(Date.now() / 1000 + 600);
  const fixture = load(() => resolved);
  const [one, two] = await Promise.all([
    fixture.api.musicVideoStream(track),
    fixture.api.musicVideoStream(track),
  ]);
  assert.equal(fixture.count("music_video_stream"), 1);
  assert.deepEqual(fixture.calls[0].args, { track });
  assert.equal(one, two);
  assert.equal(
    await fixture.api.musicVideoStream({ ...track, id: "other", title: "renamed" }),
    resolved,
  );
  assert.equal(fixture.count("music_video_stream"), 1);
  await fixture.api.musicVideoStream(track, true);
  assert.equal(fixture.count("music_video_stream"), 2);
});

test("a lapsed signature is never cached and a failed resolution stays retryable", async () => {
  const stale = load(() => stream(Date.now() / 1000 - 60));
  await stale.api.musicVideoStream(track);
  await stale.api.musicVideoStream(track);
  assert.equal(stale.count("music_video_stream"), 2);

  let attempts = 0;
  const broken = load(() => {
    attempts += 1;
    if (attempts === 1) throw Error("offline");
    return stream(Date.now() / 1000 + 600);
  });
  await assert.rejects(broken.api.musicVideoStream(track), /offline/);
  assert.ok(await broken.api.musicVideoStream(track));
  assert.equal(broken.count("music_video_stream"), 2);
});
