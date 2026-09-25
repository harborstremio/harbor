import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const KEY = "harbor.auto-download.v1";
const meta = { id: "tt7654321", type: "series", name: "Fixture series" };

function store() {
  const data = new Map<string, string>();
  let fail = false;
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail) throw new Error("fixture write denied");
      data.set(key, value);
    },
  };
  const load = () => {
    const code = ts.transpileModule(
      readFileSync(new URL("../src/lib/auto-download.ts", import.meta.url), "utf8"),
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      },
    ).outputText;
    const module = { exports: {} as any };
    new Function("require", "module", "exports", "localStorage", code)(
      () => ({ useSyncExternalStore() {} }),
      module,
      module.exports,
      storage,
    );
    return module.exports as typeof import("../src/lib/auto-download.ts");
  };
  return {
    load,
    data,
    fail: (next: boolean) => {
      fail = next;
    },
  };
}

test("automatic-rule enable persists exactly one rule and survives a fresh module load", () => {
  const fixture = store();
  const rules = fixture.load();
  const first = rules.addAutoDownload(meta);
  assert.equal(rules.addAutoDownload(meta), first);
  assert.equal(JSON.parse(fixture.data.get(KEY)!).length, 1);
  assert.equal(fixture.load().isAutoDownloaded(meta.id), true);
  rules.removeAutoDownload(meta.id);
  assert.equal(fixture.load().isAutoDownloaded(meta.id), false);
});

test("failed rule enable neither claims enabled in memory nor overwrites saved rules", () => {
  const fixture = store();
  const rules = fixture.load();
  rules.addAutoDownload({ ...meta, id: "tt1111111" });
  const saved = fixture.data.get(KEY);
  fixture.fail(true);
  assert.throws(() => rules.toggleAutoDownload(meta));
  assert.equal(rules.isAutoDownloaded(meta.id), false);
  assert.equal(fixture.data.get(KEY), saved);
});

test("failed disable and setting changes retain the confirmed rule and episode record", () => {
  const fixture = store();
  const rules = fixture.load();
  rules.addAutoDownload(meta);
  const before = rules.autoDlList();
  fixture.fail(true);
  assert.throws(() => rules.removeAutoDownload(meta.id));
  assert.throws(() => rules.updateAutoDownload(meta.id, { allowP2p: true }));
  assert.throws(() => rules.recordGrab(meta.id, "S1E1", "Episode 1"));
  assert.equal(rules.autoDlList(), before);
  assert.equal(rules.isAutoDownloaded(meta.id), true);
  assert.equal(fixture.load().autoDlList()[0].allowP2p, false);
});
