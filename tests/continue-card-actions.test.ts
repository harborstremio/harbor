// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const continueCardSource = readFileSync(
  new URL("../src/components/continue-card.tsx", import.meta.url),
  "utf8",
);

test("Continue Watching keeps source selection, direct play, and details as separate actions", () => {
  assert.match(
    continueCardSource,
    /const onChooseSource[\s\S]*?openPicker\(meta, episode, \{ autoPlay: false, resume: false \}\)/,
  );
  assert.match(
    continueCardSource,
    /playStream: \(\) => openPicker\(meta, episode, \{ autoPlay: true, resume: true \}\)/,
  );
  assert.match(continueCardSource, /onClick=\{onOpenDetails\}/);
});

test("Continue Watching resolves an ordinary episode title before either picker action", () => {
  assert.match(continueCardSource, /const EPISODE_TITLE_CLICK_WAIT_MS = 900/);
  assert.match(
    continueCardSource,
    /const resolveEpisode[\s\S]*?resolveEpisodeTitleOnDemand\([\s\S]*?loadSeasonEpisodes[\s\S]*?EPISODE_TITLE_CLICK_WAIT_MS/,
  );
  assert.match(
    continueCardSource,
    /const activateOnce = async[\s\S]*?await resolveEpisode\(\)[\s\S]*?await action\(episode\)/,
  );
});

test("Continue Watching coalesces activation and drops stale async completions", () => {
  assert.match(
    continueCardSource,
    /const activateOnce = async[\s\S]*?if \(activationRef\.current === key\) return;[\s\S]*?await resolveEpisode\(\)[\s\S]*?!mountedRef\.current \|\| activationItemKeyRef\.current !== key/,
  );
  assert.match(continueCardSource, /const onChooseSource = \(\) =>\s*activateOnce/);
  assert.match(continueCardSource, /void activateOnce\(\(episode\) =>/);
});
