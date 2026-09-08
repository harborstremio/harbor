import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("terminal progress cannot settle a download before the native writer command returns", async () => {
  const channels: { onmessage: (event: unknown) => void }[] = [];
  let release!: () => void;
  const native = new Promise<void>((resolve) => {
    release = resolve;
  });
  const module = { exports: {} };
  const source = readFileSync(
    new URL("../src/lib/download/video-download.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  new Function("require", "module", "exports", outputText)(
    () => ({
      Channel: class {
        onmessage = (_event: unknown) => {};
        constructor() {
          channels.push(this);
        }
      },
      invoke: (command: string) => (command === "download_start" ? native : Promise.resolve()),
    }),
    module,
    module.exports,
  );
  const { startDownload } =
    module.exports as typeof import("../src/lib/download/video-download.ts");
  const handle = startDownload(
    "fixture",
    "https://example.test/video",
    "C:/fixtures/video",
    () => {},
  );
  let settled = false;
  void handle.promise.then(() => {
    settled = true;
  });
  channels[0].onmessage({ kind: "done", received: 100 });
  await Promise.resolve();
  assert.equal(settled, false);
  release();
  await handle.promise;
  assert.equal(settled, true);
});
