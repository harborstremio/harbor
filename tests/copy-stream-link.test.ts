import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as magnet from "../src/lib/torrent/magnet.ts";

function load(path: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", ...Object.keys(globals), compiled)(
    (id: string) => {
      assert.ok(id in mocks, id);
      return mocks[id];
    },
    exports,
    ...Object.values(globals),
  );
  return exports;
}

const torrent = load("src/lib/torrent/stremio-stream.ts", { "@/lib/stremio-server": {} });

function fixture(
  options: {
    native?: boolean;
    nativeFails?: boolean;
    web?: boolean;
    webFails?: boolean;
    legacyFails?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let copied = "";
  const input = {
    value: "",
    style: {},
    select() {
      calls.push("select");
    },
    remove() {
      calls.push("remove");
    },
  };
  const copy = load(
    "src/components/player/copy-link-button.tsx",
    {
      react: {},
      "lucide-react": {},
      "@/lib/i18n": {},
      "@/lib/torrent/magnet": magnet,
      "@/lib/torrent/stremio-stream": torrent,
      "@tauri-apps/plugin-clipboard-manager": {
        writeText: async (value: string) => {
          calls.push("native");
          if (options.nativeFails) throw new Error("unavailable");
          copied = value;
        },
      },
    },
    {
      window: options.native ? { __TAURI_INTERNALS__: {} } : {},
      navigator: {
        clipboard:
          options.web === false
            ? undefined
            : {
                writeText: async (value: string) => {
                  calls.push("web");
                  if (options.webFails) throw new Error("unavailable");
                  copied = value;
                },
              },
      },
      document: {
        createElement: () => input,
        body: {
          appendChild() {
            calls.push("append");
          },
        },
        execCommand: () => {
          calls.push("legacy");
          if (options.legacyFails) throw new Error("unavailable");
          copied = input.value;
          return true;
        },
      },
    },
  ) as typeof import("../src/components/player/copy-link-button");
  return { ...copy, calls, copied: () => copied };
}

test("desktop copy uses native clipboard; browser copy avoids native IPC", async () => {
  for (const native of [true, false]) {
    const h = fixture({ native });
    assert.equal(await h.copyText("https://fixture.invalid/video"), true);
    assert.deepEqual(h.calls, [native ? "native" : "web"]);
    assert.equal(h.copied(), "https://fixture.invalid/video");
  }
});

test("clipboard fallback retains legacy WebViews and cleans temporary elements on failure", async () => {
  const h = fixture({ native: true, nativeFails: true, webFails: true });
  assert.equal(await h.copyText("test"), true);
  assert.deepEqual(h.calls, ["native", "web", "append", "select", "legacy", "remove"]);
  assert.equal(h.copied(), "test");
  const unavailable = fixture({ web: false, legacyFails: true });
  assert.equal(await unavailable.copyText("test"), false);
  assert.equal(unavailable.calls.at(-1), "remove");
});

test("stream copy retains direct links and creates usable torrent magnets", () => {
  const h = fixture();
  const hash = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";
  assert.equal(
    h.resolveStreamLink({ url: "https://direct.invalid", infoHash: hash }),
    "https://direct.invalid",
  );
  assert.equal(
    h.resolveStreamLink({ url: "", externalUrl: "https://external.invalid" }),
    "https://external.invalid",
  );
  assert.equal(h.resolveStreamLink({ infoHash: "invalid" }), null);
  assert.equal(h.resolveStreamLink({}), null);
  const name = "100% + café [1080p].mkv";
  const result = h.resolveStreamLink({
    infoHash: hash,
    behaviorHints: { filename: name },
    sources: [
      `dht:${hash}`,
      "tracker:udp://tracker.invalid:80/announce",
      "https://tracker.invalid/announce",
      "invalid",
    ],
  });
  assert.ok(result?.startsWith("magnet:?"));
  assert.deepEqual(magnet.parseMagnet(result), {
    infoHash: hash.toLowerCase(),
    name,
    trackers: ["udp://tracker.invalid:80/announce", "https://tracker.invalid/announce"],
  });
});
