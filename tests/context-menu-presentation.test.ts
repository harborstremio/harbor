import assert from "node:assert/strict";
import test from "node:test";
import { resolveMenuPresentation } from "../src/components/context-menu/menu-presentation.ts";

test("ordinary builds use the approved popout; baseline requires an explicit build flag", () => {
  for (const value of [undefined, "", "unknown"])
    assert.equal(resolveMenuPresentation(value, false, "baseline"), "popout");
  assert.equal(resolveMenuPresentation("baseline", false, "popout"), "baseline");
  assert.equal(resolveMenuPresentation("popout", false), "popout");
});

test("comparison overrides exist only in development and cannot change a supplied build", () => {
  assert.equal(resolveMenuPresentation("popout", false, "baseline"), "popout");
  assert.equal(resolveMenuPresentation(undefined, true, "popout"), "popout");
  assert.equal(resolveMenuPresentation("popout", true, "baseline"), "baseline");
  assert.equal(resolveMenuPresentation("popout", true, "invalid"), "popout");
});
