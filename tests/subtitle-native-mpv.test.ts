// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { spawn, execFileSync } from "node:child_process";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { dirname, join } from "node:path";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { connect } from "node:net";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { fileURLToPath } from "node:url";
import { emptySnapshot } from "../src/lib/player/bridge.ts";
import { mpvBridgeHarness, playerSnapshotChanged } from "./helpers/mpv-bridge-harness.ts";

// @ts-expect-error This opt-in test runs only in Node, not in the browser build.
const binary = process.env.HARBOR_MPV_TEST_BINARY;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(predicate: () => boolean, timeout = 5000) {
  const until = Date.now() + timeout;
  while (!predicate() && Date.now() < until) await delay(20);
  assert.ok(predicate(), "native mpv condition did not settle before timeout");
}

test(
  "native Windows mpv delivers consecutive primary and secondary cues with native rendering hidden",
  {
    skip: !binary,
    timeout: 25000,
  },
  async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "harbor-subtitle-native-"));
    const fixture = join(fixtureDir, "fixture.mp4");
    const pipe = `\\\\.\\pipe\\harbor-subtitle-test-${crypto.randomUUID()}`;
    const child = spawn(
      binary,
      [
        "--no-config",
        "--idle=yes",
        "--vo=null",
        "--ao=null",
        "--pause=yes",
        "--keep-open=yes",
        "--sub-visibility=no",
        `--input-ipc-server=${pipe}`,
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    let socket: ReturnType<typeof connect> | null = null;
    const h = mpvBridgeHarness();
    try {
      execFileSync(
        join(dirname(binary), "ffmpeg.exe"),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=c=black:s=160x90:r=10",
          "-t",
          "12",
          "-c:v",
          "libx264",
          fixture,
        ],
        { windowsHide: true, timeout: 10000 },
      );
      const until = Date.now() + 5000;
      while (!socket && Date.now() < until) {
        socket = await new Promise<ReturnType<typeof connect> | null>((resolve) => {
          const candidate = connect(pipe);
          candidate.once("connect", () => resolve(candidate));
          candidate.once("error", () => {
            candidate.destroy();
            resolve(null);
          });
        });
        if (!socket) await delay(50);
      }
      assert.ok(socket, "could not connect to the isolated mpv process");
      const pending = new Map<
        number,
        { resolve: (data: unknown) => void; reject: (error: Error) => void }
      >();
      let requestId = 0;
      let buffer = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        buffer += chunk;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const message = JSON.parse(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          if (message.event === "property-change") h.emit(message.name, message.data);
          const waiter = pending.get(message.request_id);
          if (!waiter) continue;
          pending.delete(message.request_id);
          if (message.error === "success") waiter.resolve(message.data);
          else waiter.reject(new Error(message.error));
        }
      });
      const command = (args: unknown[]) =>
        new Promise<unknown>((resolve, reject) => {
          const id = ++requestId;
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`mpv command timed out: ${args[0]}`));
          }, 3000);
          pending.set(id, {
            resolve: (data) => {
              clearTimeout(timer);
              resolve(data);
            },
            reject: (error) => {
              clearTimeout(timer);
              reject(error);
            },
          });
          socket.write(JSON.stringify({ command: args, request_id: id }) + "\n");
        });
      h.invokeWith(async (name, args) => {
        if (name === "mpv_set_property") return command(["set_property", args.name, args.value]);
        if (name === "mpv_get_property") return command(["get_property", args.name]);
        if (name === "mpv_command") return command(args.cmd as unknown[]);
        if (name === "mpv_start") return command(["loadfile", fixture]);
        if (name === "mpv_sub_add")
          return command([
            "sub-add",
            args.url,
            args.select ? "select" : "auto",
            args.title ?? "",
            args.lang ?? "",
          ]);
      });
      h.resetWith(async () => {
        await command(["set_property", "sub-fps", 0]);
      });
      await h.bridge.load({ url: "synthetic-fixture" });
      await eventually(() => h.snapshot().status !== "error");
      for (const [i, property] of [
        "track-list",
        "sub-text",
        "secondary-sub-text",
        "sub-start",
        "time-pos",
        "pause",
      ].entries()) {
        await command(["observe_property", i + 1, property]);
      }
      await eventually(() => h.snapshot().positionSec >= 0);
      const path = (lang: string) =>
        fileURLToPath(new URL(`./fixtures/subtitles/cues-${lang}.srt`, import.meta.url));
      await eventually(() => h.snapshot().status === "paused");
      await h.bridge.addSubtitle(path("en"), "en", "English fixture", false);
      await h.bridge.addSubtitle(path("ar"), "ar", "Arabic fixture", false);
      await eventually(() => h.snapshot().subtitleTracks.length === 2);
      const english = h.snapshot().subtitleTracks.find((track) => track.lang === "en")!.id;
      const arabic = h.snapshot().subtitleTracks.find((track) => track.lang === "ar")!.id;
      h.bridge.setSubtitleTrack(english);
      h.bridge.setSubtitleTrack(arabic, "automatic");
      h.bridge.setSecondarySubtitleTrack(arabic);
      await eventually(
        () => h.snapshot().subtitleTracks.find((track) => track.selected)?.id === english,
      );
      assert.equal(String(await command(["get_property", "sid"])), english);
      assert.equal(await command(["get_property", "sub-visibility"]), false);
      const changed = playerSnapshotChanged();
      let previous = emptySnapshot;
      const primary: string[] = [];
      const secondary: string[] = [];
      h.bridge.subscribe((next) => {
        if (!changed(previous, next)) return;
        previous = next;
        if (primary.at(-1) !== next.subText) primary.push(next.subText);
        if (secondary.at(-1) !== next.secondarySubText) secondary.push(next.secondarySubText);
      });
      await h.bridge.play();
      await eventually(
        () => primary.includes("Third cue") && secondary.includes("السطر الثالث"),
        8000,
      ).catch((error) => {
        throw new Error(JSON.stringify({ primary, secondary, snapshot: h.snapshot() }), {
          cause: error,
        });
      });
      assert.deepEqual(primary.filter(Boolean), ["First cue", "Second cue", "Third cue"]);
      assert.deepEqual(secondary.filter(Boolean), ["السطر الأول", "السطر الثاني", "السطر الثالث"]);
      assert.ok(primary.filter((cue) => cue === "").length >= 3);
      h.bridge.pause();
      h.bridge.seek(1.2);
      await eventually(() => h.snapshot().subText === "First cue");
      h.bridge.seek(1.4);
      await command(["get_property", "time-pos"]);
      await eventually(() => h.snapshot().subText === "First cue");
      h.bridge.setSubtitleTrack(null);
      await eventually(() => !h.snapshot().subtitleTracks.some((track) => track.selected));
      assert.equal(await command(["get_property", "sid"]), false);
      await eventually(() => h.snapshot().subText === "");
    } finally {
      socket?.destroy();
      if (child.exitCode == null && child.signalCode == null) {
        const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        child.kill();
        await exited;
      }
      unlinkSync(fixture);
      rmdirSync(fixtureDir);
    }
  },
);
