import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SEARCH = readFileSync("src/lib/streams/plugins/extension/search.ts", "utf8");
const BRIDGE = readFileSync("src/lib/streams/plugins/extension/bridge.ts", "utf8");
const VIEW = readFileSync("src/views/plugins.tsx", "utf8");
const RUST = readFileSync("src-tauri/src/capstan.rs", "utf8");
const API = readFileSync("android-extension-compat/src/api/MainAPI.kt", "utf8");

/** The body of `searchPluginPage`, which is the walk a plugin's View all drives. */
const walkBody = (): string => {
  const found = /export async function searchPluginPage[\s\S]*?\r?\n\}\r?\n/.exec(SEARCH);
  return found?.[0] ?? "";
};

test("the search call carries the page it was asked for", () => {
  // The Rust command has taken a page all along and the extension's own search takes one; only this
  // call never sent it, which made every search page one.
  assert.match(BRIDGE, /invoke\("capstan_search", \{ providerId, query, quick, page \}\)/);
  assert.match(RUST, /page: Option<u32>/, "the command already accepts a page");
  assert.match(RUST, /params\["page"\] = json!\(page\)/, "and forwards it");
});

test("a walk past the shelves is not capped", () => {
  const body = walkBody();
  assert.ok(body, "searchPluginPage exists");
  assert.ok(
    !/slice\(0,/.test(body),
    "getting past the cap is the point of the walk, so it must not apply one",
  );
  assert.match(body, /bridgeSearch\(provider\.id, wanted, provider\.hasQuickSearch, page\)/);
  assert.match(body, /seen\.has\(meta\.id\)/, "the providers' pages are merged without repeats");
});

test("a provider with nothing past its first page ends the walk", () => {
  // This is what stops the walk looping: the extension API answers an empty list past page one
  // unless the extension implements paging, so the grid sees an empty batch and stops.
  assert.match(API, /if \(page > 1\) return SearchResponseList\(emptyList\(\), false\)/);
});

test("each plugin offers the walk, and starts it from the first page", () => {
  assert.match(VIEW, /\{t\("View all"\)\}/);
  const opened = /openGrid\(\{[\s\S]{0,320}?\}\)/.exec(VIEW)?.[0] ?? "";
  assert.ok(opened, "a plugin's View all opens a grid");
  assert.match(
    opened,
    /fetcher: \(page: number\) => searchPluginPage\(group\.pluginId, asked, page\)/,
    "the grid walks that plugin, for the title that was asked for",
  );
  assert.ok(
    !/initial:/.test(opened),
    "seeded with the shelves' capped rows the walk would resume at page two and the rest of " +
      "page one would never be seen",
  );
});
