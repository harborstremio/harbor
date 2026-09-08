// @ts-expect-error Node test types.
import assert from "node:assert/strict";
// @ts-expect-error Node test types.
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { friendCommand } from "../src/lib/social/friend-command";
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
  let confirm!: (approved: boolean) => void;
  let opened!: () => void;
  const confirmationOpened = new Promise<void>((resolve) => {
    opened = resolve;
  });
  const confirmation = new Promise<boolean>((resolve) => {
    confirm = resolve;
  });
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
  const api = load("../src/views/profile/context-targets.tsx", {
    "react/jsx-runtime": { jsx: unexpected },
    "lucide-react": { Copy: unexpected, Link2: unexpected, UserRound: unexpected },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://fixture.invalid" },
    "@/lib/social/open-profile": { requestOpenProfile: unexpected },
    "@/lib/i18n": { t: (text: string) => text },
    "@/components/context-menu/content-actions": { copyContextText: unexpected },
    "@/lib/theme-auth": { currentAuthor: () => ({ handle: account.handle }) },
    "./profile-api": {
      fetchSummary: async (handle: string) => {
        reads.push(handle);
        return { handle, friendStatus: "friends", friendEdgeId: "fixture-edge" };
      },
    },
    "@/lib/social/friends": friends,
    "@/lib/social/friend-command": { friendCommand },
    "@/lib/dialog": {
      confirmDialog: () => {
        opened();
        return confirmation;
      },
    },
  }) as typeof import("../src/views/profile/context-targets.tsx");
  api.subscribeFriendStatus((handle, status) => changed.push({ handle, status }));
  const remove = api
    .friendContextActions("Friend", "friends")
    .find((action) => action.id === "friend:remove");
  assert.ok(remove?.run);
  return { account, writes, reads, changed, confirmationOpened, confirm, remove: remove.run };
}

test("switching accounts while friend removal confirmation is open prevents the friend write", async () => {
  const h = confirmationHarness();
  const removal = h.remove();
  await h.confirmationOpened;
  assert.deepEqual(h.reads, ["Friend"]);
  assert.deepEqual(h.writes, []);
  h.account.handle = "different-owner";
  h.confirm(true);
  await assert.rejects(Promise.resolve(removal), /profile changed/);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.changed, []);
});

test("confirmed friend removal for the unchanged account writes once and publishes the acknowledged state", async () => {
  const h = confirmationHarness();
  const removal = h.remove();
  await h.confirmationOpened;
  assert.deepEqual(h.writes, []);
  h.confirm(true);
  await removal;
  assert.deepEqual(h.writes, [
    { path: "/social/friends/remove", body: { handle: "friend" }, author: "owner" },
  ]);
  assert.deepEqual(h.changed, [{ handle: "Friend", status: "none" }]);
});
