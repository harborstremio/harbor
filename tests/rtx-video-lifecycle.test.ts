// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";
import * as policy from "../src/lib/player/rtx-video-policy.ts";

const request = { hdr: false, vsr: true, svpActive: false, hdrToSdr: true };
function harness() {
  let filter: string | null = null;
  let hint: unknown = "auto";
  let props: Record<string, unknown> = { gamma: "bt.1886", primaries: "bt.709", w: 1920, h: 1080 };
  let beforeRead: (() => Promise<void>) | undefined;
  const commands: string[][] = [];
  const mocks: Record<string, unknown> = {
    "@/lib/platform": { isWindowsDesktop: () => true },
    "./rtx-video-policy": policy,
    "@tauri-apps/api/core": {
      invoke: async (name: string, args: { name?: string; value?: unknown; cmd?: string[] }) => {
        if (name === "mpv_get_property") {
          if (args.name === "target-colorspace-hint-mode") return hint;
          await beforeRead?.();
          return props[args.name!.split("/").pop()!];
        }
        if (name === "mpv_set_property") hint = args.value;
        if (args.cmd) {
          commands.push(args.cmd);
          if (args.cmd[1] === "remove") filter = null;
          if (args.cmd[1] === "add") filter = args.cmd[2];
        }
      },
    },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(
    readFileSync(new URL("../src/lib/player/rtx-video.ts", import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name));
      return mocks[name];
    },
    module,
    module.exports,
  );
  return {
    api: module.exports as typeof import("../src/lib/player/rtx-video"),
    filter: () => filter,
    hint: () => hint,
    commands,
    source: (next: Record<string, unknown>) => {
      props = next;
    },
    blockRead: (fn?: () => Promise<void>) => {
      beforeRead = fn;
    },
  };
}

for (const [label, props] of Object.entries({
  hdr: { gamma: "pq", primaries: "bt.2020", w: 3840, h: 2160 },
  fourK: { gamma: "bt.1886", primaries: "bt.709", w: 3840, h: 2160 },
  unknown: {},
})) {
  test(`retained SDR filter is removed before ${label} source`, async () => {
    const h = harness();
    await h.api.applyRtxVideo(request, "first");
    assert.match(h.filter()!, /scale=2/);
    h.api.resetRtxVideoState();
    h.source(props);
    await h.api.applyRtxVideo(request, "second");
    assert.equal(h.filter(), null);
  });
}

test("session key changes clean native state without an explicit reset", async () => {
  const h = harness();
  await h.api.applyRtxVideo(request, "first");
  h.source({ gamma: "pq", primaries: "bt.2020", w: 3840, h: 2160 });
  await h.api.applyRtxVideo(request, "second");
  assert.equal(h.filter(), null);
});

test("reset restores the original HDR hint and eligible SDR still works afterward", async () => {
  const h = harness();
  await h.api.applyRtxVideo({ ...request, hdr: true, hdrToSdr: false }, "first");
  assert.equal(h.hint(), "source");
  h.api.resetRtxVideoState();
  await h.api.applyRtxVideo({ ...request, vsr: false }, "second");
  assert.equal(h.hint(), "auto");
  assert.equal(h.filter(), null);
  await h.api.applyRtxVideo(request, "second");
  assert.match(h.filter()!, /scale=2/);
});

test("reset invalidates an in-flight metadata read before it adds a filter", async () => {
  const h = harness();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  h.blockRead(async () => {
    entered();
    await gate;
  });
  const old = h.api.applyRtxVideo(request, "first");
  await started;
  h.api.resetRtxVideoState();
  release();
  await old;
  h.blockRead();
  await h.api.applyRtxVideo({ ...request, vsr: false }, "second");
  assert.equal(
    h.commands.some((cmd) => cmd[1] === "add"),
    false,
  );
  assert.equal(h.filter(), null);
});
