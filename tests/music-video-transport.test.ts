// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
import ts from "typescript";

function read(file: string): string {
  return readFileSync(new URL(`../src/lib/music/${file}`, import.meta.url), "utf8");
}

function evaluate(file: string, resolve: (name: string) => unknown): any {
  const outputText = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(resolve, module, module.exports);
  return module.exports;
}

function loadVideo(invoke: (command: string, args: any) => Promise<any>) {
  const calls: string[] = [];
  const api = evaluate("video.ts", (name: string) => {
    if (name === "@tauri-apps/api/core")
      return {
        invoke: (command: string, args: any) => {
          calls.push(command);
          return invoke(command, args);
        },
      };
    throw Error(name);
  });
  return { api, calls };
}

const track = { id: "t1", connectorId: "yt", sourceId: "abc", mediaKind: "video" } as any;

const settle = async (rounds = 16) => {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
};

test("a resolution that never answers becomes a terminal error instead of an endless spinner", async () => {
  const { api, calls } = loadVideo(() => new Promise(() => {}));
  const started = Date.now();
  await assert.rejects(api.musicVideoStream(track, false, 40), /music\.video\.unavailable/);
  assert.ok(Date.now() - started < 2_000);
  assert.deepEqual(calls, ["music_video_stream"]);
});

test("the resolution bound is finite and short enough that a retry is worth offering", () => {
  const declared = /const MUSIC_VIDEO_RESOLVE_TIMEOUT = ([\d_]+);/.exec(read("video.ts"));
  assert.ok(declared, "video.ts declares no resolution bound");
  const bound = Number(declared![1].replace(/_/g, ""));
  assert.ok(bound >= 20_000 && bound <= 30_000, `bound ${bound} is outside the defensible range`);
  assert.match(read("video.ts"), /timeoutMs = MUSIC_VIDEO_RESOLVE_TIMEOUT/);
});

test("retrying after a timeout resolves afresh rather than attaching to the wedged call", async () => {
  let attempt = 0;
  const { api, calls } = loadVideo(() => {
    attempt += 1;
    if (attempt === 1) return new Promise(() => {});
    return Promise.resolve({
      url: "https://example.test/v.mp4",
      audioUrl: "https://example.test/a.m4a",
    });
  });
  await assert.rejects(api.musicVideoStream(track, false, 30), /music\.video\.unavailable/);
  const second = await api.musicVideoStream(track);
  assert.equal(second.url, "https://example.test/v.mp4");
  assert.equal(attempt, 2);
  assert.deepEqual(calls, ["music_video_stream", "music_video_stream"]);
});

test("a successful resolution is still cached, and the surface retry path resolves afresh", async () => {
  let attempt = 0;
  const { api } = loadVideo(async () => {
    attempt += 1;
    return { url: `https://example.test/${attempt}.mp4`, audioUrl: null };
  });
  const first = await api.musicVideoStream(track);
  const again = await api.musicVideoStream(track);
  assert.equal(attempt, 1);
  assert.equal(again.url, first.url);
  const forced = await api.musicVideoStream(track, true);
  assert.equal(attempt, 2);
  assert.equal(forced.url, "https://example.test/2.mp4");
  const settled = await api.musicVideoStream(track);
  assert.equal(attempt, 2);
  assert.equal(settled.url, "https://example.test/2.mp4");
});

test("a wedged resolution is dropped when it times out, so the next plain request restarts it", async () => {
  let attempt = 0;
  const { api, calls } = loadVideo(() => {
    attempt += 1;
    if (attempt === 1) return new Promise(() => {});
    return Promise.resolve({ url: "https://example.test/fresh.mp4", audioUrl: null });
  });
  const wedged = api.musicVideoStream(track, false, 30);
  const joined = api.musicVideoStream(track);
  assert.equal(attempt, 1, "a second surface must join the resolution already running");
  await assert.rejects(wedged, /music\.video\.unavailable/);
  await assert.rejects(joined, /music\.video\.unavailable/);
  const after = await api.musicVideoStream(track);
  assert.equal(after.url, "https://example.test/fresh.mp4");
  assert.equal(attempt, 2, "the retry joined the wedged call instead of resolving afresh");
  assert.deepEqual(calls, ["music_video_stream", "music_video_stream"]);
});

test("the music video path no longer drives mpv", () => {
  for (const file of ["video.ts", "video-session.ts", "video-fullscreen.ts"]) {
    const source = read(file);
    for (const forbidden of [
      "mpv_start",
      "mpv_stop",
      "mpv_set_property",
      "mpv_get_property",
      "mpv_set_geometry",
      "createMusicVideoReadiness",
    ]) {
      assert.equal(source.includes(forbidden), false, `${file} still references ${forbidden}`);
    }
  }
});

const hostMock = () => ({
  releaseMusicVideoHostSource: () => {},
  primeMusicVideoHostPosition: () => {},
});

test("the video-host mock covers every import the session takes, or a real regression hides behind it", () => {
  const imported = /import\s*\{([^}]+)\}\s*from\s*"\.\/video-host"/.exec(read("video-session.ts"));
  assert.ok(imported, "video-session.ts no longer imports from ./video-host");
  const mock = hostMock() as Record<string, unknown>;
  for (const entry of imported![1].split(",")) {
    const name = entry.trim().split(/\s+/)[0];
    if (!name) continue;
    assert.ok(
      name in mock,
      `./video-host mock is missing ${name}, so resolution throws and every surface reads unavailable`,
    );
  }
});

function loadSession(resolveStream: () => Promise<any>) {
  let released = 0;
  const engine = { active: true };
  const surfaces = evaluate("video-surfaces.ts", (name: string) => {
    throw Error(name);
  });
  const session = evaluate("video-session.ts", (name: string) => {
    if (name === "./video-surfaces") return surfaces;
    if (name === "./video-host") return hostMock();
    if (name === "./player")
      return {
        activateMusicVideo: async () => ({
          volume: 0.5,
          position: 12.5,
          paused: false,
          release: async () => {
            released += 1;
          },
        }),
        getMusicState: () => ({ current: track, phase: "playing" }),
        isMusicVideoActive: () => engine.active,
        subscribeMusic: () => () => {},
        waitForMusicAudioReady: async () => true,
      };
    if (name === "./video")
      return {
        musicVideoStream: () => resolveStream(),
        musicVideoStreamKey: (value: any) => `${value.connectorId}:${value.sourceId}`,
      };
    throw Error(name);
  });
  return { session, engine, releases: () => released };
}

test("a failed resolution leaves the surface state machine terminal, and retry runs resolution again", async () => {
  let attempt = 0;
  const { session } = loadSession(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error("music.video.unavailable");
    return { url: "https://example.test/v.mp4", audioUrl: "https://example.test/a.m4a" };
  });
  const unregister = session.musicVideoSurfaces.register(Symbol("surface"), track, 1);
  await settle();
  assert.equal(attempt, 1);
  assert.equal(session.musicVideoSurfaces.getSnapshot().status, "unavailable");

  session.musicVideoSurfaces.retry();
  await settle();
  assert.equal(attempt, 2);
  assert.equal(session.musicVideoSurfaces.getSnapshot().status, "playing");
  unregister();
});

test("a resolved run hands the music engine over and gives it back when the surface goes", async () => {
  const { session, engine, releases } = loadSession(async () => ({
    url: "https://example.test/v.mp4",
    audioUrl: null,
  }));
  const unregister = session.musicVideoSurfaces.register(Symbol("surface"), track, 1);
  await settle();
  assert.equal(session.musicVideoSurfaces.getSnapshot().status, "playing");
  assert.equal(releases(), 0);
  engine.active = false;
  unregister();
  await settle();
  assert.equal(releases(), 1);
});
