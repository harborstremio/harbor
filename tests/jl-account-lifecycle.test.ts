import assert from "node:assert/strict";
import test from "node:test";
import { createJlSessionClient, SESSION_KEY } from "../src/lib/jl/account/session-client.ts";
import {
  switchJlWorkspace,
  stageJlWorkspace,
  WORKSPACE_OWNER,
} from "../src/lib/jl/account/workspace.ts";
import { createJlLinkStore } from "../src/lib/jl/account/profile-links.ts";
import { claimKeySyncOwner, runKeySync } from "../src/lib/jl/account/key-sync-run.ts";
import { hashValue } from "../src/lib/jl/account/keys.ts";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    get length() {
      return values.size;
    },
    key: (i: number) => [...values.keys()][i] ?? null,
  };
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const token = (id: string, expires = 1) => ({
  access_token: `access-${id}`,
  refresh_token: `refresh-${id}`,
  expires_at: expires,
  user: { id, email: `${id}@example.test` },
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const make = (fetch: typeof globalThis.fetch, s = storage()) =>
  createJlSessionClient({
    url: "https://account.example.test",
    anonKey: "public-test-key",
    storage: s,
    fetch,
    now: () => 1_000_000,
  });

test("simultaneous refreshes share one request and retain the same identity generation", async () => {
  let calls = 0;
  const wait = deferred<Response>();
  const client = make(async (_input, init) => {
    if (JSON.parse(String(init?.body)).password) return json(token("a"));
    calls++;
    return wait.promise;
  });
  await client.signIn("a@example.test", "password");
  const context = client.context()!;
  const first = client.fresh(),
    second = client.fresh();
  wait.resolve(json(token("a", 5000)));
  assert.equal((await first)?.userId, "a");
  assert.equal((await second)?.userId, "a");
  assert.equal(calls, 1);
  assert.equal(client.isCurrent(context), true);
});

test("a refresh finishing after sign-out cannot restore the session", async () => {
  const wait = deferred<Response>();
  const client = make(async (input) =>
    String(input).includes("refresh_token") ? wait.promise : json(token("a")),
  );
  await client.signIn("a", "password");
  const refresh = client.fresh();
  await client.signOut();
  wait.resolve(json(token("a", 5000)));
  assert.equal(await refresh, null);
  assert.equal(client.read(), null);
});

test("a later sign-in wins even if the earlier request arrives last", async () => {
  const wait = deferred<Response>();
  const client = make(async (_input, init) =>
    JSON.parse(String(init?.body)).email === "a" ? wait.promise : json(token("b", 5000)),
  );
  const first = client.signIn("a", "password");
  await client.signIn("b", "password");
  wait.resolve(json(token("a", 5000)));
  await assert.rejects(first, /account changed/);
  assert.equal(client.read()?.userId, "b");
});

test("offline refresh retains account data but explicit revocation signs out", async () => {
  let error = false;
  const client = make(async (input) =>
    !String(input).includes("refresh_token")
      ? json(token("a"))
      : error
        ? json({ error_code: "session_expired" }, 400)
        : Promise.reject(new Error("offline")),
  );
  await client.signIn("a", "password");
  assert.equal(await client.fresh(), null);
  assert.equal(client.read()?.userId, "a");
  error = true;
  assert.equal(await client.fresh(), null);
  assert.equal(client.read(), null);
});

test("a 401 retries once after refresh and sends only the JL token and media schema", async () => {
  let calls = 0;
  const client = make(async (input, init) => {
    if (String(input).includes("/auth/")) return json(token("a", 5000));
    calls++;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer access-a");
    assert.equal(headers.get("Accept-Profile"), "media");
    return json([], calls === 1 ? 401 : 200);
  });
  await client.signIn("a", "password");
  assert.equal((await client.rest("profiles")).status, 200);
  assert.equal(calls, 2);
});

test("a pending REST response is rejected after account switching", async () => {
  const wait = deferred<Response>();
  const client = make(async (input, init) =>
    String(input).includes("/rest/")
      ? wait.promise
      : json(token(JSON.parse(String(init?.body)).email, 5000)),
  );
  await client.signIn("a", "password");
  const request = client.rest("profiles");
  await client.signIn("b", "password");
  wait.resolve(json([{ private: "a" }]));
  await assert.rejects(request, /account changed/);
});

test("unavailable durable session storage falls back to the current process", async () => {
  const s = storage();
  s.setItem = () => {
    throw new Error("quota");
  };
  const client = make(async () => json(token("a", 5000)), s);
  await client.signIn("a", "password");
  assert.equal(client.read()?.userId, "a");
  await client.signOut();
  assert.equal(client.read(), null);
});

test("workspace parking preserves account A while B and signed-out local remain isolated", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "roster-a");
  s.setItem("harbor.settings.shared", "settings-a");
  s.setItem("harbor.installed-addons", "legacy-config-a");
  assert.equal(switchJlWorkspace(s, null, "a"), true);
  assert.equal(s.getItem("harbor.profiles.v1"), "roster-a");
  assert.equal(switchJlWorkspace(s, "a", "b"), true);
  assert.equal(s.getItem("harbor.profiles.v1"), null);
  assert.equal(s.getItem("harbor.installed-addons"), null);
  assert.equal(s.getItem("harbor.settings.shared"), "{}");
  s.setItem("harbor.profiles.v1", "roster-b");
  switchJlWorkspace(s, "b", "a");
  assert.equal(s.getItem("harbor.profiles.v1"), "roster-a");
  assert.equal(s.getItem("harbor.installed-addons"), "legacy-config-a");
  assert.equal(switchJlWorkspace(s, "a", "a"), false);
  switchJlWorkspace(s, "a", null);
  assert.equal(s.getItem("harbor.profiles.v1"), null);
  switchJlWorkspace(s, null, "b");
  assert.equal(s.getItem("harbor.profiles.v1"), "roster-b");
});

test("a failed workspace swap rolls back before the identity can be changed", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "original");
  s.setItem(WORKSPACE_OWNER, "a");
  const save = s.setItem;
  let fail = true;
  s.setItem = (key, value) => {
    if (fail && key === "harbor.settings.shared") {
      fail = false;
      throw new Error("quota");
    }
    save(key, value);
  };
  assert.throws(() => switchJlWorkspace(s, "a", "b"), /quota/);
  assert.equal(s.getItem("harbor.profiles.v1"), "original");
  assert.equal(s.getItem(WORKSPACE_OWNER), "a");
});

test("legacy account-owned data is not automatically adopted by a different account", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "legacy-a");
  s.setItem("harbor.settings.shared", "legacy-credentials-a");
  s.setItem("jl.account.keys.base.v1.a", "{}");
  switchJlWorkspace(s, null, "b");
  assert.equal(s.getItem("harbor.profiles.v1"), null);
  assert.equal(s.getItem("harbor.settings.shared"), "{}");
  switchJlWorkspace(s, "b", null);
  assert.equal(s.getItem("harbor.profiles.v1"), null);
  switchJlWorkspace(s, null, "a");
  assert.equal(s.getItem("harbor.profiles.v1"), "legacy-a");
});

test("ambiguous legacy ownership stays quarantined instead of becoming anonymous data", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "ambiguous");
  s.setItem("jl.account.keys.base.v1.a", "{}");
  s.setItem("jl.account.keys.base.v1.b", "{}");
  switchJlWorkspace(s, null, "c");
  switchJlWorkspace(s, "c", null);
  assert.equal(s.getItem("harbor.profiles.v1"), null);
  assert.equal(
    JSON.parse(s.getItem("jl.account.workspace.v1.unclaimed")!)["harbor.profiles.v1"],
    "ambiguous",
  );
});

test("an interrupted identity swap can restore the workspace matching the durable session", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "a-roster");
  switchJlWorkspace(s, null, "a");
  switchJlWorkspace(s, "a", "b");
  // Simulate process exit before B's session is persisted. Durable session is still A.
  switchJlWorkspace(s, "b", "a");
  assert.equal(s.getItem(WORKSPACE_OWNER), "a");
  assert.equal(s.getItem("harbor.profiles.v1"), "a-roster");
});

test("upgrade startup isolates an existing B session from an A-owned legacy workspace", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "a-private");
  s.setItem("jl.account.keys.owner.v1", "a");
  switchJlWorkspace(s, null, "b");
  assert.equal(s.getItem(WORKSPACE_OWNER), "b");
  assert.equal(s.getItem("harbor.profiles.v1"), null);
  assert.equal(
    JSON.parse(s.getItem("jl.account.workspace.v1.a")!)["harbor.profiles.v1"],
    "a-private",
  );
});

test("profile links use account IDs and never adopt an ownerless legacy link", () => {
  const s = storage(),
    links = createJlLinkStore(s);
  links.write("local", {
    accountId: "a",
    profileId: "uuid",
    name: "Same Name",
    status: "linked",
    merged: false,
  });
  assert.equal(links.link("local", "b"), null);
  assert.equal(links.link("local", "a")?.profileId, "uuid");
  s.setItem("jl.account.link.v1.other", "legacy");
  assert.equal(links.canAutoCreate("other", "b"), false);
});

test("credential ownership fails closed until an account workspace is established", () => {
  const s = storage();
  s.setItem("jl.account.keys.base.v1.a", "{}");
  assert.equal(claimKeySyncOwner(s, "b"), false);
  s.setItem(WORKSPACE_OWNER, "b");
  assert.equal(claimKeySyncOwner(s, "b"), true);
  assert.equal(claimKeySyncOwner(s, "a"), false);
});

test("keys never apply or checkpoint after account change during pull", async () => {
  let current = true,
    applied = false;
  await assert.rejects(
    runKeySync({
      assertCurrent: () => {
        if (!current) throw new Error("changed");
      },
      readLocal: () => ({}),
      readBase: () => ({}),
      writeBase: () => {
        applied = true;
      },
      pull: async () => {
        current = false;
        return { tmdbKey: "remote" };
      },
      push: async () => {},
      apply: () => {
        applied = true;
      },
    }),
    /changed/,
  );
  assert.equal(applied, false);
});

test("key edits made during a push survive remote apply", async () => {
  let local = { tmdbKey: "old", rdKey: "new" };
  let applied: unknown;
  await runKeySync({
    assertCurrent: () => {},
    readLocal: () => local,
    readBase: () => ({ tmdbKey: hashValue("old") }),
    writeBase: () => {},
    pull: async () => ({ tmdbKey: "theirs" }),
    push: async () => {
      local = { ...local, tmdbKey: "latest" };
    },
    apply: (value) => {
      applied = value;
    },
  });
  assert.deepEqual(applied, {});
});

test("external storage identity changes invalidate outstanding account contexts", async () => {
  const s = storage(),
    client = make(async () => json(token("a", 5000)), s);
  await client.signIn("a", "password");
  const old = client.context()!;
  s.removeItem(SESSION_KEY);
  client.storageChanged();
  assert.equal(client.isCurrent(old), false);
});

test("a same-user refresh from another window preserves account scope", async () => {
  const s = storage(),
    client = make(async () => json(token("a", 5000)), s);
  await client.signIn("a", "password");
  const context = client.context()!;
  s.setItem(
    SESSION_KEY,
    JSON.stringify({ ...client.read(), accessToken: "new-access", refreshToken: "new-refresh" }),
  );
  client.storageChanged();
  assert.equal(client.isCurrent(context), true);
});

test("session persistence failure rolls back workspace and never emits identity success", async () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", "original");
  let notified = 0;
  const client = createJlSessionClient({
    url: "https://example.test",
    anonKey: "public",
    storage: s,
    fetch: async (_input, init) => json(token(JSON.parse(String(init?.body)).email, 5000)),
    beforeIdentityChange: (a, b) => stageJlWorkspace(s, a?.userId ?? null, b?.userId ?? null),
    onIdentityChange: () => {
      notified++;
    },
  });
  await client.signIn("a", "password");
  const oldSession = s.getItem(SESSION_KEY);
  const save = s.setItem;
  s.setItem = (key, value) => {
    if (key === SESSION_KEY) throw new Error("quota");
    save(key, value);
  };
  await assert.rejects(client.signIn("b", "password"), /could not be saved/);
  assert.equal(notified, 1);
  assert.equal(client.read()?.userId, "a");
  assert.equal(s.getItem(SESSION_KEY), oldSession);
  assert.equal(s.getItem(WORKSPACE_OWNER), "a");
  assert.equal(s.getItem("harbor.profiles.v1"), "original");
  s.setItem = save;
  const remove = s.removeItem;
  s.removeItem = (key) => {
    if (key === SESSION_KEY) throw new Error("storage unavailable");
    remove(key);
  };
  await assert.rejects(client.signOut(), /could not be saved/);
  assert.equal(client.read()?.userId, "a");
  assert.equal(s.getItem(WORKSPACE_OWNER), "a");
  assert.equal(notified, 1);
});

test("reload handoff observes the committed identity and suppresses old provider writes", async () => {
  const s = storage();
  let observed = "",
    notified = false;
  const client = createJlSessionClient({
    url: "https://example.test",
    anonKey: "public",
    storage: s,
    fetch: async () => json(token("a", 5000)),
    beforeIdentityChange: (a, b) => stageJlWorkspace(s, a?.userId ?? null, b?.userId ?? null),
    onIdentityChange: () => {
      observed = client.read()?.userId ?? "local";
      return true;
    },
  });
  client.subscribe(() => {
    notified = true;
  });
  await client.signIn("a", "password");
  assert.equal(observed, "a");
  assert.equal(notified, false);
});
