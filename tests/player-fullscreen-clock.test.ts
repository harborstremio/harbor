// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  estimatePlaybackEndTime,
  formatLocalTime,
  msUntilNextClockTick,
  sanitizeFullscreenClockFormat,
  sanitizeFullscreenClockSize,
  sanitizeFullscreenClockStyle,
} from "../src/lib/local-time.ts";

test("local time follows the user's locale without seconds", () => {
  const date = new Date(2026, 6, 31, 20, 5, 47);
  const expected = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  assert.equal(formatLocalTime(date), expected);
});

test("local time supports explicit 12-hour and 24-hour formats with seconds", () => {
  const date = new Date(2026, 6, 31, 20, 5, 47);
  const twelveHour = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(date);
  const twentyFourHour = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);

  assert.equal(formatLocalTime(date, "12h"), twelveHour);
  assert.equal(formatLocalTime(date, "24h", true), twentyFourHour);
});

test("the fullscreen clock schedules updates on the selected boundary", () => {
  assert.equal(msUntilNextClockTick(0, false), 60_000);
  assert.equal(msUntilNextClockTick(59_999, false), 1);
  assert.equal(msUntilNextClockTick(60_001, false), 59_999);
  assert.equal(msUntilNextClockTick(1_250, true), 750);
  assert.equal(msUntilNextClockTick(1_999, true), 1);
});

test("playback end time accounts for progress and playback speed", () => {
  const now = new Date(2026, 6, 31, 20, 0, 0);

  assert.equal(
    estimatePlaybackEndTime(now, 7_200, 1_800)?.getTime(),
    new Date(2026, 6, 31, 21, 30, 0).getTime(),
  );
  assert.equal(
    estimatePlaybackEndTime(now, 7_200, 1_800, 2)?.getTime(),
    new Date(2026, 6, 31, 20, 45, 0).getTime(),
  );
});

test("playback end time stays hidden for live, invalid, or completed video", () => {
  const now = new Date(2026, 6, 31, 20, 0, 0);

  assert.equal(estimatePlaybackEndTime(now, 0, 0), null);
  assert.equal(estimatePlaybackEndTime(now, Number.POSITIVE_INFINITY, 0), null);
  assert.equal(estimatePlaybackEndTime(now, 3_600, 3_600), null);
  assert.equal(estimatePlaybackEndTime(now, 3_600, 100, 0), null);
});

test("invalid stored clock options fall back to safe defaults", () => {
  assert.equal(sanitizeFullscreenClockFormat("12h"), "12h");
  assert.equal(sanitizeFullscreenClockFormat("military"), "system");
  assert.equal(sanitizeFullscreenClockStyle("accent"), "accent");
  assert.equal(sanitizeFullscreenClockStyle("digital"), "glass");
  assert.equal(sanitizeFullscreenClockStyle("neon"), "glass");
  assert.equal(sanitizeFullscreenClockSize(undefined), 13);
  assert.equal(sanitizeFullscreenClockSize(8), 11);
  assert.equal(sanitizeFullscreenClockSize(18.6), 19);
  assert.equal(sanitizeFullscreenClockSize(30), 24);
});
