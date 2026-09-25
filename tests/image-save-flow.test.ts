import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function harness(options: { cancel?: boolean; denyDialog?: boolean; denyWrite?: boolean } = {}) {
  const written: Uint8Array[] = [];
  const calls: string[] = [];
  const mocks: Record<string, unknown> = {
    "@tauri-apps/api/core": {
      convertFileSrc: (path: string) => path,
    },
    "@tauri-apps/plugin-dialog": {
      save: async () => {
        calls.push("dialog");
        if (options.denyDialog) throw new Error("dialog unavailable");
        return options.cancel ? null : "C:/fixture/downloads/test.png";
      },
    },
    "@tauri-apps/plugin-fs": {
      writeFile: async (_path: string, bytes: Uint8Array) => {
        calls.push("write");
        if (options.denyWrite) throw "permission denied";
        written.push(bytes);
      },
    },
  };
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/lib/download/save-binary.ts", import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", outputText)(
    (name: string) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    module,
    module.exports,
    { __TAURI_INTERNALS__: {}, __HARBOR_CONTEXT_REVIEW__: true },
  );
  return {
    api: module.exports as typeof import("../src/lib/download/save-binary.ts"),
    calls,
    written,
  };
}
test("image save reports success only after write, and cancellation performs no write", async () => {
  const h = harness();
  const bytes = new Uint8Array([1, 2, 3]);
  assert.deepEqual(await h.api.saveBinaryToDisk(bytes, "test.png", "png", "image/png"), {
    saved: true,
    path: "C:/fixture/downloads/test.png",
  });
  assert.deepEqual(h.written, [bytes]);
  assert.deepEqual(h.calls, ["dialog", "write"]);
  const cancel = harness({ cancel: true });
  assert.deepEqual(await cancel.api.saveBinaryToDisk(bytes, "test.png", "png", "image/png"), {
    saved: false,
    path: null,
  });
  assert.equal(cancel.written.length, 0);
});
test("dialog and genuine write errors become distinct actionable Errors, never fake success", async () => {
  for (const [options, expected] of [
    [{ denyDialog: true }, /save dialog/i],
    [{ denyWrite: true }, /write.*image|write.*file/i],
  ] as const) {
    const h = harness(options);
    await assert.rejects(
      h.api.saveBinaryToDisk(new Uint8Array([1]), "test.png", "png", "image/png"),
      (error: unknown) => error instanceof Error && expected.test(error.message),
    );
    assert.equal(h.written.length, 0);
  }
});

test("usable independent builds use the chosen save destination without a fixture-only restriction", async () => {
  const h = harness();
  await h.api.saveBinaryToDisk(new Uint8Array([1]), "test.png", "png", "image/png");
  assert.deepEqual(h.calls, ["dialog", "write"]);
  assert.equal(h.written.length, 1);
});
