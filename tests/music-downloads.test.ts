import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as offlinePolicy from "../src/lib/download/offline-policy.ts";
const track = {
  id: "yt:one",
  connectorId: "youtube_music",
  title: "One",
  artist: "Artist",
  artwork: "",
  durationSeconds: 120,
  durationLabel: "2:00",
};
function fixture() {
  const storage = new Map(),
    files = new Set<string>(),
    calls: any[] = [];
  let finish: () => void = () => {},
    fail: () => void = () => {},
    cancelled = false;
  let stream = "https://example.test/audio";
  let owner = JSON.stringify(["account-a", "profile-a"]);
  let changed = () => {};
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/music/downloads.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const mocks: any = {
    react: { useSyncExternalStore: (_: unknown, snapshot: () => unknown) => snapshot() },
    "@/lib/download/owner": {
      downloadOwner: () => owner,
      subscribeDownloadOwner: (listener: () => void) => {
        changed = listener;
      },
    },
    "@/lib/download/offline-policy": offlinePolicy,
    "./preferences": {
      readMusicPreference: (k: string) => storage.get(k) ?? null,
      writeMusicPreference: (k: string, v: string) => storage.set(k, v),
    },
    "@tauri-apps/api/core": {
      invoke: async (cmd: string, args: any) => {
        calls.push({ cmd, args });
        return cmd === "music_source_candidates"
          ? [{ connectorId: "youtube_music", health: "healthy", track }]
          : { url: stream, httpHeaders: { Referer: "https://example.test" } };
      },
    },
    "@tauri-apps/api/path": {
      appDataDir: async () => "/app",
      join: async (...s: string[]) => s.join("/"),
    },
    "@tauri-apps/plugin-fs": {
      exists: async (p: string) => files.has(p),
      mkdir: async () => {},
      remove: async (p: string) => {
        files.delete(p);
        calls.push({ remove: p });
      },
    },
    "@tauri-apps/plugin-opener": { revealItemInDir: async () => {} },
    "@/lib/download/video-download": {
      startDownload: (
        id: string,
        url: string,
        path: string,
        progress: Function,
        headers: any,
        kind: string,
      ) => {
        calls.push({ id, url, path, headers, kind });
        let reject: Function;
        const promise = new Promise<void>((resolve, r) => {
          reject = r;
          finish = () => {
            files.add(path);
            progress({ ratio: 1, receivedBytes: 4096 });
            resolve();
          };
          fail = () => {
            files.add(path + ".part");
            r(Error("network"));
          };
        });
        return {
          promise,
          abort: () => {
            cancelled = true;
            reject(Error("canceled"));
          },
        };
      },
    },
  };
  const m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id: string) => {
      assert.ok(id in mocks, id);
      return mocks[id];
    },
    m,
    m.exports,
  );
  return {
    api: m.exports as typeof import("../src/lib/music/downloads.ts"),
    files,
    calls,
    finish: () => finish(),
    fail: () => fail(),
    cancelled: () => cancelled,
    stream: (s: string) => (stream = s),
    switchOwner: (next: string) => {
      owner = next;
      changed();
    },
    wait: async () => {
      for (let i = 0; i < 30 && !calls.some((c) => c.kind); i++)
        await new Promise((r) => setTimeout(r, 1));
    },
  };
}
test("download persists only after completion, keeps headers, and opens a local path without resolving again", async () => {
  const f = fixture();
  const job = f.api.downloadMusic(track);
  await f.wait();
  assert.equal(f.api.musicDownloadFor(track)?.status, "downloading");
  assert.equal(f.calls.at(-1).kind, "audio");
  assert.deepEqual(f.calls.at(-1).headers, { Referer: "https://example.test" });
  f.finish();
  await job;
  const entry = f.api.musicDownloadFor(track)!;
  assert.equal(entry.status, "done");
  const calls = f.calls.length;
  const local = await f.api.downloadedMusicTrack(entry);
  assert.equal(local.connectorId, "local");
  assert.ok(local.playbackUrl?.endsWith(".m4a"));
  assert.ok(!local.playbackUrl?.includes(entry.id));
  assert.equal(f.calls.length, calls);
  await f.api.downloadMusic(track);
  assert.equal(f.calls.length, calls);
  await f.api.deleteMusicDownload(entry.id);
  assert.equal(f.files.size, 0);
  assert.equal(f.api.useMusicDownloads().length, 0);
});
test("cancel waits for transfer and removes partial file and entry", async () => {
  const f = fixture();
  const job = f.api.downloadMusic(track);
  await f.wait();
  const entry = f.api.musicDownloadFor(track)!;
  const path = await f.api.musicDownloadPath(entry.id);
  f.files.add(path + ".part");
  await f.api.deleteMusicDownload(entry.id);
  await job;
  assert.ok(f.cancelled());
  assert.equal(f.files.size, 0);
  assert.equal(f.api.useMusicDownloads().length, 0);
});
test("failed music retry keeps the same partial path for native validation; missing completed file becomes retryable", async () => {
  const f = fixture();
  let job = f.api.downloadMusic(track);
  await f.wait();
  f.fail();
  await job;
  assert.equal(f.api.musicDownloadFor(track)?.status, "error");
  job = f.api.downloadMusic(track);
  for (let i = 0; i < 30 && f.calls.filter((c) => c.kind).length < 2; i++)
    await new Promise((r) => setTimeout(r, 1));
  assert.equal(f.files.size, 1);
  assert.equal(f.calls.filter((c) => c.kind)[0].path, f.calls.filter((c) => c.kind)[1].path);
  f.finish();
  await job;
  const entry = f.api.musicDownloadFor(track)!;
  f.files.clear();
  await assert.rejects(f.api.downloadedMusicTrack(entry), /missing/);
  assert.equal(entry.status, "error");
});
test("owner change pauses music and hides it; another account cannot read or delete the file", async () => {
  const f = fixture();
  const job = f.api.downloadMusic(track);
  await f.wait();
  const entry = f.api.musicDownloadFor(track)!;
  f.switchOwner(JSON.stringify(["account-b", "profile-b"]));
  await job;
  assert.equal(entry.status, "paused");
  assert.equal(f.api.useMusicDownloads().length, 0);
  await assert.rejects(f.api.musicDownloadPath(entry.id), /another profile/);
  await f.api.deleteMusicDownload(entry.id);
  f.switchOwner(JSON.stringify(["account-a", "profile-a"]));
  assert.equal(f.api.useMusicDownloads()[0].id, entry.id);
});
test("manifest streams and unavailable sources never produce a completed download", async () => {
  const f = fixture();
  f.stream("https://example.test/file.m3u8");
  await f.api.downloadMusic(track);
  assert.equal(f.api.musicDownloadFor(track)?.error, "music.download.unsupported");
  assert.equal(
    f.calls.some((c) => c.kind),
    false,
  );
  await assert.rejects(f.api.downloadMusic({ ...track, connectorId: "spotify" }), /unsupported/);
  await assert.rejects(f.api.musicDownloadPath("../../elsewhere"), /Invalid/);
});
