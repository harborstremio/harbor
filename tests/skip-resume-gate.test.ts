import assert from "node:assert/strict";
import test from "node:test";
import { hookHarness } from "./helpers/hook-harness.ts";

test("a valid zero-start intro waits for playback and remains skippable after resume resolves", () => {
  let position = 0;
  const skips: number[] = [];
  const segment = { kind: "intro", startSec: 0, endSec: 90, source: "chapters" };
  const h = hookHarness("src/views/player/skip-pill-container.tsx", "SkipPillContainer", {
    "react/jsx-runtime": { jsx: (_type: any, props: any) => props },
    "@/lib/player/playback-clock": { usePlaybackPosition: () => position },
    "@/components/player/skip-pill": { SkipPill() {} },
    "@/views/big-picture/player/bp-skip-pill": { BpSkipPill() {} },
    "@/lib/skip-intro": { activeSegment: (_segments: any, at: number) => at < 90 ? segment : null },
    "@/lib/settings": { useSettings: () => ({ settings: { autoSkipIntro: true, nextEpisodeLeadSec: 0, showSkipButton: true, skipButtonHideSec: 0 } }) },
  });
  const args = { skipSegments: [segment], durationSec: 1800, hasNextEpisode: false, allowAutoSkip: false,
    onSkip: (sec: number) => skips.push(sec) };
  h.render(args); position = 1; h.render(args);
  assert.deepEqual(skips, [], "pending resume owns the seek");
  position = 0; args.allowAutoSkip = true; h.render(args);
  assert.deepEqual(skips, [], "a reset clock is not evidence playback started");
  position = 1; h.render(args); position = 2; h.render(args);
  assert.deepEqual(skips, [90], "valid zero-start intros still skip once");
});
