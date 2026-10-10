import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SHIM = readFileSync("android-extension-compat/src/api/HomePageResponse.kt", "utf8");
const CATALOGUE = readFileSync("src/lib/streams/plugins/extension/catalogue.ts", "utf8");

test("a provider that does not say whether a page follows is taken to have one", () => {
  // Kotlin fills in a default argument in the class that declares it, so this is the value every
  // extension that writes `HomePageResponse(items)` gets — and every extension scanned does write
  // it that way, none passing the flag. False told the catalogue layer there was never a next page.
  assert.match(
    SHIM,
    /val hasNext: Boolean = true/,
    "a false here stops every catalogue row at its first page",
  );
});

test("a provider that does say so still stops the walk", () => {
  assert.match(
    CATALOGUE,
    /if \(!found\.hasNext\) \{[\s\S]{0,90}?exhausted\.set\(key, asked\)/,
    "the exhausted marker is what honours an explicit end, and it must keep working",
  );
  assert.match(
    CATALOGUE,
    /if \(last != null && asked > last\) return \[\];/,
    "nothing past a page a provider said was its last is asked for",
  );
});
