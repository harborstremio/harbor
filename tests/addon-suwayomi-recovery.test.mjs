import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, dependencies, globals = {}) {
  const compiled = ts.transpileModule(
    readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), compiled)(
    (id) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}
const local = load("src/lib/local-network.ts", {});
function addonsHarness(response) {
  const calls = [];
  const fetcher = (kind) => async (url) => {
    calls.push({ kind, url });
    return response(url);
  };
  const shared = {
    "@/lib/safe-fetch": { safeFetch: fetcher("guarded"), safeFetchLocal: fetcher("local") },
    "@/lib/local-network": local,
  };
  const store = load("src/lib/addon-store.ts", {
    ...shared,
    "./auth": {},
    "./addons": {},
    "./addons-store/reorder": {},
  });
  const streams = load(
    "src/lib/streams/addons.ts",
    {
      ...shared,
      "@/lib/debug": { dlog() {}, dwarn() {} },
      "@/lib/fetch-fallback-policy": { isHarborFetchPolicyError: () => false },
      "./addon-detect": { isAddonRanked: () => false, isStatusOnlyAddon: () => false },
      "./cached": { hasUncachedMarker: () => false },
      "@/lib/torrent/magnet": {},
      "./plugins/addon": { isPluginAddon: () => false, PLUGIN_ADDON_PREFIX: "plugin:" },
    },
    { console: { info() {} } },
  );
  const addon = (base) => ({
    transportUrl: `${base}/manifest.json`,
    manifest: { id: base, name: "Fixture", resources: ["stream"], types: ["movie"] },
  });
  return { ...store, ...streams, addon, calls };
}

test("installed local manifests and streams use the local bridge; public add-ons stay guarded", async () => {
  const h = addonsHarness(
    async (url) =>
      new Response(
        JSON.stringify(
          url.endsWith("manifest.json")
            ? { id: "fixture", name: "Fixture" }
            : { streams: [{ url: "https://media.example/video" }] },
        ),
      ),
  );
  for (const [base, kind] of [
    ["http://127.0.0.1:11470", "local"],
    ["http://[::1]:11470", "local"],
    ["https://public.example", "guarded"],
  ]) {
    assert.equal((await h.fetchManifestAt(`${base}/manifest.json`)).name, "Fixture");
    assert.equal(
      (
        await h.fetchAddonStreams(
          [h.addon(base)],
          { type: "movie", ids: ["tt1"] },
          new AbortController().signal,
        )
      ).length,
      1,
    );
    assert.deepEqual(
      h.calls.slice(-2).map((c) => c.kind),
      [kind, kind],
    );
  }
});

for (const [reason, response, code] of [
  ["empty success", () => new Response('{"streams":[]}'), undefined],
  ["HTTP failure", () => new Response("unavailable", { status: 503 }), "http"],
  [
    "policy refusal",
    () => {
      throw new Error("blocked internal target");
    },
    "blocked",
  ],
  [
    "connection failure",
    () => {
      throw new Error("connection refused");
    },
    "unreachable",
  ],
]) {
  test(`add-on progress distinguishes ${reason}`, async () => {
    const h = addonsHarness(response),
      progress = [];
    const streams = await h.fetchAddonStreams(
      [h.addon("https://fixture.example")],
      { type: "movie", ids: ["tt1"] },
      new AbortController().signal,
      undefined,
      (p) => progress.push(p),
    );
    assert.equal(streams.length, 0);
    assert.equal(progress.at(-1).failures?.[0]?.code, code);
    assert.equal(progress.at(-1).settled, 1);
  });
}

test("manifest validation still rejects failed HTTP, malformed JSON and missing identity", async () => {
  for (const [response, error] of [
    [new Response("", { status: 503 }), /HTTP 503/],
    [new Response("invalid"), /valid JSON/],
    [new Response('{"name":"Fixture"}'), /missing an `id`/],
  ]) {
    await assert.rejects(
      addonsHarness(() => response).fetchManifestAt("http://localhost/manifest.json"),
      error,
    );
  }
});

const graphql = load("src/lib/manga/sources/suwayomi/graphql.ts", {
  "./model": {},
  "./server-message": load("src/lib/manga/sources/suwayomi/server-message.ts", {}),
});

test("Suwayomi preserves an explicit mutation refusal without retrying another transport", async () => {
  let retries = 0,
    writes = 0;
  const client = {
    server: { base: "http://fixture" },
    postJson: async () => {
      writes++;
      return {
        errors: [
          {
            message:
              "Exception while fetching data (/updateExtension) : Reinstall the extension instead.\n at fake.Stack(line:1)",
          },
        ],
      };
    },
  };
  const transport = load("src/lib/manga/sources/suwayomi/transport.ts", {
    "./model": {},
    "./graphql": graphql,
    "./auth-registry": {},
    "./rest": {
      restSourceListOk: async () => {
        retries++;
        return true;
      },
    },
  });
  transport.setTransport(client.server.base, "graphql");
  await assert.rejects(
    transport.withTransportFallback(client, () => graphql.gqlUpdateExtension(client, "fixture")),
    {
      name: "SuwayomiServerError",
      message: "Reinstall the extension instead.",
    },
  );
  assert.equal(writes, 1);
  assert.equal(retries, 0);
});

test("Suwayomi verifies the mutation result and keeps unavailable-endpoint fallback", async () => {
  for (const [installed, expected] of [
    [true, true],
    [false, false],
  ]) {
    const client = {
      postJson: async () => ({
        data: { updateExtension: { extension: { pkgName: "fixture", isInstalled: installed } } },
      }),
    };
    assert.equal(await graphql.gqlUpdateExtension(client, "fixture"), expected);
  }
  const client = { server: { base: "http://fixture" }, postJson: async () => null };
  const transport = load("src/lib/manga/sources/suwayomi/transport.ts", {
    "./model": {},
    "./graphql": graphql,
    "./auth-registry": {},
    "./rest": { restSourceListOk: async () => true },
  });
  transport.setTransport(client.server.base, "graphql");
  const attempted = [];
  assert.equal(
    await transport.withTransportFallback(client, (kind) => {
      attempted.push(kind);
      return kind === "graphql"
        ? graphql.gqlUpdateExtension(client, "fixture")
        : Promise.resolve(true);
    }),
    true,
  );
  assert.deepEqual(attempted, ["graphql", "rest"]);
});
