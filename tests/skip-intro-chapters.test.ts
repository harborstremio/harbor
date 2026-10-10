// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { chaptersToSegments } from "../src/lib/skip-intro/chapters";

const EPISODE = 24 * 60;

const at = (startSec: number, title = "") => ({ title, startSec });

test("a titled opening still wins over anything positional", () => {
  const segments = chaptersToSegments(
    [at(0, "Prologue"), at(90, "Opening"), at(180, "Part A")],
    EPISODE,
  );
  assert.deepEqual(
    segments.map((s) => [s.kind, s.startSec, s.endSec]),
    [["intro", 90, 180]],
  );
});

test("an untitled opening chapter of theme length is detected", () => {
  // The reported shape: every chapter is "Chapter N", so no title matches at all.
  const segments = chaptersToSegments(
    [at(0, "Chapter 1"), at(60, "Chapter 2"), at(150, "Chapter 3"), at(EPISODE - 60, "Chapter 4")],
    EPISODE,
  );
  const intro = segments.find((s) => s.kind === "intro");
  assert.deepEqual(intro && [intro.startSec, intro.endSec], [60, 150]);
});

test("OP1 and ED2 are read as titles despite the trailing digit", () => {
  const segments = chaptersToSegments([at(0, "A"), at(30, "OP1"), at(120, "B"), at(1380, "ED2")], EPISODE);
  assert.equal(segments.find((s) => s.startSec === 30)?.kind, "intro");
  assert.equal(segments.find((s) => s.startSec === 1380)?.kind, "outro");
});

test("the opening closest to 90s wins when several chapters qualify", () => {
  const segments = chaptersToSegments(
    [at(0, ""), at(40, ""), at(75, ""), at(165, ""), at(600, "")],
    EPISODE,
  );
  const intro = segments.find((s) => s.kind === "intro");
  assert.deepEqual(intro && [intro.startSec, intro.endSec], [75, 165]);
});

test("a lone late chapter of theme length becomes the ending", () => {
  const segments = chaptersToSegments([at(0, ""), at(600, ""), at(EPISODE - 90, "")], EPISODE);
  const outro = segments.find((s) => s.kind === "outro");
  assert.deepEqual(outro && [outro.startSec, outro.endSec], [EPISODE - 90, EPISODE]);
});

test("several late theme-length chapters produce no ending", () => {
  const segments = chaptersToSegments(
    [at(0, ""), at(600, ""), at(EPISODE - 200, ""), at(EPISODE - 100, ""), at(EPISODE - 50, "")],
    EPISODE,
  );
  assert.equal(segments.some((s) => s.kind === "outro"), false);
});

test("a feature-length file is left alone", () => {
  const film = 110 * 60;
  const segments = chaptersToSegments([at(0, ""), at(60, ""), at(150, ""), at(film - 90, "")], film);
  assert.deepEqual(segments, []);
});

test("chapters longer or shorter than a theme are never guessed at", () => {
  const segments = chaptersToSegments([at(0, ""), at(10, ""), at(25, ""), at(400, "")], EPISODE);
  assert.deepEqual(segments, []);
});

test("a positional guess never overlaps a chapter matched by title", () => {
  const segments = chaptersToSegments(
    [at(0, "Recap"), at(80, "Chapter 2"), at(170, "Chapter 3")],
    EPISODE,
  );
  const recap = segments.find((s) => s.kind === "recap");
  const intro = segments.find((s) => s.kind === "intro");
  assert.deepEqual(recap && [recap.startSec, recap.endSec], [0, 80]);
  assert.deepEqual(intro && [intro.startSec, intro.endSec], [80, 170]);
});

test("segments come back in playback order", () => {
  const segments = chaptersToSegments(
    [at(0, ""), at(60, ""), at(150, ""), at(EPISODE - 95, "")],
    EPISODE,
  );
  const starts = segments.map((s) => s.startSec);
  assert.deepEqual([...starts].sort((a, b) => a - b), starts);
});

test("no chapters means no segments", () => {
  assert.deepEqual(chaptersToSegments([], EPISODE), []);
});

test("an unknown duration cannot drive a positional guess", () => {
  assert.deepEqual(chaptersToSegments([at(0, ""), at(60, ""), at(150, "")], 0), []);
});
