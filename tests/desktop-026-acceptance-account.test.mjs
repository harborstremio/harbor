import { test } from "node:test";
import assert from "node:assert/strict";
import { deferred, loadSource, memoryStorage } from "./desktop-026-acceptance-fixtures.mjs";

test("026 workspace round trip isolates accounts while preserving original profile and configured addon bytes", () => {
  const { switchJlWorkspace } = loadSource("lib/jl/account/workspace.ts");
  const rosterA = JSON.stringify({
    activeId: "stable-a",
    profiles: [{ id: "stable-a", name: "Same name", isPrimary: true }],
  });
  const rosterB = JSON.stringify({
    activeId: "stable-b",
    profiles: [{ id: "stable-b", name: "Same name", isPrimary: true }],
  });
  const configured =
    '[{"id":"fixture","transportUrl":"https://fixture.invalid/CaseSensitive/manifest.json?config=EXAMPLE"}]';
  const storage = memoryStorage({
    "harbor.profiles.v1": rosterA,
    "harbor.installed-addons.stable-a": configured,
    "harbor.installed-addons": configured,
  });
  switchJlWorkspace(storage, null, "account-a");
  switchJlWorkspace(storage, "account-a", "account-b");
  assert.equal(storage.getItem("harbor.profiles.v1"), null);
  assert.equal(storage.getItem("harbor.installed-addons"), null);
  storage.setItem("harbor.profiles.v1", rosterB);
  switchJlWorkspace(storage, "account-b", "account-a");
  assert.equal(storage.getItem("harbor.profiles.v1"), rosterA);
  assert.equal(storage.getItem("harbor.installed-addons.stable-a"), configured);
  switchJlWorkspace(storage, "account-a", null);
  assert.equal(
    storage.getItem("harbor.profiles.v1"),
    null,
    "sign-out must not expose the signed-in roster as local data",
  );
  switchJlWorkspace(storage, null, "account-b");
  assert.equal(storage.getItem("harbor.profiles.v1"), rosterB);
});

test("026 profile document CAS retries preserve simultaneous independent edits and abort stale account application", async () => {
  const { syncProfileDocument } = loadSource("lib/jl/account/document-sync.ts");
  let remote = { revision: 1, values: { title: "cloud" } },
    tries = 0,
    applied;
  await syncProfileDocument({
    assertCurrent() {},
    readLocal: () => ({ favorite: true }),
    readBase: () => ({}),
    apply: (value) => {
      applied = value;
    },
    checkpoint() {},
    conflicts() {},
    pull: async () => remote,
    compareAndSwap: async (_before, next) => {
      if (++tries === 1) {
        remote = { revision: 2, values: { title: "cloud", secondDevice: true } };
        return false;
      }
      assert.equal(next.secondDevice, true);
      return true;
    },
  });
  assert.deepEqual(applied, { favorite: true, title: "cloud", secondDevice: true });
  const pull = deferred();
  let current = true,
    writes = 0;
  const pending = syncProfileDocument({
    assertCurrent() {
      if (!current) throw new Error("scope changed");
    },
    readLocal: () => ({}),
    readBase: () => ({}),
    apply() {
      writes++;
    },
    checkpoint() {
      writes++;
    },
    conflicts() {
      writes++;
    },
    pull: () => pull.promise,
    compareAndSwap: async () => {
      writes++;
      return true;
    },
  });
  current = false;
  pull.resolve({ revision: 1, values: { anotherAccount: true } });
  await assert.rejects(pending, /scope changed/);
  assert.equal(writes, 0);
});

test("026 profile apply preserves newer local edits, configured URLs and rolls back partial storage writes", () => {
  const document = loadSource("lib/jl/account/document-sync.ts");
  const data = loadSource("lib/jl/account/profile-data.ts", { "./document-sync.ts": document });
  const addon =
    '[{"id":"same-addon","transportUrl":"https://fixture.invalid/config-secret/manifest.json"}]';
  const storage = memoryStorage({
    "harbor.favorites.v1.p":
      '[{"id":"movie-a","name":"Original","poster":"https://fixture.invalid/poster.jpg"}]',
    "harbor.installed-addons.p": addon,
  });
  const expected = data.readProfileData(storage, "p", {});
  storage.setItem(
    "harbor.favorites.v1.p",
    '[{"id":"movie-a","name":"New local edit","poster":"https://fixture.invalid/poster.jpg"}]',
  );
  data.applyProfileData(
    storage,
    "p",
    { ...expected, "favorites:movie-a": { id: "movie-a", name: "Cloud edit" } },
    expected,
    {},
  );
  assert.equal(JSON.parse(storage.getItem("harbor.favorites.v1.p"))[0].name, "New local edit");
  assert.equal(
    JSON.parse(storage.getItem("harbor.favorites.v1.p"))[0].poster,
    "https://fixture.invalid/poster.jpg",
  );
  assert.equal(storage.getItem("harbor.installed-addons.p"), addon);
  const before = new Map(storage.values);
  storage.failOnce("harbor.localcw.v1.p");
  assert.throws(
    () => data.applyProfileData(storage, "p", {}, data.readProfileData(storage, "p", {}), {}),
    /quota/,
  );
  assert.deepEqual(
    storage.values,
    before,
    "failed save must restore absent keys as well as original values",
  );
});

test("026 refresh completion after sign-out cannot revive a previous session", async () => {
  const { createJlSessionClient, SESSION_KEY } = loadSource("lib/jl/account/session-client.ts");
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({
      accessToken: "fixture-old",
      refreshToken: "fixture-refresh",
      userId: "a",
      email: null,
      expiresAt: 1,
    }),
  });
  const response = deferred();
  const client = createJlSessionClient({
    url: "https://fixture.invalid",
    anonKey: "fixture-public",
    storage,
    fetch: async (url) =>
      String(url).includes("/token?") ? response.promise : new Response(null, { status: 204 }),
  });
  const refreshing = client.fresh();
  await client.signOut();
  response.resolve(
    Response.json({
      access_token: "fixture-new",
      refresh_token: "fixture-rotated",
      expires_in: 3600,
      user: { id: "a" },
    }),
  );
  assert.equal(await refreshing, null);
  assert.equal(client.read(), null);
  assert.equal(storage.getItem(SESSION_KEY), null);
});

test("026 addon selections preserve differently enabled configurations sharing a manifest ID", () => {
  const document = loadSource("lib/jl/account/document-sync.ts");
  const data = loadSource("lib/jl/account/profile-data.ts", { "./document-sync.ts": document });
  const first = "https://fixture.invalid/ConfigA/manifest.json?key=exampleA";
  const second = "https://fixture.invalid/ConfigB/manifest.json?key=exampleB";
  const configured = JSON.stringify([
    { id: "same-id", transportUrl: first },
    { id: "same-id", transportUrl: second },
  ]);
  const storage = memoryStorage({
    "harbor.installed-addons.p": configured,
    "harbor.addons.disabled.p": JSON.stringify([second]),
  });
  const snapshot = data.readProfileData(storage, "p", {});
  assert.doesNotMatch(
    JSON.stringify(snapshot),
    /exampleA|exampleB|fixture\.invalid/,
    "configured URLs stay local",
  );
  data.applyProfileData(storage, "p", snapshot, snapshot, {});
  assert.equal(storage.getItem("harbor.installed-addons.p"), configured);
  assert.deepEqual(JSON.parse(storage.getItem("harbor.addons.disabled.p")), [second]);
});

test("026 stable profile links never attach another owner or infer identity from a matching name", () => {
  const { createJlLinkStore } = loadSource("lib/jl/account/profile-links.ts");
  const storage = memoryStorage(),
    links = createJlLinkStore(storage);
  links.write("local-profile", {
    accountId: "owner-a",
    profileId: "uuid-a",
    name: "Same name",
    merged: true,
    status: "linked",
  });
  assert.equal(links.link("local-profile", "owner-b"), null);
  assert.equal(links.canAutoCreate("local-profile", "owner-b"), false);
  assert.equal(links.link("local-profile", "owner-a").profileId, "uuid-a");
  storage.setItem(
    "jl.account.link.v1.legacy",
    JSON.stringify({ profileId: "uuid-without-owner", name: "Same name" }),
  );
  assert.equal(links.link("legacy", "owner-a"), null);
  assert.equal(links.canAutoCreate("legacy", "owner-a"), false);
  storage.failOnce("jl.account.link.v2.new");
  assert.throws(
    () =>
      links.write(
        "new",
        {
          accountId: "owner-a",
          profileId: "proposed-uuid",
          name: "New",
          merged: false,
          status: "pending",
        },
        true,
      ),
    /quota/,
  );
  assert.equal(links.read("new"), null, "unsaved proposed UUID must not appear durable");
});

test("026 session persistence failure rolls back the workspace before any identity notification or reload", async () => {
  const sessionModule = loadSource("lib/jl/account/session-client.ts");
  const workspace = loadSource("lib/jl/account/workspace.ts");
  for (const action of ["switch", "sign-out"]) {
    const roster = '{"activeId":"profile-a","profiles":[{"id":"profile-a","isPrimary":true}]}';
    const originalSession = JSON.stringify({
      userId: "account-a",
      accessToken: "fixture-a",
      refreshToken: "fixture-refresh-a",
      expiresAt: 9999999999,
      email: null,
    });
    const storage = memoryStorage({
      [sessionModule.SESSION_KEY]: originalSession,
      [workspace.WORKSPACE_OWNER]: "account-a",
      "harbor.profiles.v1": roster,
    });
    let notifications = 0;
    const client = sessionModule.createJlSessionClient({
      url: "https://fixture.invalid",
      anonKey: "fixture-public",
      storage,
      fetch: async () =>
        Response.json({
          access_token: "fixture-b",
          refresh_token: "fixture-refresh-b",
          expires_in: 3600,
          user: { id: "account-b" },
        }),
      beforeIdentityChange: (previous, next) =>
        workspace.stageJlWorkspace(storage, previous?.userId ?? null, next?.userId ?? null),
      onIdentityChange() {
        notifications++;
      },
    });
    assert.equal(client.read().userId, "account-a");
    storage.failOnce(sessionModule.SESSION_KEY);
    await assert.rejects(
      action === "switch"
        ? client.signIn("fixture@example.invalid", "not-a-real-password")
        : client.signOut(),
      /could not be saved/,
    );
    assert.equal(notifications, 0);
    assert.equal(client.read().userId, "account-a");
    assert.equal(storage.getItem(sessionModule.SESSION_KEY), originalSession);
    assert.equal(storage.getItem(workspace.WORKSPACE_OWNER), "account-a");
    assert.equal(storage.getItem("harbor.profiles.v1"), roster);
  }
});

test("026 upgrade never reclassifies a known previous account roster as anonymous local data", () => {
  const { switchJlWorkspace } = loadSource("lib/jl/account/workspace.ts");
  const roster =
    '{"activeId":"previous-account-profile","profiles":[{"id":"previous-account-profile","isPrimary":true}]}';
  const storage = memoryStorage({
    "harbor.profiles.v1": roster,
    "jl.account.keys.owner.v1": "previous-account",
  });
  switchJlWorkspace(storage, null, "different-account");
  assert.notEqual(storage.getItem("harbor.profiles.v1"), roster);
  switchJlWorkspace(storage, "different-account", null);
  assert.notEqual(
    storage.getItem("harbor.profiles.v1"),
    roster,
    "sign-out must not restore a previous known account as anonymous data",
  );
  assert.ok(
    [...storage.values.values()].some((value) => value.includes("previous-account-profile")),
    "original data stays recoverable",
  );
});

test("026 actual client cold startup reconciles legacy ownership before returning a saved identity", () => {
  const session = loadSource("lib/jl/account/session-client.ts"),
    workspace = loadSource("lib/jl/account/workspace.ts");
  const roster =
    '{"activeId":"a-private-profile","profiles":[{"id":"a-private-profile","isPrimary":true}]}';
  const storage = memoryStorage({
    "harbor.profiles.v1": roster,
    "jl.account.keys.owner.v1": "account-a",
    [session.SESSION_KEY]: JSON.stringify({
      userId: "account-b",
      accessToken: "fixture-b",
      refreshToken: "fixture-refresh-b",
      expiresAt: 9999999999,
      email: null,
    }),
  });
  const client = loadSource(
    "lib/jl/account/client.ts",
    {
      react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
      "./session-client": session,
      "./workspace": workspace,
    },
    {
      __buildEnv: {
        VITE_JL_SUPABASE_URL: "https://fixture.invalid",
        VITE_JL_SUPABASE_ANON_KEY: "fixture-public",
      },
      localStorage: storage,
      window: {
        addEventListener() {},
        dispatchEvent() {},
        location: {
          reload() {
            throw new Error("No startup reload expected");
          },
        },
      },
      fetch() {
        throw new Error("Startup must not contact any service");
      },
    },
  );
  assert.equal(client.currentJlSession().userId, "account-b");
  assert.equal(client.useJlWorkspaceError(), null);
  assert.equal(storage.getItem(workspace.WORKSPACE_OWNER), "account-b");
  assert.notEqual(storage.getItem("harbor.profiles.v1"), roster);
  assert.ok(storage.getItem("jl.account.workspace.v1.account-a").includes("a-private-profile"));
});

function backupFixture({ loadBgImage = async () => null } = {}) {
  const profileA = "p_aaa_aaa",
    profileB = "p_bbb_bbb";
  const roster = (id) =>
    JSON.stringify({ activeId: id, profiles: [{ id, name: "Fixture", isPrimary: true }] });
  const storage = memoryStorage({
    "jl.account.workspace.owner.v1": "account-b",
    "jl.account.workspace.v1.account-a": JSON.stringify({ "harbor.profiles.v1": roster(profileA) }),
    "harbor.profiles.v1": roster(profileB),
    [`harbor.installed-addons.${profileA}`]:
      '[{"transportUrl":"https://fixture.invalid/private-A/manifest.json"}]',
    [`harbor.installed-addons.${profileB}`]:
      '[{"transportUrl":"https://fixture.invalid/private-B/manifest.json"}]',
  });
  const secrets = {
    [`harbor.trakt.session.v1.${profileA}`]: "synthetic-A-session",
    [`harbor.trakt.session.v1.${profileB}`]: "synthetic-B-session",
  };
  const calls = { legacySync: 0 };
  const secretPort = {
    getAllSecrets: () => ({ ...secrets }),
    isSecretKey: (key) => key.startsWith("harbor.trakt.session.v1"),
    secretKeyForProfile: (_key, id) => `harbor.trakt.session.v1.${id}`,
    setSecret(key, value) {
      if (value == null) delete secrets[key];
      else secrets[key] = value;
    },
    flushSecrets: async () => {},
  };
  const backup = loadSource(
    "lib/backup.ts",
    {
      "@/lib/download-text": {
        downloadText() {
          throw new Error("Acceptance fixture must not download an export");
        },
      },
      "@/lib/profile-sync/backup-payload": {
        buildSyncBackup: () => {
          calls.legacySync++;
          return { parked: [{ value: "synthetic-private-A-sync" }] };
        },
      },
      "@/lib/theme-storage": { loadBgImage, saveBgImage: async () => {} },
      "@/lib/profiles": {
        readAllProfilesIdentity: () => JSON.parse(storage.getItem("harbor.profiles.v1")).profiles,
      },
      "@/lib/active-profile-id": {
        activeProfileId: () => JSON.parse(storage.getItem("harbor.profiles.v1")).activeId,
      },
      "@/lib/secret-store": secretPort,
      "@/lib/storage-recovery": {
        setItemWithRecovery(key, value) {
          storage.setItem(key, value);
          return true;
        },
      },
      "@/lib/local-library": {
        localLibraryReady: async () => {},
        readLocalLibrary: () => [],
        restoreLocalLibrary() {},
      },
    },
    { localStorage: storage },
  );
  return { backup, storage, secrets, profileA, profileB, calls };
}

test("026 backup export contains the current account profiles and excludes parked account configuration and sessions", async () => {
  const { backup, profileA, profileB } = backupFixture();
  const exported = await backup.buildBackup(["addons", "sessions"]);
  assert.ok(exported.data[`harbor.installed-addons.${profileB}`]);
  assert.equal(exported.data[`harbor.trakt.session.v1.${profileB}`], "synthetic-B-session");
  assert.equal(exported.data[`harbor.installed-addons.${profileA}`], undefined);
  assert.equal(exported.data[`harbor.trakt.session.v1.${profileA}`], undefined);
  assert.doesNotMatch(JSON.stringify(exported), /private-A|synthetic-A-session/);
});

test("026 legacy full backup restore preserves a parked account addon configuration and saved service sessions", async () => {
  const { backup, storage, secrets, profileA, profileB } = backupFixture();
  const parkedAddon = storage.getItem(`harbor.installed-addons.${profileA}`);
  await backup.applyBackup({
    format: "harbor-backup",
    version: 1,
    app: "fixture",
    exportedAt: "",
    data: {
      [`harbor.installed-addons.${profileB}`]: "[]",
      [`harbor.trakt.session.v1.${profileB}`]: "synthetic-B-restored",
    },
  });
  assert.equal(storage.getItem(`harbor.installed-addons.${profileB}`), "[]");
  assert.equal(secrets[`harbor.trakt.session.v1.${profileB}`], "synthetic-B-restored");
  assert.equal(storage.getItem(`harbor.installed-addons.${profileA}`), parkedAddon);
  assert.equal(secrets[`harbor.trakt.session.v1.${profileA}`], "synthetic-A-session");
});

test("026 backup export refuses an identity change while an asynchronous background read is pending", async () => {
  const pending = deferred();
  const { backup, storage } = backupFixture({ loadBgImage: () => pending.promise });
  const exporting = backup.buildBackup(["theme", "addons"]);
  storage.setItem("jl.account.workspace.owner.v1", "account-c");
  storage.setItem(
    "harbor.profiles.v1",
    JSON.stringify({ activeId: "p_ccc_ccc", profiles: [{ id: "p_ccc_ccc" }] }),
  );
  pending.resolve("synthetic-background");
  await assert.rejects(exporting, /account|profile|workspace|changed/i);
});

test("026 selected backup never exports legacy sync transport or parked payloads", async () => {
  const { backup, storage, calls } = backupFixture();
  storage.setItem("harbor.sync.parked.v1", "synthetic-private-A-sync");
  const exported = await backup.buildBackup(["addons"]);
  assert.equal(
    calls.legacySync,
    0,
    "legacy bound-account snapshots must not be read during JL workspace backup",
  );
  assert.equal(exported.sync, undefined);
  assert.doesNotMatch(JSON.stringify(exported), /synthetic-private-A-sync/);
  const full = await backup.buildBackup();
  assert.equal(full.data["harbor.sync.parked.v1"], undefined);
  assert.equal(
    storage.getItem("harbor.sync.parked.v1"),
    "synthetic-private-A-sync",
    "excluded transport data remains preserved on disk",
  );
});

test("026 full backup with profile IDs owned by another account refuses before mutating any saved data", async () => {
  const { backup, storage, secrets, profileA } = backupFixture();
  const before = new Map(storage.values),
    secretBefore = { ...secrets };
  await assert.rejects(
    backup.applyBackup({
      format: "harbor-backup",
      version: 1,
      app: "fixture",
      exportedAt: "",
      data: {
        "harbor.profiles.v1": JSON.stringify({
          activeId: profileA,
          profiles: [{ id: profileA, name: "Colliding import", isPrimary: true }],
        }),
        [`harbor.installed-addons.${profileA}`]: "[]",
      },
    }),
    /account|profile|workspace|belong|collision/i,
  );
  assert.deepEqual(storage.values, before);
  assert.deepEqual(secrets, secretBefore);
});

test("026 portable backups neither expose nor overwrite the device download registry containing several owners", async () => {
  const { backup, storage } = backupFixture();
  const downloads = JSON.stringify([
    {
      id: "download-a",
      owner: '["account-a","p_aaa_aaa"]',
      url: "https://fixture.invalid/private-A-download",
      path: "C:\\offline\\A.mp4",
    },
  ]);
  storage.setItem("harbor.downloads.v1", downloads);
  storage.setItem("harbor.music.downloads.v1", downloads);
  const exported = await backup.buildBackup();
  assert.doesNotMatch(JSON.stringify(exported), /private-A-download/);
  await backup.applyBackup({
    format: "harbor-backup",
    version: 1,
    app: "fixture",
    exportedAt: "",
    data: {
      "harbor.downloads.v1": "[]",
      "harbor.music.downloads.v1": "[]",
    },
  });
  assert.equal(storage.getItem("harbor.downloads.v1"), downloads);
  assert.equal(storage.getItem("harbor.music.downloads.v1"), downloads);
});

test("026 full roster restore accepts an unselected profile and preserves separate service sessions for each restored identity", async () => {
  const { backup, storage, secrets, profileA } = backupFixture();
  const first = "p_ccc_ccc",
    second = "p_ddd_ddd";
  const roster = JSON.stringify({
    activeId: null,
    profiles: [
      { id: first, name: "First", isPrimary: true },
      { id: second, name: "Second" },
    ],
  });
  await backup.applyBackup({
    format: "harbor-backup",
    version: 1,
    app: "fixture",
    exportedAt: "",
    sections: ["profiles", "sessions"],
    data: {
      "harbor.profiles.v1": roster,
      [`harbor.trakt.session.v1.${first}`]: "synthetic-C-session",
      [`harbor.trakt.session.v1.${second}`]: "synthetic-D-session",
    },
  });
  assert.equal(storage.getItem("harbor.profiles.v1"), roster);
  assert.equal(secrets[`harbor.trakt.session.v1.${first}`], "synthetic-C-session");
  assert.equal(secrets[`harbor.trakt.session.v1.${second}`], "synthetic-D-session");
  assert.equal(secrets[`harbor.trakt.session.v1.${profileA}`], "synthetic-A-session");
});
