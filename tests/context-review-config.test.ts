// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFile } from "node:fs/promises";
import { mergeReviewConfig, assertReviewIsolation } from "../scripts/context-review-config.mjs";

test("merged review configs isolate full Harbor and the native fixture without production registrations", async () => {
  const read = async (name: string) =>
    JSON.parse(await readFile(new URL(`../src-tauri/${name}`, import.meta.url), "utf8"));
  const base = await read("tauri.conf.json");
  const windows = await read("tauri.windows.conf.json");
  const review = await read("tauri.context-review.conf.json");
  const full = mergeReviewConfig(mergeReviewConfig(base, windows), review);
  assertReviewIsolation(full);
  assert.equal(full.app.windows[0].url, "index.html");
  const fixture = mergeReviewConfig(full, await read("tauri.context-fixture.conf.json"));
  assertReviewIsolation(fixture);
  assert.equal(fixture.app.windows[0].url, "context-review.html");
  assert.throws(() => assertReviewIsolation({ ...full, identifier: "app.harbor" }), /identity/i);
  assert.throws(
    () =>
      assertReviewIsolation({
        ...full,
        bundle: { ...full.bundle, fileAssociations: base.bundle.fileAssociations },
      }),
    /association/i,
  );
  assert.throws(
    () =>
      assertReviewIsolation({
        ...full,
        plugins: { ...full.plugins, updater: base.plugins.updater },
      }),
    /updater/i,
  );
});
