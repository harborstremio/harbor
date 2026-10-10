import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRepoUrl,
  parseAndroidExtensionList,
  parseStreamRepoManifest,
  pluginIdFor,
  splitRepoLinks,
} from "../src/lib/streams/plugins/manifest.ts";
import { PluginError } from "../src/lib/streams/plugins/types.ts";

test("github page links become raw manifest links", () => {
  assert.equal(
    normalizeRepoUrl("https://github.com/someone/providers"),
    "https://raw.githubusercontent.com/someone/providers/HEAD/manifest.json",
  );
  assert.equal(
    normalizeRepoUrl("github.com/someone/providers/tree/main/repo"),
    "https://raw.githubusercontent.com/someone/providers/main/repo/manifest.json",
  );
  assert.equal(
    normalizeRepoUrl("https://github.com/someone/providers/blob/dev/repo/manifest.json"),
    "https://raw.githubusercontent.com/someone/providers/dev/repo/manifest.json",
  );
});

test("base links get manifest.json appended and https is required", () => {
  assert.equal(normalizeRepoUrl("https://example.com/repo/"), "https://example.com/repo/manifest.json");
  assert.equal(normalizeRepoUrl("https://example.com/repo.json"), "https://example.com/repo.json");
  assert.equal(normalizeRepoUrl("example.com/repo#x"), "https://example.com/repo/manifest.json");
  assert.throws(() => normalizeRepoUrl("http://example.com/repo"), (e: unknown) => e instanceof PluginError && e.code === "only-https");
});

test("cloudstream repo links are named as android extensions, not as bad urls", () => {
  for (const link of [
    "cloudstreamrepo://raw.githubusercontent.com/self-similarity/MegaRepo/builds/repo.json",
    "CloudStreamRepo://raw.githubusercontent.com/recloudstream/extensions/master/repo.json",
    "  cloudstreamrepo://codeberg.org/cloudstream/x/raw/branch/builds/repo.json  ",
  ])
    assert.throws(
      () => normalizeRepoUrl(link),
      (e: unknown) => e instanceof PluginError && e.code === "android-extensions",
      link,
    );
  assert.throws(
    () => normalizeRepoUrl("cloudstreamrepoextra://example.com/repo.json"),
    (e: unknown) => e instanceof PluginError && e.code === "only-https",
  );
});

test("several pasted links become separate repositories", () => {
  assert.deepEqual(splitRepoLinks("https://a.example/x\nhttps://b.example/y, https://a.example/x"), [
    "https://a.example/x",
    "https://b.example/y",
  ]);
});

test("provider-script manifests map scrapers to entries", () => {
  const parsed = parseStreamRepoManifest(
    {
      name: "Example Repo",
      scrapers: [
        {
          id: "example",
          name: "Example",
          version: "1.0.3",
          filename: "providers/example.js",
          supportedTypes: ["movie", "tv"],
          hasSettings: true,
          contentLanguage: ["en", "it"],
          logo: "https://example.com/logo.png",
          formats: ["hls"],
          limited: true,
        },
        { name: "broken" },
        { id: "off", name: "Off", filename: "off.js", enabled: false, supportedTypes: ["show"] },
      ],
    },
    "https://example.com/repo/manifest.json",
  );
  assert.equal(parsed.format, "provider-script");
  assert.equal(parsed.name, "Example Repo");
  assert.equal(parsed.entries.length, 2);
  const [first, second] = parsed.entries;
  assert.equal(first.entry, "https://example.com/repo/providers/example.js");
  assert.deepEqual(first.types, ["movie", "series"]);
  assert.equal(first.settings, true);
  assert.deepEqual(first.lang, ["en", "it"]);
  assert.equal(first.note, "hls · limited");
  assert.deepEqual(second.types, ["series"]);
  assert.equal(second.enabled, false);
  assert.equal(pluginIdFor("https://example.com/repo/manifest.json", "example").startsWith("plugin:"), true);
});

test("harbor manifests keep their richer fields", () => {
  const parsed = parseStreamRepoManifest(
    {
      name: "Harbor Repo",
      type: "stream",
      homepage: "https://example.com",
      plugins: [
        {
          id: "one",
          name: "One",
          version: "2",
          entry: "one.js",
          sha256: "a".repeat(64),
          hosts: ["Example-Site.to"],
          idPrefixes: ["tt"],
          nsfw: true,
          minHarbor: "0.9.130",
          timeoutMs: 90_000,
        },
      ],
    },
    "https://example.com/harbor/manifest.json",
  );
  assert.equal(parsed.format, "harbor");
  assert.equal(parsed.homepage, "https://example.com");
  const e = parsed.entries[0];
  assert.equal(e.sha256, "a".repeat(64));
  assert.deepEqual(e.hosts, ["example-site.to"]);
  assert.deepEqual(e.idPrefixes, ["tt"]);
  assert.equal(e.nsfw, true);
  assert.equal(e.timeoutMs, 60_000);
});

test("manga repositories and junk are refused with a reason", () => {
  assert.throws(
    () => parseStreamRepoManifest({ name: "x", type: "manga", plugins: [] }, "https://e.com/manifest.json"),
    (e: unknown) => e instanceof PluginError && e.code === "manga-repo",
  );
  assert.throws(
    () => parseStreamRepoManifest([{ name: "a", sourceCodeUrl: "x.js", baseUrl: "https://a" }], "https://e.com/manifest.json"),
    (e: unknown) => e instanceof PluginError && e.code === "manga-repo",
  );
  assert.throws(
    () => parseStreamRepoManifest({ hello: "world" }, "https://e.com/manifest.json"),
    (e: unknown) => e instanceof PluginError && e.code === "not-a-repo",
  );
});

test("an extension repository document hands back its plugin lists", () => {
  const parsed = parseStreamRepoManifest(
    {
      name: "Sample Repo",
      pluginLists: ["https://lists.example/one.json", { url: "two.json" }, "two.json"],
    },
    "https://lists.example/repo.json",
  );
  assert.equal(parsed.format, "android-extension");
  assert.equal(parsed.name, "Sample Repo");
  assert.deepEqual(parsed.entries, []);
  assert.deepEqual(parsed.lists, ["https://lists.example/one.json", "https://lists.example/two.json"]);
});

test("a plugin list maps provider entries onto repository entries", () => {
  const entries = parseAndroidExtensionList(
    [
      {
        status: 1,
        internalName: "Sample",
        name: "Sample Provider",
        version: 25,
        apiVersion: 1,
        language: "hi",
        description: "A provider",
        authors: ["someone", "another"],
        iconUrl: "https://lists.example/icon.png",
        tvTypes: ["Movie", "TvSeries"],
        url: "files/Sample.cs3",
      },
      { status: 0, internalName: "Down", name: "Down", version: 1, tvTypes: ["Anime", "NSFW"], url: "https://cdn.example/Down.cs3" },
      { internalName: "NoFile", name: "No File" },
      { status: 1, internalName: "Sample", name: "Duplicate", url: "files/Other.cs3" },
    ],
    "https://lists.example/lists/plugins.json",
  );
  assert.equal(entries.length, 2);
  const [first, second] = entries;
  assert.equal(first.id, "Sample");
  assert.equal(first.name, "Sample Provider");
  assert.equal(first.version, "25");
  assert.equal(first.entry, "https://lists.example/lists/files/Sample.cs3");
  assert.equal(first.format, "android-extension");
  assert.equal(first.author, "someone, another");
  assert.deepEqual(first.lang, ["hi"]);
  assert.deepEqual(first.types, ["movie", "series"]);
  assert.equal(first.enabled, true);
  assert.equal(first.nsfw, false);
  assert.equal(first.note, undefined);
  assert.equal(second.id, "Down");
  assert.equal(second.enabled, false);
  assert.equal(second.nsfw, true);
  assert.deepEqual(second.types, ["series"]);
  assert.equal(second.note, "down");
});
