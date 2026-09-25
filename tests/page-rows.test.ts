import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyPageRows,
  movePageRow,
  orderedRowKeys,
  type PageRowCustomization,
} from "../src/lib/page-rows";

function custom(partial: Partial<PageRowCustomization> = {}): PageRowCustomization {
  return { order: [], hidden: [], renamed: {}, ...partial };
}

function rows(...keys: string[]) {
  return keys.map((key) => ({ key, title: key.toUpperCase() }));
}

const natural = ["recents", "recent-contexts", "fresh", "artists", "charts"];

describe("page row ordering", () => {
  it("leaves the natural order alone when nothing was customized", () => {
    assert.deepEqual(orderedRowKeys(natural, custom()), natural);
    assert.deepEqual(
      applyPageRows(rows(...natural), custom(), false).map((r) => r.key),
      natural,
    );
  });

  it("places a row the saved order has never seen after its natural predecessor", () => {
    const saved = custom({ order: ["recents", "fresh", "artists", "charts"] });
    assert.deepEqual(orderedRowKeys(natural, saved), natural);
    assert.deepEqual(
      applyPageRows(rows(...natural), saved, false).map((r) => r.key),
      natural,
      "an unknown key must not be appended to the bottom of the page",
    );
  });

  it("keeps the saved order of the rows it does know", () => {
    const saved = custom({ order: ["charts", "artists", "recents", "fresh"] });
    assert.deepEqual(orderedRowKeys(natural, saved), [
      "charts",
      "artists",
      "recents",
      "recent-contexts",
      "fresh",
    ]);
    assert.deepEqual(
      applyPageRows(rows(...natural), saved, false).map((r) => r.key),
      ["charts", "artists", "recents", "recent-contexts", "fresh"],
    );
  });

  it("handles a fully reversed saved order", () => {
    const saved = custom({ order: ["charts", "artists", "fresh", "recents"] });
    assert.deepEqual(orderedRowKeys(natural, saved), [
      "charts",
      "artists",
      "fresh",
      "recents",
      "recent-contexts",
    ]);
  });

  it("drops a saved key the page no longer offers", () => {
    const saved = custom({ order: ["gone", "charts", "recents"] });
    assert.deepEqual(orderedRowKeys(natural, saved), [
      "charts",
      "recents",
      "recent-contexts",
      "fresh",
      "artists",
    ]);
  });

  it("splices several unseen rows, each after its own predecessor", () => {
    const available = ["a", "newA", "b", "newB", "c"];
    const saved = custom({ order: ["c", "b", "a"] });
    assert.deepEqual(orderedRowKeys(available, saved), ["c", "b", "newB", "a", "newA"]);
  });

  it("hides and renames without disturbing placement", () => {
    const saved = custom({
      order: ["charts", "recents", "fresh", "artists"],
      hidden: ["fresh"],
      renamed: { "recent-contexts": "Jump back in" },
    });
    const visible = applyPageRows(rows(...natural), saved, false);
    assert.deepEqual(
      visible.map((r) => r.key),
      ["charts", "recents", "recent-contexts", "artists"],
    );
    assert.equal(visible.find((r) => r.key === "recent-contexts")?.title, "Jump back in");
    assert.deepEqual(
      applyPageRows(rows(...natural), saved, true).map((r) => r.key),
      ["charts", "recents", "recent-contexts", "fresh", "artists"],
    );
  });

  it("moves a spliced row through the order it was actually shown in", () => {
    const saved = custom({ order: ["recents", "fresh", "artists", "charts"] });
    const next = movePageRow(saved, natural, "recent-contexts", 1);
    assert.deepEqual(orderedRowKeys(natural, next), [
      "recents",
      "fresh",
      "recent-contexts",
      "artists",
      "charts",
    ]);
  });
});
