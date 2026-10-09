// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { cleanServerMessage } from "../src/lib/manga/sources/suwayomi/server-message.ts";

test("unwraps Suwayomi's GraphQL error down to the useful sentence", () => {
  const raw = [
    "Exception while fetching data (/updateExtension) : Extension can't be updated to the same version. Reinstall the extension instead",
    "java.lang.IllegalStateException: Extension can't be updated to the same version. Reinstall the extension instead",
    "\tat suwayomi.tachidesk.manga.impl.extension.Extension.installExtension(Extension.kt:451)",
    "\tat kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34)",
  ].join("\n");
  assert.equal(
    cleanServerMessage(raw),
    "Extension can't be updated to the same version. Reinstall the extension instead",
  );
});

test("drops a trailing stack frame when it shares the line", () => {
  assert.equal(
    cleanServerMessage(
      "Exception while fetching data (/updateExtension) : boom at com.example.Foo(Foo.kt:12)",
    ),
    "boom",
  );
});

test("leaves a plain message alone and tolerates blank input", () => {
  assert.equal(cleanServerMessage("  Server is unreachable  "), "Server is unreachable");
  assert.equal(cleanServerMessage(""), "");
});
