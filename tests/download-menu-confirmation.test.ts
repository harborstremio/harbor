import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { executeContextAction } from "../src/lib/context-actions.ts";
import { downloadConfirmation } from "../src/lib/download/confirmation.ts";

test("real download action builder requires scoped confirmation, retains failures, and never invokes a native confirmation", async () => {
  let path = "C:/fixtures/first.mkv";
  let actor = "first";
  let authorId = "fixture-author";
  let failed = false;
  let deletes = 0;
  const item = () => ({
    id: "one",
    title: "Test episode",
    path,
    metaId: "title",
    status: "done",
    season: 1,
    episode: 2,
  });
  const mocks: Record<string, unknown> = {
    react: { useRef: (value: unknown) => ({ current: value }), useState: () => [false, () => {}] },
    "react/jsx-runtime": { jsx: () => null },
    "lucide-react": {},
    "@/components/ui-icon": {},
    "@/lib/context-actions": { executeContextAction },
    "@/lib/dialog": {
      alertDialog: () => {
        throw new Error("Unexpected native dialog");
      },
    },
    "@/lib/download/confirmation": { downloadConfirmation },
    "@/lib/membership-operations": {
      captureMembershipProfile: () => ({ activeId: actor, settingsLinked: false }),
    },
    "@/lib/social/action-actor": {
      captureSocialActor: () => ({ profileId: actor, authorId }),
      isSocialActorCurrent: (expected) =>
        expected.profileId === actor && expected.authorId === authorId,
    },
    "@/lib/download/downloads-store": {
      downloadById: item,
      downloadCapabilities: () => ({ delete: true }),
      subscribeDownloads: () => () => {},
      runDownloadBatch: async (ids: string[], command: string, options) => {
        assert.deepEqual(ids, ["one"]);
        assert.equal(command, "delete");
        assert.equal(options.expectedScope.get("one").path, path);
        assert.equal(options.isValid(), true);
        deletes++;
        return failed
          ? { succeeded: [], skipped: [], failed: [{ id: "one", error: "File locked" }] }
          : { succeeded: ["one"], failed: [], skipped: [] };
      },
    },
    "@/lib/download/player-src": {},
    "@/lib/resume": {},
    "@/lib/i18n": {
      useT: () => (s: string, v?: Record<string, unknown>) =>
        s.replace(/\{(\w+)\}/g, (m, k: string) => String(v?.[k] ?? m)),
    },
    "@/lib/view": { useView: () => ({ player: null }) },
  };
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/views/downloads/download-actions.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    module,
    module.exports,
  );
  const api = (
    module.exports as typeof import("../src/views/downloads/download-actions.tsx")
  ).useDownloadActions();
  const source = { actions: () => api.actions("one") };
  const id = "download:one:delete";
  await assert.rejects(executeContextAction(source, id), /requires confirmation/);
  const armed = source.actions().find((a) => a.id === id)!.confirmation!.key;
  path = "C:/fixtures/replacement.mkv";
  await assert.rejects(executeContextAction(source, id, { confirmationKey: armed }), /changed/);
  assert.equal(deletes, 0);
  path = "C:/fixtures/first.mkv";
  actor = "second";
  await assert.rejects(executeContextAction(source, id, { confirmationKey: armed }), /changed/);
  actor = "first";
  authorId = "different-author";
  await assert.rejects(executeContextAction(source, id, { confirmationKey: armed }), /changed/);
  assert.equal(deletes, 0);
  authorId = "fixture-author";
  failed = true;
  await assert.rejects(
    executeContextAction(source, id, { confirmationKey: armed }),
    /1 failed.*File locked/s,
  );
  failed = false;
  const result = await executeContextAction(source, id, { confirmationKey: armed });
  assert.equal(deletes, 2);
  assert.equal(result.dismiss, "keep-open");
});
