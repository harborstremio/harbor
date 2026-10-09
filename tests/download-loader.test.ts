// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const downloadsPopoverSource = readFileSync(
  new URL("../src/components/downloads-popover.tsx", import.meta.url),
  "utf8",
);
const harborLoaderSource = readFileSync(
  new URL("../src/components/harbor-loader.tsx", import.meta.url),
  "utf8",
);

test("active downloads reuse the shared Harbor loader at compact size", () => {
  assert.match(downloadsPopoverSource, /import \{ HarborLoader \}/);
  assert.match(downloadsPopoverSource, /downloadingCount > 0[\s\S]*?<HarborLoader size="xs"/);
  assert.match(harborLoaderSource, /xs: "h-7 w-7"/);
  assert.doesNotMatch(downloadsPopoverSource, /DownloadActivityIcon|download-harbor-/);
});
