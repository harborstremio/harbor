import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const surface = readFileSync("src/components/music/music-video-surface.tsx", "utf8");
const host = readFileSync("src/lib/music/video-host.ts", "utf8");

function adoptionDeps(): string {
  const at = surface.indexOf("return adoptMusicVideoHost(parent);");
  assert.ok(at > 0, "adoption effect not found");
  const tail = surface.slice(at);
  return tail.slice(tail.indexOf("}, ["), tail.indexOf("]);") + 3);
}

test("the picture is re-adopted when the track changes, not only on mount", () => {
  const deps = adoptionDeps();
  assert.match(deps, /\bkey\b/, "a track change must re-run adoption or the picture stays parked");
});

test("the picture is re-adopted when a new stream resolves", () => {
  assert.match(adoptionDeps(), /\bstream\b/);
});

test("adoption still reacts to fullscreen and ownership", () => {
  const deps = adoptionDeps();
  for (const dep of ["active", "selected", "fullscreen"])
    assert.ok(deps.includes(dep), `${dep} missing from adoption deps`);
});

test("ending a session parks the picture, which is why re-adoption is required", () => {
  assert.match(host, /function parkMusicVideoHost/);
  assert.match(host, /releaseMusicVideoHostSource/);
});

test("adoption re-parents rather than rebuilding, so playback survives the move", () => {
  const fn = host.slice(host.indexOf("export function adoptMusicVideoHost"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /insertBefore/);
  assert.doesNotMatch(body, /createElement|\.src\s*=/);
});

test("the picture is adopted into the surface itself, never straight into the fullscreen stage", () => {
  const at = surface.indexOf("return adoptMusicVideoHost(parent);");
  const body = surface.slice(surface.lastIndexOf("useLayoutEffect", at), at);
  assert.match(body, /const parent = shell\.current;/);
  assert.doesNotMatch(
    body,
    /getMusicVideoFullscreen\(\)\.stage/,
    "the stage holds the surface as a later sibling, so a picture parented there is painted over",
  );
});
