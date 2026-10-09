import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pinnedPluginBase, pinnedPluginUrl } from "../src/lib/streams/addons.ts";
import { pluginIdFromCatalogueBase } from "../src/lib/streams/plugins/addon.ts";
import { persistableAddonOrigin } from "../src/lib/cinemeta.ts";
import type { Addon } from "../src/lib/addons.ts";

const PLUGIN = "plugin:repo.uhdmovies";
const PROVIDER_BASE = `harbor-plugin://${PLUGIN}/vega`;
const PLUGIN_BASE = `harbor-plugin://${PLUGIN}`;

const addon = (transportUrl: string, id: string): Addon => ({
  manifest: { id, name: id, resources: [], types: [] },
  transportUrl,
});

const pluginAddon = addon(PLUGIN_BASE, PLUGIN);
const otherPlugin = addon("harbor-plugin://plugin:repo.other", "plugin:repo.other");
const repoGrouped = addon("harbor-plugin://repo/abc123", "plugin-repo:abc123");
const httpAddon = addon("https://v3-cinemeta.strem.io/manifest.json", "cinemeta");

test("a row's base resolves to the plugin that listed it", () => {
  assert.equal(pluginIdFromCatalogueBase(PROVIDER_BASE), PLUGIN);
  assert.equal(pluginIdFromCatalogueBase(PLUGIN_BASE), PLUGIN);
  assert.equal(pluginIdFromCatalogueBase("harbor-plugin://repo/abc123"), undefined);
  assert.equal(pluginIdFromCatalogueBase("https://v3-cinemeta.strem.io"), undefined);
  assert.equal(pluginIdFromCatalogueBase("harbor-plugin://"), undefined);
});

test("a provider-level base pins the plugin's own addon", () => {
  const forced = [{ base: PROVIDER_BASE, id: "capstan:vega:abc" }];
  assert.equal(pinnedPluginBase(forced), PROVIDER_BASE);
  assert.equal(
    pinnedPluginUrl(forced, [httpAddon, otherPlugin, pluginAddon]),
    PLUGIN_BASE,
    "the provider part tells rows apart, the match is on the plugin",
  );
});

test("a repository grouping does not answer for one of its plugins", () => {
  const forced = [{ base: PROVIDER_BASE, id: "capstan:vega:abc" }];
  assert.equal(
    pinnedPluginUrl(forced, [httpAddon, repoGrouped]),
    undefined,
    "the pin needs the plugin's own addon in the list, not a group that contains it",
  );
});

test("a catalogue that is no longer here pins nothing", () => {
  const forced = [{ base: PROVIDER_BASE, id: "capstan:vega:abc" }];
  assert.equal(pinnedPluginUrl(forced, [httpAddon]), undefined);
  assert.equal(
    pinnedPluginUrl([{ base: "https://v3-cinemeta.strem.io", id: "tt0137523" }], [
      httpAddon,
      pluginAddon,
      otherPlugin,
    ]),
    undefined,
    "a row from a normal addon leaves every plugin free",
  );
  assert.equal(pinnedPluginUrl(undefined, [pluginAddon]), undefined);
});

test("a saved row keeps the base it is resolved and played through", () => {
  assert.deepEqual(
    persistableAddonOrigin({ id: "k", name: "n", base: PROVIDER_BASE }),
    { id: "k", name: "n", logo: undefined, base: PROVIDER_BASE },
  );
  assert.deepEqual(
    persistableAddonOrigin({ id: "k", name: "n", base: "https://v3-cinemeta.strem.io" }),
    { id: "k", name: "n", logo: undefined, base: "https://v3-cinemeta.strem.io" },
  );
  const without = persistableAddonOrigin({ id: "k", name: "n" });
  assert.ok(without && !("base" in without), "no base stored, none invented");
  assert.equal(persistableAddonOrigin(null), undefined);
});

test("a plugin row carries the catalogue it came from", () => {
  assert.match(
    readFileSync("src/lib/streams/plugins/extension/catalogue.ts", "utf8"),
    /base: extensionCatalogueBase\(cat\.pluginId, cat\.providerId\)/,
    "without its base a saved row cannot name its plugin at play time",
  );
});

test("the pipeline resolves an item's own plugin even where plugins are kept out", () => {
  const input = readFileSync("src/lib/streams/episode-pipeline-input.ts", "utf8");
  assert.match(input, /pluginAddonById\(pinnedId\)/);
  assert.match(
    input,
    /pluginAddonById\(meta\.addonOrigin\.id\)/,
    "a row that kept only its plugin's id still resolves",
  );
  assert.match(
    input,
    /pluginsForAddon\(a\)\.some/,
    "a repository grouping that already covers the plugin is not asked twice",
  );
  assert.match(input, /resolvePinnedPlugin\?: boolean;/);
  assert.match(
    input,
    /resolveAddonRanks\(effectiveAddons/,
    "ranks are computed from the list that is actually queried",
  );
});

test("background work does not resolve an item's plugin", () => {
  assert.match(
    readFileSync("src/lib/auto-download/resolve.ts", "utf8"),
    /resolvePinnedPlugin: false/,
  );
});

test("the picker reads the installed set even while the switch keeps plugins out", () => {
  const pickers = readFileSync("src/views/play-picker/use-addons.ts", "utf8");
  const loadAt = pickers.indexOf("await loadStreamPlugins();");
  const gateAt = pickers.indexOf("settings.pluginsOutsideTab");
  assert.ok(loadAt >= 0 && gateAt > loadAt, "the store loads before the switch is consulted");
});
