import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/streams/plugins/install.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function installer({ fetched, prior, fails = false } = {}) {
  const saved = [];
  const dependencies = {
    "@/lib/safe-fetch": {
      safeFetch: async () => new Response("export const streams = () => []"),
      safeFetchBytes: async () => new Response(new Uint8Array([0x50, 0x4b, 0x80, 0xff])),
      safeFetchBase64: async () => {
        if (fails) throw new Error("download unavailable");
        return fetched;
      },
    },
    "@/lib/manga/plugins/host-http": {
      assertSafeUrl: (url) => {
        if (!url.startsWith("https://public.example/")) throw new Error("rejected URL");
        return url;
      },
    },
    "@/lib/manga/plugins/worker-host": {
      PluginWorker: class {
        async meta() {
          return { methods: ["streams"] };
        }
        dispose() {}
      },
    },
    "@/lib/secret-store": { setSecret() {} },
    "./manifest": { pluginIdFor: () => "fixture" },
    "./native": { installNativeArchive: async () => ({ extensionId: "fixture" }) },
    "./runtime": { disposeStreamPlugin() {} },
    "./source": { workerPluginFor: (p) => p },
    "./store": { streamPluginById: () => prior, saveStreamPlugin: async (p) => saved.push(p) },
    "./types": { PluginError: class extends Error {} },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "crypto", compiled)(
    (id) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
    webcrypto,
  );
  return { install: module.exports.installEntry, saved };
}

for (const format of ["javascript", "android-extension"]) {
  const repo = { url: "https://public.example/repo", name: "Fixture" };
  const entry = {
    id: "fixture",
    entry: "https://public.example/code",
    icon: "https://public.example/icon.png",
    format,
  };
  test(`${format}: successful binary icon data stays intact`, async () => {
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00]).toString("base64");
    const h = installer({ fetched: { ok: true, headers: { "content-type": "image/png" }, body } });
    const plugin = await h.install(repo, entry);
    assert.equal(plugin.icon, `data:image/png;base64,${body}`);
    assert.equal(h.saved[0].icon, plugin.icon);
  });
  test(`${format}: native icon failure retains a usable remote URL`, async () => {
    const h = installer({ fails: true });
    assert.equal((await h.install(repo, entry)).icon, entry.icon);
  });
  test(`${format}: rejected icon URL cannot replace an existing icon`, async () => {
    const h = installer({ prior: { icon: "data:image/png;base64,cHJpb3I=" } });
    assert.equal(
      (await h.install(repo, { ...entry, icon: "file:///private" })).icon,
      "data:image/png;base64,cHJpb3I=",
    );
  });
  test(`${format}: a redirect or non-image response falls back without storing its body`, async () => {
    const h = installer({ fetched: { ok: false, headers: {}, body: "redirect" } });
    assert.equal((await h.install(repo, entry)).icon, entry.icon);
    const invalid = installer({
      fetched: { ok: true, headers: { "content-type": "text/html" }, body: "html" },
    });
    assert.equal((await invalid.install(repo, entry)).icon, entry.icon);
  });
}
