import assert from "node:assert/strict";
import test from "node:test";
import { CONTENT_ADVISORY_NUDGE, parseOnboardingFlags } from "../src/lib/onboarding";

test("fresh installs keep the first-playback invitation pending across restarts", () => {
  const fresh = parseOnboardingFlags(null);
  assert.equal(fresh.nudges[CONTENT_ADVISORY_NUDGE], false);
  const restarted = parseOnboardingFlags(JSON.stringify({ ...fresh, onboarded: true }));
  assert.equal(restarted.nudges[CONTENT_ADVISORY_NUDGE], false);
});

test("upgrades do not invite existing users or reset their other nudges", () => {
  const upgraded = parseOnboardingFlags(
    JSON.stringify({ onboarded: true, nudges: { tmdb: true } }),
  );
  assert.equal(upgraded.nudges[CONTENT_ADVISORY_NUDGE], true);
  assert.equal(upgraded.nudges.tmdb, true);
  assert.equal(upgraded.onboarded, true);
});

test("a seen invitation stays dismissed after restart", () => {
  const fresh = parseOnboardingFlags(null);
  const flags = { ...fresh, nudges: { ...fresh.nudges, [CONTENT_ADVISORY_NUDGE]: true } };
  assert.equal(parseOnboardingFlags(JSON.stringify(flags)).nudges[CONTENT_ADVISORY_NUDGE], true);
});
