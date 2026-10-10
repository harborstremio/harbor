import assert from "node:assert/strict";
import test from "node:test";
import { pinnedPluginBase, pluginQueryId } from "../src/lib/streams/addons.ts";
import { pluginIdPrefixes } from "../src/lib/streams/plugins/addon.ts";
import type { Addon } from "../src/lib/addons.ts";

const CAPSTAN = "capstan:ext/uhdmovies:https%3A%2F%2Fp.example%2Ffight-club%2F:1:1";

/** A plugin's stream addon, as the plugin layer builds it for the stream pipeline. */
const pluginAddon = (idPrefixes: string[]): Addon => ({
  manifest: {
    id: "plugin:ext",
    name: "UHDMovies",
    resources: [{ name: "stream", types: ["movie", "series"], idPrefixes }],
    types: ["movie", "series"],
    idPrefixes,
  },
  transportUrl: "harbor-plugin://plugin:ext",
});

const req = (ids: string[], type = "series") => ({ type, ids });

test("a plugin is asked with the id its own catalogue row was addressed by", () => {
  // The catalogue hands the request the row's id. The plugin's manifest cannot declare that scheme
  // for itself, so without this the id matches nothing and the plugin is skipped before it runs.
  assert.equal(pluginQueryId(pluginAddon(["tt", "tmdb:"]), req([CAPSTAN]), CAPSTAN), CAPSTAN);
  // Which is exactly what used to happen: nothing to ask with.
  assert.equal(pluginQueryId(pluginAddon(["tt", "tmdb:"]), req([CAPSTAN]), undefined), undefined);
});

test("a plugin also answers to its own ids when the repository never declared them", () => {
  const prefixes = pluginIdPrefixes(["tt", "tmdb:"]);
  assert.ok(prefixes.includes("capstan:"));
  assert.deepEqual(prefixes, ["tt", "tmdb:", "capstan:"]);
  // A repository that declares nothing still gets the plugin's own scheme.
  assert.deepEqual(pluginIdPrefixes([]), ["capstan:"]);
  // Declaring it already does not double it up.
  assert.deepEqual(pluginIdPrefixes(["capstan:"]), ["capstan:"]);
  assert.equal(
    pluginQueryId(pluginAddon(prefixes), req([CAPSTAN]), undefined),
    CAPSTAN,
    "the declared prefix has to be enough on its own",
  );
});

test("a row from a plugin's catalogue is asked of that plugin alone", () => {
  const uhdr = "harbor-plugin://plugin:repo.uhdmovies";
  // The catalogue handed the request the listing plugin's base, so the others stand down.
  assert.equal(pinnedPluginBase([{ base: uhdr }]), uhdr);
  assert.equal(
    pinnedPluginBase([
      { base: "https://v3-cinemeta.strem.io" },
      { base: uhdr },
    ]),
    uhdr,
  );
  // A row from a normal addon names no plugin, so every plugin stays free to answer.
  assert.equal(pinnedPluginBase([{ base: "https://v3-cinemeta.strem.io" }]), undefined);
  assert.equal(pinnedPluginBase([]), undefined);
  assert.equal(pinnedPluginBase(undefined), undefined);
});

test("the ids a plugin was always asked with are untouched", () => {
  const addon = pluginAddon(pluginIdPrefixes(["tt", "tmdb:"]));
  assert.equal(pluginQueryId(addon, req(["tt0137523"], "movie"), undefined), "tt0137523");
  assert.equal(pluginQueryId(addon, req(["tmdb:tv:1396"]), undefined), "tmdb:tv:1396");
  // An id the plugin genuinely does not serve is still refused.
  assert.equal(pluginQueryId(addon, req(["kitsu:1"]), undefined), undefined);
});
