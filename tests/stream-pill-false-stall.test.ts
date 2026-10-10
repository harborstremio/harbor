// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { emptySnapshot, type PlayerSnapshot } from "../src/lib/player/bridge.ts";
import { resolveStreamPillVariant } from "../src/views/player/hooks/use-stream-pill.ts";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(at(path), "utf8");

const base = {
  dismissed: false,
  pillSuppressed: false,
  pipMode: false,
  showWaiting: false,
  isLocalSrc: false,
  slowLoad: false,
  inRoom: false,
  streamCheckOpen: false,
};

const snapshot = (over: Partial<PlayerSnapshot>): PlayerSnapshot => ({ ...emptySnapshot, ...over });

test("a slow load that already produced a frame never shows the stalled pill", () => {
  assert.equal(
    resolveStreamPillVariant({
      ...base,
      slowLoad: true,
      snap: snapshot({ status: "playing", firstFrameReady: true, durationSec: 0 }),
    }),
    null,
  );
});

test("a slow load with no frame still shows the stalled pill", () => {
  assert.equal(
    resolveStreamPillVariant({
      ...base,
      slowLoad: true,
      snap: snapshot({ status: "loading", firstFrameReady: false, durationSec: 0 }),
    }),
    "stalled",
  );
});

test("a stream without a container duration is not treated as a stall", () => {
  const autoRetry = read("src/views/player/hooks/use-auto-retry.ts");
  assert.match(autoRetry, /const hasMeaningful = hasProgress \|\| snap\.firstFrameReady;/);
  assert.doesNotMatch(autoRetry, /hasMeaningful = snap\.durationSec/);
  assert.match(autoRetry, /\[src\.url, snap\.firstFrameReady, hasProgress, isLocal\]/);
});

test("every stream pill variant can be dismissed", () => {
  const pill = read("src/components/player/stream-check-pill.tsx");
  assert.match(pill, /onDismiss: \(\) => void;/);
  assert.doesNotMatch(pill, /variant === "check" && onDismiss/);
  assert.equal(
    resolveStreamPillVariant({
      ...base,
      dismissed: true,
      slowLoad: true,
      snap: snapshot({ status: "loading" }),
    }),
    null,
  );
});

test("dismissal resets when the source changes", () => {
  const hook = read("src/views/player/hooks/use-stream-pill.ts");
  const effect = hook.slice(hook.indexOf("useEffect(() => {"), hook.indexOf("}, [srcUrl]);"));
  assert.match(effect, /setDismissed\(false\)/);
});
