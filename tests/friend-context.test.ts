// @ts-expect-error Node test types.
import assert from "node:assert/strict";
// @ts-expect-error Node test types.
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { friendCommand } from "../src/lib/social/friend-command";
import { canOpenProfile, registerProfileDestination } from "../src/lib/social/open-profile";
import { executeContextAction } from "../src/lib/context-actions";
test("relationship commands retain actual friendship semantics", () => {
  assert.equal(friendCommand("none"), "request");
  assert.equal(friendCommand("outgoing"), "cancel");
  assert.equal(friendCommand("incoming"), "accept");
  assert.equal(friendCommand("friends"), "remove");
  assert.equal(friendCommand("blocked"), null);
  assert.equal(friendCommand(undefined), null);
});

function confirmationHarness() {
  const account = { handle: "owner" };
  const writes: Array<{ path: string; body: unknown; author: string }> = [];
  const reads: string[] = [];
  const changed: Array<{ handle: string; status: string }> = [];
  let relationship = "friends";
  const unexpected = () => {
    throw new Error("Unexpected UI action");
  };
  const load = (relative: string, dependencies: Record<string, unknown>) => {
    const { outputText } = ts.transpileModule(
      readFileSync(new URL(relative, import.meta.url), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    );
    const module = { exports: {} };
    new Function("require", "module", "exports", outputText)(
      (name: string) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      module,
      module.exports,
    );
    return module.exports;
  };
  // Keep both the action and its friend-service request serialization real.
  // The network and confirmation boundaries operate only on fixture state.
  const friends = load("../src/lib/social/friends.ts", {
    "./client": {
      socialPost: async (path: string, body: unknown) => {
        writes.push({ path, body, author: account.handle });
        return { ok: true };
      },
      socialGet: unexpected,
    },
  });
  const actors = load("../src/lib/social/action-actor.ts", {
    "@/lib/active-profile-id": { activeProfileId: () => "fixture-profile" },
    "@/lib/theme-auth": { currentAuthor: () => ({ id: account.handle, handle: account.handle }) },
  });
  const api = load("../src/views/profile/context-targets.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://fixture.invalid" },
    "@/lib/social/open-profile": { requestOpenProfile: unexpected, canOpenProfile },
    "@/lib/i18n": { t: (text: string) => text },
    "@/components/context-menu/content-actions": { copyContextText: unexpected },
    "@/lib/theme-auth": { currentAuthor: () => ({ handle: account.handle }) },
    "@/lib/social/action-actor": actors,
    "./profile-api": {
      fetchSummary: async (handle: string) => {
        reads.push(handle);
        return { handle, friendStatus: relationship, friendEdgeId: "fixture-edge" };
      },
    },
    "@/lib/social/friends": friends,
    "@/lib/social/friend-command": { friendCommand },
    "@/lib/dialog": {
      confirmDialog: unexpected,
    },
  }) as typeof import("../src/views/profile/context-targets.tsx");
  api.subscribeFriendStatus((handle, status) => changed.push({ handle, status }));
  const remove = api
    .friendContextActions("Friend", "friends")
    .find((action) => action.id === "friend:remove");
  assert.ok(remove?.run);
  return {
    api,
    account,
    writes,
    reads,
    changed,
    remove,
    source: { actions: () => api.friendContextActions("Friend", "friends") },
    setRelationship: (next) => {
      relationship = next;
    },
  };
}

test("profile menus omit only the already active destination while retaining copy and relationship actions", () => {
  const h = confirmationHarness();
  let destination = "friend";
  const cleanup = registerProfileDestination(() => destination);
  try {
    const target = h.api.userContextTarget(
      "Friend",
      h.api.friendContextActions("Friend", "friends"),
    );
    assert.equal(target.kind, "actions");
    if (target.kind !== "actions") return;
    const same = target.actions();
    assert.equal(
      same.some((action) => action.id === "user:open"),
      false,
    );
    assert.ok(same.find((action) => action.id === "user:copy-name")?.icon);
    assert.ok(same.find((action) => action.id === "friend:remove")?.icon);
    destination = "someone-else";
    assert.equal(target.actions()[0].id, "user:open");
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.reads, []);
  } finally {
    cleanup();
  }
});

test("switching accounts while friend removal confirmation is open prevents the friend write", async () => {
  const h = confirmationHarness();
  await assert.rejects(executeContextAction(h.source, "friend:remove"), /confirmation/);
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.writes, []);
  const key = h.remove.confirmation?.key;
  assert.ok(key);
  h.account.handle = "different-owner";
  await assert.rejects(
    executeContextAction(h.source, "friend:remove", { confirmationKey: key }),
    /changed/,
  );
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.changed, []);
});

test("confirmed friend removal for the unchanged account writes once and publishes the acknowledged state", async () => {
  const h = confirmationHarness();
  assert.ok(h.remove.confirmation?.key);
  assert.deepEqual(h.writes, []);
  await executeContextAction(h.source, "friend:remove", {
    confirmationKey: h.remove.confirmation.key,
  });
  assert.deepEqual(h.writes, [
    { path: "/social/friends/remove", body: { handle: "friend" }, author: "owner" },
  ]);
  assert.deepEqual(h.changed, [{ handle: "Friend", status: "none" }]);
});

test("a changed relationship is rechecked after confirmation and cannot remove a different edge", async () => {
  const h = confirmationHarness();
  h.setRelationship("outgoing");
  await assert.rejects(
    executeContextAction(h.source, "friend:remove", {
      confirmationKey: h.remove.confirmation?.key,
    }),
    /relationship changed/,
  );
  assert.deepEqual(h.writes, []);
});
