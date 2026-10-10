import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const player = readFileSync("src/lib/music/player.ts", "utf8");
const session = readFileSync("src/lib/music/video-session.ts", "utf8");
const host = readFileSync("src/lib/music/video-host.ts", "utf8");

test("the handover still reports where the song had reached", () => {
  const fn = player.slice(player.indexOf("export async function activateMusicVideo"));
  assert.match(fn.slice(0, fn.indexOf("async release()")), /position: audio\.currentTime/);
});

test("the session applies that position instead of discarding it", () => {
  assert.match(
    session,
    /primeMusicVideoHostPosition\(musicVideoStreamKey\(track\), controls\.position\)/,
  );
  const at = session.indexOf("primeMusicVideoHostPosition(musicVideoStreamKey");
  const activate = session.indexOf("await activateMusicVideo");
  assert.ok(
    activate > 0 && at > activate,
    "the position must be applied after activation returns it",
  );
});

test("a position that arrives before the source is held until the source lands", () => {
  assert.match(host, /pendingStart/);
  const setter = host.slice(host.indexOf("export function setMusicVideoHostSource"));
  assert.match(setter.slice(0, setter.indexOf("\n}")), /pendingStart && pendingStart\.key === key/);
});

test("seeking waits for metadata rather than writing currentTime into nothing", () => {
  const fn = host.slice(host.indexOf("function seekHostTo"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /readyState >= 1/);
  assert.match(body, /loadedmetadata/);
});

test("a zero or absent position never forces a seek", () => {
  const fn = host.slice(host.indexOf("export function primeMusicVideoHostPosition"));
  assert.match(fn.slice(0, fn.indexOf("\n}")), /position <= 0\.5/);
});

test("the seek is clamped inside the track so it cannot land past the end", () => {
  const fn = host.slice(host.indexOf("function seekHostTo"));
  assert.match(fn.slice(0, fn.indexOf("\n}\n")), /Math\.min\(position, ceiling\)/);
});
