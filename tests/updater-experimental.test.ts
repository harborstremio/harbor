// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import * as experimental from "../src/lib/updater/experimental.ts";
import ar from "../src/lib/i18n/locales/ar/experimental-updates.ts";
import pt from "../src/lib/i18n/locales/pt/experimental-updates.ts";
import ru from "../src/lib/i18n/locales/ru/experimental-updates.ts";

type Updater = typeof import("../src/lib/updater/use-update");
type Channels = typeof import("../src/lib/updater/channel");
type BackupModule = typeof import("../src/lib/backup");
type BetaReturn = typeof import("../src/lib/updater/beta-return");
type ExperimentalAccess = typeof import("../src/lib/updater/experimental-access");

// Execute the real store with mocked native boundaries. No network requests,
// installer launches, real storage writes, or existing subtitle-test helpers.
function load<T>(
  path: string,
  mocks: Record<string, unknown>,
  globals: Record<string, unknown>,
): T {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  const require = (name: string) => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected native boundary: ${name}`);
    return mocks[name];
  };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)(
    require,
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports as T;
}

function storage() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

function manifest() {
  return {
    channel: "experimental",
    version: "0.9.123",
    experimentalVersion: "0.0.1",
    buildId: "abc1234",
    notes: "Test fixes",
    platforms: {
      "windows-x86_64": {
        url: "https://example.test/0.9.123/Harbor.exe",
        signature: "signed-test-artifact",
      },
      "darwin-aarch64": {
        url: "https://example.test/0.9.123/Harbor.app.tar.gz",
        signature: "signed-mac-artifact",
      },
    },
    installer: {
      "windows-x86_64": {
        url: "https://example.test/0.9.123/Harbor-installer.exe",
        signature: "signed-test-installer",
        payloadVersion: 9123,
        size: 2048,
        recoveryProtocol: 1,
      },
    },
    returnToBeta: [
      {
        channel: "beta",
        version: "0.9.122",
        platformKey: "windows-x86_64",
        dataCompatible: true,
        recoveryProtocol: 1,
        payloadVersion: 9122,
        size: 1024,
        url: "https://example.test/updates/Harbor_0.9.122_x64-installer.exe",
        signature: "beta-signature",
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function harness(
  options: { beta?: boolean; managed?: boolean; platform?: string; version?: string } = {},
) {
  const localStorage = storage();
  localStorage.setItem("harbor.settings", JSON.stringify({ betaUpdates: !!options.beta }));
  const calls = {
    headers: [] as unknown[],
    fetchHeaders: [] as unknown[],
    fetchUrls: [] as string[],
    nativeFetchUrls: [] as string[],
    download: 0,
    install: 0,
    close: 0,
    stage: 0,
    launch: 0,
    relaunch: 0,
    manual: 0,
    backup: 0,
  };
  const config = {
    access: "allowed" as "allowed" | "denied" | "unavailable",
    writable: true,
    raw: manifest() as unknown,
    status: 200,
    nativeRaw: null as unknown,
    nativeMissing: false,
    nativeWait: null as Promise<void> | null,
    downloadWait: null as Promise<void> | null,
    installPreparation: null as (() => void) | null,
    signatureFailure: false,
    backupFailure: false,
    launchFailure: false,
  };
  const recovery = {
    setItemWithRecovery: (key: string, value: string) => {
      if (!config.writable) return false;
      localStorage.setItem(key, value);
      return true;
    },
  };
  const channel = load<Channels>(
    "src/lib/updater/channel.ts",
    { "@/lib/storage-recovery": recovery },
    { localStorage },
  );
  const betaReturn = load<BetaReturn>(
    "src/lib/updater/beta-return.ts",
    {
      "./experimental": experimental,
      "./channel": channel,
    },
    { localStorage },
  );
  const handle = {
    version: "0.9.123",
    body: "Test fixes",
    get rawJson() {
      return config.nativeRaw ?? config.raw;
    },
    async close() {
      calls.close++;
    },
    async download() {
      calls.download++;
      if (config.downloadWait) await config.downloadWait;
      if (config.signatureFailure) throw new Error("Signature verification failed");
    },
    async install() {
      calls.install++;
    },
  };
  const handoff = {
    async probeHandoff() {
      return {
        supported: !options.platform || options.platform.startsWith("windows"),
        managed: options.managed !== false,
        payloadVersion: 9121,
        installDir: "test",
        platformKey: options.platform ?? "windows-x86_64",
      };
    },
    async readHandoffPlan() {
      return null;
    },
    async stageHandoff() {
      calls.stage++;
      if (config.downloadWait) await config.downloadWait;
      if (config.signatureFailure) throw new Error("Signature verification failed");
    },
    async launchHandoff() {
      calls.launch++;
      if (config.launchFailure) throw new Error("Launch failed");
    },
  };
  const updater = load<Updater>(
    "src/lib/updater/use-update.ts",
    {
      react: { useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() },
      "@tauri-apps/plugin-updater": {
        async check(init: unknown) {
          calls.headers.push(init);
          if (config.nativeWait) await config.nativeWait;
          return config.nativeMissing ? null : handle;
        },
      },
      "@tauri-apps/plugin-http": {
        async fetch(url: string) {
          calls.nativeFetchUrls.push(url);
          if (config.nativeWait) await config.nativeWait;
          return {
            ok: config.status >= 200 && config.status < 300,
            status: config.status,
            async json() {
              return config.raw;
            },
          };
        },
      },
      "@/lib/safe-fetch": {
        async safeFetch(url: string, init: { headers?: unknown }) {
          calls.fetchUrls.push(url);
          calls.fetchHeaders.push(init.headers);
          if (config.nativeWait) await config.nativeWait;
          return {
            ok: config.status >= 200 && config.status < 300,
            status: config.status,
            async json() {
              return config.raw;
            },
          };
        },
      },
      "@/lib/config/endpoints": { HARBOR_API_BASE: "https://example.test" },
      "@/lib/i18n": { t: (s: string) => s },
      "./channel": channel,
      "./experimental": experimental,
      "./experimental-access": {
        currentExperimentalAccess: () => config.access === "allowed",
        subscribeExperimentalAccess: () => () => {},
        verifyExperimentalAccess: async () => config.access,
      },
      "./beta-return": betaReturn,
      "./handoff": handoff,
      "@/lib/backup": { buildBackup: async () => ({ format: "harbor-backup", data: {} }) },
      "@tauri-apps/api/app": {
        async getVersion() {
          return options.version ?? "0.9.121";
        },
      },
      "@tauri-apps/api/core": {
        async invoke(command: string) {
          if (command === "handoff_save_backup") {
            calls.backup++;
            if (config.backupFailure) throw new Error("Backup failed");
          }
          config.installPreparation?.();
        },
      },
      "@tauri-apps/plugin-process": {
        async relaunch() {
          calls.relaunch++;
        },
      },
      "@/lib/window": {
        openUrl() {
          calls.manual++;
        },
      },
    },
    {
      localStorage,
      window: { __TAURI_INTERNALS__: {}, addEventListener() {}, setInterval() {} },
      fetch: async (url: string, init: { headers?: unknown }) => {
        calls.fetchUrls.push(url);
        calls.fetchHeaders.push(init.headers);
        if (url.includes("/experimental/")) throw new TypeError("CORS blocked immutable history");
        if (config.nativeWait) await config.nativeWait;
        return {
          ok: config.status >= 200 && config.status < 300,
          status: config.status,
          async json() {
            return config.raw;
          },
        };
      },
      AbortSignal: {}, // Older supported WebViews have no AbortSignal.timeout.
      setTimeout: (fn: () => void, ms: number) => {
        if (ms === 600) fn();
        return 0;
      },
    },
  );
  return { updater, channel, betaReturn, localStorage, recovery, config, calls };
}

test("experimental access recognizes only the approved Harbor account badges", () => {
  let author: { badges?: Array<{ name: string }> } | null = null;
  const access = load<ExperimentalAccess>(
    "src/lib/updater/experimental-access.ts",
    {
      react: { useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() },
      "@/lib/account/client": { getJson: async () => ({ user: author }) },
      "@/lib/theme-auth": {
        applyServerUser() {},
        currentAuthor: () => author,
        subscribeAuthor: () => () => {},
      },
    },
    {},
  );

  for (const name of ["tester", "moderator", "admin", "dev", " Dev "]) {
    assert.equal(access.hasExperimentalAccess({ badges: [{ name }] } as never), true);
  }
  for (const name of ["beta", "contri", "developer", "hod", "verified", ""]) {
    assert.equal(access.hasExperimentalAccess({ badges: [{ name }] } as never), false);
  }
  assert.equal(access.hasExperimentalAccess(null), false);
  assert.equal(access.currentExperimentalAccess(), false);
  author = { badges: [{ name: "tester" }] };
  assert.equal(access.currentExperimentalAccess(), true);
});

test("experimental enrollment, checks, and installation fail closed without badge access", async () => {
  const h = harness();
  h.config.access = "denied";
  assert.equal(h.updater.setExperimentalUpdates(true), false);
  assert.equal(h.channel.selectedUpdateChannel(), "stable");

  h.config.access = "allowed";
  assert.equal(h.updater.setExperimentalUpdates(true), true);
  h.config.access = "unavailable";
  await h.updater.checkForUpdate(true);
  assert.equal(h.updater.useUpdate().status, "error");
  assert.equal(h.calls.fetchUrls.length, 0);
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");

  h.config.access = "allowed";
  await h.updater.checkForUpdate(true);
  await h.updater.downloadUpdate();
  h.config.access = "denied";
  await h.updater.installUpdate();
  assert.equal(h.calls.launch, 0);
  assert.equal(h.channel.selectedUpdateChannel(), "stable");
  assert.equal(h.updater.useUpdate().channel, "stable");
});

test("existing stable and beta preferences retain their native request headers", async () => {
  for (const beta of [false, true]) {
    const h = harness({ beta });
    await h.updater.checkForUpdate();
    assert.deepEqual(h.calls.headers, [
      beta ? { headers: { "x-harbor-channel": "beta" } } : undefined,
    ]);
    assert.equal(h.updater.useUpdate().channel, beta ? "beta" : "stable");
  }
});

test("consent is durable, restores the previous normal channel, and fails closed on storage failure", () => {
  const h = harness({ beta: true });
  assert.equal(h.channel.selectedUpdateChannel(), "beta");
  assert.ok(h.updater.setExperimentalUpdates(true));
  h.localStorage.setItem("harbor.settings", '{"betaUpdates":false}');
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");
  assert.ok(h.updater.setExperimentalUpdates(false));
  assert.equal(h.channel.selectedUpdateChannel(), "beta");
  h.config.writable = false;
  assert.equal(h.updater.setExperimentalUpdates(true), false);
  assert.equal(h.channel.selectedUpdateChannel(), "beta");
  for (const value of [
    "not-json",
    "{}",
    '{"channel":"preview","normal":"beta"}',
    '{"channel":"stable","normal":"beta"}',
  ]) {
    assert.equal(h.channel.parseChannelPreference(value), null);
  }
});

test("explicit stable exit never invokes the legacy inferred-beta fallback", async () => {
  const h = harness();
  h.updater.setExperimentalUpdates(true);
  h.updater.setExperimentalUpdates(false);
  h.config.nativeMissing = true;
  await h.updater.checkForUpdate();
  assert.deepEqual(h.calls.headers, [undefined]);
  assert.equal(h.calls.fetchHeaders.length, 0);
});

test("legacy prerelease inference still checks beta when no explicit channel exists", async () => {
  const h = harness();
  h.config.nativeMissing = true;
  h.config.raw = { version: "0.9.20" };
  await h.updater.checkForUpdate();
  assert.deepEqual(h.calls.headers, [undefined, { headers: { "x-harbor-channel": "beta" } }]);
});

test("background checks keep a verified download ready until install or channel change", async () => {
  const h = harness();
  h.updater.setExperimentalUpdates(true);
  await h.updater.checkForUpdate();
  await h.updater.downloadUpdate();
  await h.updater.checkForUpdate();
  assert.equal(h.updater.useUpdate().status, "downloaded");
  assert.equal(h.calls.headers.length, 0);
  await h.updater.installUpdate();
  assert.equal(h.calls.launch, 1);
});

test("experimental rejects stable fallback, empty feed, missing platforms and malformed metadata", async () => {
  const invalid: unknown[] = [
    null,
    { version: "0.9.123", platforms: manifest().platforms },
    { ...manifest(), channel: "beta" },
    { ...manifest(), buildId: "" },
    { ...manifest(), experimentalVersion: "0.0.0" },
    { ...manifest(), experimentalVersion: "1.0.0" },
    { ...manifest(), version: "0.9.123-exp.2" },
    { ...manifest(), platforms: {} },
    { ...manifest(), installer: [] },
    { ...manifest(), url: "https://example.test/other.exe" },
  ];
  for (const raw of invalid) {
    const h = harness();
    h.updater.setExperimentalUpdates(true);
    h.config.raw = raw;
    await h.updater.checkForUpdate(true);
    await h.updater.downloadUpdate();
    await h.updater.installUpdate();
    assert.equal(h.updater.useUpdate().status, "unavailable");
    assert.equal(h.calls.headers.length, 0);
    assert.equal(h.calls.install + h.calls.launch + h.calls.download + h.calls.stage, 0);
  }
  for (const status of [204, 404, 503]) {
    const h = harness();
    h.updater.setExperimentalUpdates(true);
    h.config.status = status;
    await h.updater.checkForUpdate();
    assert.equal(h.updater.useUpdate().status, "unavailable");
  }
});

test("manifest validation uses exact architecture, HTTPS, signatures and unchanged installer version formula", () => {
  const valid = manifest();
  assert.ok(experimental.parseExperimentalRelease(valid, "darwin-aarch64"));
  assert.equal(
    experimental.parseExperimentalRelease({ ...valid, withdrawn: true }, "windows-x86_64"),
    null,
  );
  for (const platform of ["darwin-x86_64", "linux-x86_64", "android-aarch64"]) {
    assert.equal(experimental.parseExperimentalRelease(valid, platform), null);
  }
  for (const url of [
    "http://example.test/file.exe",
    "https://user:secret@example.test/file.exe",
    "https://example.test/file.exe#fragment",
    "not-a-url",
  ]) {
    const bad = manifest();
    bad.platforms["windows-x86_64"].url = url;
    assert.equal(experimental.parseExperimentalRelease(bad, "windows-x86_64"), null);
  }
  const unsigned = manifest();
  unsigned.platforms["windows-x86_64"].signature = " ";
  assert.equal(experimental.parseExperimentalRelease(unsigned, "windows-x86_64"), null);
  const wrongPayload = manifest();
  wrongPayload.installer["windows-x86_64"].payloadVersion++;
  assert.equal(experimental.parseExperimentalRelease(wrongPayload, "windows-x86_64"), null);
  assert.equal(experimental.experimentalPayloadVersion("0.9.123"), 9123);
  assert.equal(experimental.experimentalPayloadVersion("0.999.1"), 999001);
  assert.equal(experimental.experimentalChannelVersion("0.0.1"), 1);
  for (const version of ["0.1000.1", "0.9.1000", "0.09.123", "0.9.123-beta", "0.9.123.1"]) {
    assert.equal(experimental.experimentalPayloadVersion(version), null);
  }
});

test("legacy NSIS Windows bootstraps through only the verified recoverable installer", async () => {
  const h = harness({ managed: false });
  h.updater.setExperimentalUpdates(true);
  await h.updater.checkForUpdate(true);
  assert.ok(h.updater.useUpdate().handoff?.verifiable);
  assert.deepEqual(h.calls.headers, []);
  assert.deepEqual(h.calls.fetchHeaders, [undefined]);
  assert.ok(h.calls.fetchUrls[0].endsWith("/updates/latest-experimental.json"));
  await h.updater.downloadUpdate();
  await h.updater.installUpdate();
  assert.equal(h.calls.stage, 1);
  assert.equal(h.calls.backup, 1);
  assert.equal(h.calls.launch, 1);
  assert.equal(h.calls.download + h.calls.install, 0);
});

test("unsupported platforms and missing return approval cannot install experimental", async () => {
  const mac = harness({ platform: "darwin-aarch64", managed: false });
  mac.updater.setExperimentalUpdates(true);
  await mac.updater.checkForUpdate(true);
  assert.equal(mac.updater.useUpdate().status, "unavailable");
  await mac.updater.downloadUpdate();
  await mac.updater.installUpdate();
  assert.equal(mac.calls.install + mac.calls.launch, 0);

  const h = harness();
  h.updater.setExperimentalUpdates(true);
  h.config.raw = { ...manifest(), returnToBeta: [] };
  await h.updater.checkForUpdate();
  assert.equal(h.updater.useUpdate().status, "unavailable");
  assert.equal(h.calls.install + h.calls.launch, 0);
});

test("managed Windows uses only its verified installer, never the legacy NSIS fallback", async () => {
  const h = harness({ managed: true });
  h.updater.setExperimentalUpdates(true);
  await h.updater.checkForUpdate();
  assert.ok(h.updater.useUpdate().handoff?.verifiable);
  assert.equal(h.calls.headers.length, 0);
  await h.updater.downloadUpdate();
  await h.updater.installUpdate();
  assert.equal(h.calls.stage, 1);
  assert.equal(h.calls.launch, 1);
  assert.equal(h.calls.install, 0);
  const missing = harness({ managed: true });
  missing.updater.setExperimentalUpdates(true);
  missing.config.raw = { ...manifest(), installer: {} };
  await missing.updater.checkForUpdate();
  assert.equal(missing.updater.useUpdate().status, "unavailable");
  assert.equal(missing.calls.headers.length, 0);
});

test("signature rejection and unsupported paths never permit an experimental install bypass", async () => {
  for (const managed of [false, true]) {
    const h = harness({ managed });
    h.updater.setExperimentalUpdates(true);
    await h.updater.checkForUpdate();
    h.config.signatureFailure = true;
    await h.updater.downloadUpdate();
    assert.equal(h.updater.useUpdate().status, "error");
    await h.updater.installUpdate();
    await h.updater.openManualDownload();
    await h.updater.openHandoffDownload();
    assert.equal(h.calls.install + h.calls.launch + h.calls.manual, 0);
  }
});

test("same or older experimental builds are not offered as downgrades", async () => {
  for (const version of ["0.9.123", "0.9.124"]) {
    const h = harness({ version });
    h.updater.setExperimentalUpdates(true);
    await h.updater.checkForUpdate();
    assert.equal(h.updater.useUpdate().status, "uptodate");
    assert.equal(h.calls.headers.length, 0);
  }
});

test("switching channels invalidates a late experimental manifest check", async () => {
  const h = harness();
  h.updater.setExperimentalUpdates(true);
  const wait = deferred<void>();
  h.config.nativeWait = wait.promise;
  const check = h.updater.checkForUpdate();
  while (!h.calls.fetchUrls.length) await Promise.resolve();
  assert.ok(h.updater.setExperimentalUpdates(false));
  wait.resolve();
  await check;
  assert.equal(h.updater.useUpdate().status, "idle");
  assert.equal(h.updater.useUpdate().channel, "stable");
  assert.equal(h.calls.launch, 0);
});

test("channel changes are blocked during verification; external changes invalidate download completion", async () => {
  for (const managed of [false, true]) {
    const h = harness({ managed });
    if (managed) h.updater.setExperimentalUpdates(true);
    await h.updater.checkForUpdate();
    const wait = deferred<void>();
    h.config.downloadWait = wait.promise;
    const download = h.updater.downloadUpdate();
    while (h.calls.stage + h.calls.download === 0) await Promise.resolve();
    assert.equal(h.updater.setExperimentalUpdates(false), false);
    assert.equal(h.channel.selectedUpdateChannel(), managed ? "experimental" : "stable");
    h.channel.writeUpdateChannel(managed ? "stable" : "beta");
    wait.resolve();
    await download;
    await h.updater.installUpdate();
    assert.equal(h.updater.useUpdate().status, "idle");
    assert.equal(h.calls.install + h.calls.launch, 0);
  }
});

test("switching after download or during native preparation prevents stale installation", async () => {
  const h = harness();
  h.updater.setExperimentalUpdates(true);
  await h.updater.checkForUpdate();
  await h.updater.downloadUpdate();
  h.config.installPreparation = () => {
    h.channel.writeUpdateChannel("stable");
  };
  await h.updater.installUpdate();
  assert.equal(h.calls.install + h.calls.launch, 0);
  assert.equal(h.updater.useUpdate().status, "error");
  assert.equal(h.localStorage.getItem("harbor.update.pending"), null);
  h.updater.setExperimentalUpdates(true);
  await h.updater.checkForUpdate();
  await h.updater.downloadUpdate();
  h.updater.setExperimentalUpdates(false);
  await h.updater.installUpdate();
  assert.equal(h.calls.install, 0);
});

test("explicit return verifies the exact approved target, backs up, and does not change channels before restart", async () => {
  const h = harness({ version: "0.9.123" });
  h.updater.setExperimentalUpdates(true);
  h.betaReturn.saveBetaReturnContext(
    "0.9.123",
    "0.0.1",
    "abc1234",
    "windows-x86_64",
    manifest().returnToBeta,
  );
  await h.updater.prepareBetaReturn("0.9.122");
  assert.equal(h.updater.useUpdate().intent, "return-beta");
  assert.equal(h.updater.useUpdate().handoff?.version, "0.9.122");
  assert.deepEqual(h.calls.fetchUrls, []);
  assert.deepEqual(h.calls.nativeFetchUrls, [
    "https://example.test/updates/experimental/0.9.123/abc1234/manifest.json",
  ]);
  await h.updater.downloadUpdate();
  await h.updater.installUpdate();
  assert.equal(h.calls.stage, 1);
  assert.equal(h.calls.backup, 1);
  assert.equal(h.calls.launch, 1);
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");
  assert.equal(JSON.parse(h.localStorage.getItem("harbor.update.pending")!).intent, "return-beta");
});

test("failed approval, signature, backup or launch never silently switches to beta", async () => {
  for (const failure of ["approval", "signature", "backup", "launch"]) {
    const h = harness({ version: "0.9.123" });
    h.updater.setExperimentalUpdates(true);
    h.betaReturn.saveBetaReturnContext(
      "0.9.123",
      "0.0.1",
      "abc1234",
      "windows-x86_64",
      manifest().returnToBeta,
    );
    if (failure === "approval") h.config.raw = { ...manifest(), returnToBeta: [] };
    h.config.signatureFailure = failure === "signature";
    h.config.backupFailure = failure === "backup";
    h.config.launchFailure = failure === "launch";
    await h.updater.prepareBetaReturn("0.9.122");
    await h.updater.downloadUpdate();
    await h.updater.installUpdate();
    assert.equal(h.updater.useUpdate().status, "error");
    assert.equal(h.channel.selectedUpdateChannel(), "experimental");
    assert.equal(h.calls.launch, failure === "launch" ? 1 : 0);
  }
});

test("return preferences update all profile mirrors only at the exact beta version and can undo a failed launch", () => {
  const h = harness({ version: "0.9.123" });
  h.updater.setExperimentalUpdates(true);
  h.localStorage.setItem("harbor.settings.shared", '{"betaUpdates":false,"volume":73}');
  h.localStorage.setItem("harbor.settings.profile1", '{"betaUpdates":false,"volume":55}');
  h.localStorage.setItem(
    "harbor.update.pending",
    '{"intent":"return-beta","version":"0.9.122","recoverable":true}',
  );
  h.betaReturn.completeBetaReturnPreferences("0.9.123");
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");
  assert.equal(h.betaReturn.returnedToExactVersion("0.9.123", "0.9.122"), false);
  h.betaReturn.completeBetaReturnPreferences("0.9.122");
  assert.equal(h.channel.selectedUpdateChannel(), "beta");
  assert.deepEqual(JSON.parse(h.localStorage.getItem("harbor.settings.shared")!), {
    betaUpdates: true,
    volume: 73,
  });
  h.localStorage.setItem("harbor.settings.shared", '{"betaUpdates":true,"volume":80}');
  h.betaReturn.completeBetaReturnPreferences("0.9.123");
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");
  assert.deepEqual(JSON.parse(h.localStorage.getItem("harbor.settings.shared")!), {
    betaUpdates: false,
    volume: 80,
  });
});

test("return parsing rejects untested, wrong-channel, duplicate, unsigned and newer targets", () => {
  const h = harness();
  const target = manifest().returnToBeta[0];
  for (const patch of [
    { channel: "stable" },
    { dataCompatible: false },
    { recoveryProtocol: 0 },
    { signature: "" },
    { version: "0.9.124", payloadVersion: 9124 },
    { url: "http://example.test/file.exe" },
    { payloadVersion: 9000 },
  ])
    assert.deepEqual(
      h.betaReturn.parseBetaReturnTargets([{ ...target, ...patch }], "0.9.123", "windows-x86_64"),
      [],
    );
  assert.deepEqual(
    h.betaReturn.parseBetaReturnTargets([target, target], "0.9.123", "windows-x86_64"),
    [],
  );
  assert.deepEqual(h.betaReturn.parseBetaReturnTargets([target], "0.9.123", "darwin-aarch64"), []);
});

test("startup never reports a failed downgrade as success just because experimental is newer", async () => {
  const h = harness({ version: "0.9.123" });
  h.updater.setExperimentalUpdates(true);
  h.localStorage.setItem(
    "harbor.update.pending",
    JSON.stringify({
      intent: "return-beta",
      handoff: true,
      recoverable: true,
      version: "0.9.122",
      payloadVersion: 9122,
    }),
  );
  h.updater.startUpdateWatcher();
  for (let i = 0; i < 30 && h.updater.useUpdate().status !== "error"; i++) await Promise.resolve();
  assert.equal(h.updater.useUpdate().status, "error");
  assert.equal(h.updater.useUpdate().installFailed, true);
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");
  assert.equal(h.calls.headers.length, 0);
});

test("backups neither enroll another device nor erase this device's channel or staged state", async () => {
  const h = harness();
  h.updater.setExperimentalUpdates(true);
  h.localStorage.setItem("harbor.update.pending", "local-pending");
  const empty = {};
  const backup = load<BackupModule>(
    "src/lib/backup.ts",
    {
      "@/lib/download-text": empty,
      "@/lib/profile-sync/backup-payload": { buildSyncBackup: () => ({}) },
      "@/lib/theme-storage": empty,
      "@/lib/profiles": { readAllProfilesIdentity: () => [] },
      "@/lib/active-profile-id": { activeProfileId: () => "local" },
      "@/lib/secret-store": {
        getAllSecrets: () => ({}),
        isSecretKey: () => false,
        flushSecrets: async () => {},
      },
      "@/lib/storage-recovery": h.recovery,
      "@/lib/local-library": {
        localLibraryReady: async () => {},
        readLocalLibrary: () => ({}),
        restoreLocalLibrary() {},
      },
    },
    { localStorage: h.localStorage },
  );
  const exported = await backup.buildBackup();
  assert.ok(!Object.keys(exported.data).some((key) => key.startsWith("harbor.update.")));
  const imported = {
    ...exported,
    sections: undefined,
    data: {
      "harbor.example": "value",
      "harbor.update.pending": "foreign-pending",
      [h.channel.UPDATE_CHANNEL_KEY]: '{"channel":"stable","normal":"stable"}',
    },
  };
  const parsed = backup.parseBackup(JSON.stringify(imported));
  assert.ok(parsed.ok);
  if (parsed.ok) assert.deepEqual(parsed.backup.data, { "harbor.example": "value" });
  await backup.applyBackup(imported);
  assert.equal(h.channel.selectedUpdateChannel(), "experimental");
  assert.equal(h.localStorage.getItem("harbor.update.pending"), "local-pending");
});

test("experimental copy has matching translation keys and interpolation tokens", () => {
  for (const translated of [pt, ru])
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(ar).sort());
  for (const translated of [ar, pt, ru]) {
    for (const [key, value] of Object.entries(translated)) {
      assert.deepEqual(value.match(/\{\w+\}/g)?.sort() ?? [], key.match(/\{\w+\}/g)?.sort() ?? []);
    }
  }
});

test("experimental settings live between updates and backup, with search pointing to that page", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const updates = source("src/views/settings/updates-panel.tsx");
  const advanced = source("src/views/settings/advanced-panel/system-tab.tsx");
  const navigation = source("src/views/settings/nav.tsx");
  const experimentalSection = source("src/views/settings/experimental-builds-section.tsx");
  const placement = updates.indexOf("<ExperimentalBuildsSection />");

  assert.equal(updates.match(/<ExperimentalBuildsSection\s*\/>/g)?.length, 1);
  assert.ok(updates.indexOf('title={t("Updates")}') < placement);
  assert.ok(placement < updates.indexOf('title={t("Backup & restore")}'));
  assert.ok(!advanced.includes("ExperimentalBuildsSection"));
  assert.match(
    navigation,
    /label:\s*"Experimental builds",\s*section:\s*"updates",\s*anchorTitle:\s*"Experimental builds"/,
  );
  assert.ok(!experimentalSection.includes("Open updates & backup"));
  assert.ok(
    !source("src/views/settings/advanced-panel/update-rows.tsx").includes(
      "experimental builds in Advanced",
    ),
  );
});
