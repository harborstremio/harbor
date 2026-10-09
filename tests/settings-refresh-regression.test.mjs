import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("profile-background storage reads legacy fractions and clamps percentages", async () => {
  const source = readFileSync(new URL("../src/lib/theme-storage.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let dim = null;
  const db = {
    transaction: () => ({
      objectStore: () => ({
        get: (key) => {
          const request = { result: key === "bg_picker" ? "test-image" : dim };
          queueMicrotask(() => request.onsuccess());
          return request;
        },
      }),
    }),
  };
  const indexedDB = {
    open: () => {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
  const module = { exports: {} };
  new Function("module", "exports", "indexedDB", code)(module, module.exports, indexedDB);
  for (const [stored, expected] of [
    [null, 55],
    ["0.55", 55],
    ["55", 55],
    ["0", 0],
    ["1", 1],
    ["100", 100],
    ["120", 100],
    ["-5", 0],
    ["bad", 55],
  ]) {
    dim = stored;
    assert.deepEqual(await module.exports.loadPickerBg(), { image: "test-image", dim: expected });
  }
});

test("subtitle FPS icon is registered and its bundled SVG exists", () => {
  const panel = readFileSync(
    new URL("../src/views/settings/icons-panel.tsx", import.meta.url),
    "utf8",
  );
  const asset = readFileSync(
    new URL("../public/player-icons/subtitle-fps.svg", import.meta.url),
    "utf8",
  );
  assert.match(panel, /"\/player-icons\/subtitle-fps.svg": "\/player-icons\/subtitle-fps.svg"/);
  assert.match(asset, /<svg\b/);
  assert.doesNotMatch(asset, /<script\b|onload=|<foreignObject\b/i);
});
