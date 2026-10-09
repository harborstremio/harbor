import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { providesOwnRows } from "../src/lib/streams/plugins/runnable.ts";

const SRC = "src";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const FILES = walk(SRC).filter((p) => /\.tsx?$/.test(p));
const read = (p: string): string => readFileSync(p, "utf8");

test("plugins stay out of the surfaces outside their own page until they are allowed", () => {
  assert.match(read("src/lib/settings/defaults.ts"), /pluginsOutsideTab: false/);
  assert.match(read("src/lib/settings/types.ts"), /pluginsOutsideTab: boolean;/);
});

test("the switch is offered with the NEW badge", () => {
  const panel = read("src/views/settings/plugins-panel/installed-tab.tsx");
  assert.match(panel, /value=\{settings\.pluginsOutsideTab\}/);
  assert.match(panel, /\{\(v\) => update\(\{ pluginsOutsideTab: v \}\)\}/);
  assert.match(panel, /newId="plugins:outside-tab"/);
  assert.match(
    read("src/views/settings/settings-new.ts"),
    /"plugins:outside-tab"/,
    "an id that is not registered shows no badge",
  );
});

test("a surface that does not want plugin rows does not ask for them", () => {
  // The list is built from the flag rather than filtered afterwards, so a plugin is never queried
  // on behalf of a surface that will not show it.
  assert.match(
    read("src/lib/catalog-browse.ts"),
    /function extensionCatalogs\(includePlugins: boolean\): BrowseCatalog\[\] \{\r?\n  if \(!includePlugins\) return \[\];/,
  );
});

test("the Plugins page is the only surface that always asks for plugin rows", () => {
  const definition = join("src", "lib", "catalog-browse.ts");
  const callers = FILES.filter(
    (p) => p !== definition && read(p).includes("listBrowseCatalogs("),
  );
  assert.ok(callers.length > 0, "the catalog list has callers");

  const pluginsPage = join("src", "views", "plugins.tsx");
  assert.ok(callers.includes(pluginsPage), "the Plugins page lists catalogs");

  for (const file of callers) {
    const text = read(file);
    if (file === pluginsPage) {
      assert.match(text, /pluginRows: true/, "the Plugins page asks for its own rows");
      continue;
    }
    assert.match(
      text,
      /pluginRows: settings\.pluginsOutsideTab/,
      `${file} must thread the setting rather than decide for itself`,
    );
    assert.ok(!/pluginRows: true/.test(text), `${file} must not hardcode plugin rows on`);
  }
});

test("only a plugin that stands up rows of its own is held back", () => {
  // The extension has a page of its own, so asking it elsewhere is opt-in. A plugin with no rows
  // of its own has nowhere else to be found, and holding it back would leave it dead.
  assert.equal(providesOwnRows({ format: "android-extension" }), true);
  assert.equal(providesOwnRows({ format: "provider-script" }), false);
});

test("the Play button asks a plugin with no rows of its own whatever the switch says", () => {
  const picker = read("src/views/play-picker/use-addons.ts");
  assert.match(picker, /if \(settings\.pluginsEnabled\) \{/);
  assert.match(picker, /includeExtensions: settings\.pluginsOutsideTab/);
  assert.ok(
    !/pluginsEnabled && settings\.pluginsOutsideTab/.test(picker),
    "the switch must not stand the row-less plugins down",
  );
});

test("background work keeps the extensions back but never the row-less plugins", () => {
  const context = read("src/lib/auto-download/context.ts");
  assert.match(context, /settings\.pluginsEnabled && settings\.pluginsBackground/);
  assert.match(context, /includeExtensions: settings\.pluginsOutsideTab/);
});

test("a plugin row pinned to Home goes with the others", () => {
  const pinned = read("src/lib/pinned-catalogs-rows.ts");
  assert.match(pinned, /opts: \{ pluginRows: boolean \}/);
  assert.match(
    pinned,
    /opts\.pluginRows \|\| !isExtensionCatalogueBase\(/,
    "a pinned plugin row is still a plugin being asked",
  );
});
