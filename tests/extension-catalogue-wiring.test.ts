// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const doc = read("android-extension-compat/docs/BRIDGE.md");
const dispatch = read("android-extension-compat/src/host/BridgeServer.kt");
const rust = read("src-tauri/src/capstan.rs");
const registry = read("src-tauri/src/lib.rs");
const wire = read("src/lib/streams/plugins/extension/bridge.ts");
const browse = read("src/lib/catalog-browse.ts");

test("the catalogue methods the desktop side sends are the ones the bridge answers", () => {
  for (const method of ["catalogue", "cataloguePage"]) {
    assert.match(doc, new RegExp(`\\| \`${method}\``), `BRIDGE.md must document ${method}`);
    assert.match(dispatch, new RegExp(`"${method}" ->`), `the bridge must dispatch ${method}`);
    assert.match(rust, new RegExp(`"${method}"`), `capstan.rs must send ${method}`);
  }
  assert.match(rust, /"row": row/, "cataloguePage is addressed by row name, not by row data");
});

test("both catalogue commands are registered, so neither is an engine with no caller", () => {
  for (const command of ["capstan_catalogue", "capstan_catalogue_page"]) {
    assert.match(rust, new RegExp(`pub async fn ${command}\\b`), `${command} must exist`);
    assert.match(registry, new RegExp(`capstan::${command},`), `${command} must be registered`);
    assert.match(wire, new RegExp(`invoke\\("${command}"`), `${command} must be called`);
  }
});

test("a page is read out of the sections the bridge writes, not a flat list", () => {
  const page = wire.slice(wire.indexOf("export async function bridgeCataloguePage"));
  assert.match(page, /list<unknown>\(raw, "sections"\)/, "sections carry the named lists");
  assert.match(page, /list<BridgeSearchItem>\(section, "items"\)/, "items live inside a section");
  assert.match(page, /hasNext === true/, "the last page must be recognised");
});

test("a plugin's own catalogs go through the browse surface every addon catalog uses", () => {
  assert.match(
    browse,
    /const out: BrowseCatalog\[\] = extensionCatalogs\(\);/,
    "listBrowseCatalogs must include the plugin rows",
  );
  const fetcher = browse.slice(browse.indexOf("export function browseFetcher"));
  const branch = fetcher.indexOf("isExtensionCatalogueBase(cat.base)");
  const addon = fetcher.indexOf("createAddonCatalogFetcher(cursor");
  assert.ok(branch >= 0, "browseFetcher must recognise a plugin catalog");
  assert.ok(addon > branch, "the plugin branch is taken before the addon fetcher is built");
});
