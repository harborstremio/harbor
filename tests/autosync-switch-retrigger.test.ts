// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const hook = readFileSync(
  new URL("../src/views/player/hooks/use-auto-sync.ts", import.meta.url),
  "utf8",
);

test("a manual (forced) run always starts fresh, never a silent retry shortcut", () => {
  assert.match(hook, /if \(!force && doneKeyRef\.current === key\) return null;/);
  assert.ok(
    !/if \(retryRef\.current\) \{\s*retryRef\.current\(\);\s*return null;/.test(hook),
    "forced runs must not take the invisible retryRef shortcut that skips setStatus(analyzing)",
  );
});

test("a forced run tries hard immediately", () => {
  assert.match(hook, /await runDirect\(force\);/);
  assert.ok(
    !/await runDirect\(false\);/.test(hook),
    "forced button press should not run the low-effort pass",
  );
});

test("auto-fire happens once per media item and language, not on every track switch", () => {
  assert.match(hook, /firedRef = useRef<\{ mediaKey: string; langs: Set<string> \}>/);
  assert.match(hook, /if \(!fired\.langs\.has\(lang\)\) \{/);
  assert.match(hook, /fired\.langs\.add\(lang\);/);
  assert.match(hook, /if \(fired\.mediaKey !== currentMediaKey\) \{/);
});
