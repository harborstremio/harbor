import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_ORDER,
  ORDER_KEY,
  arrange,
  clearOrder,
  forFilter,
  move,
  readOrder,
  withHidden,
  withMove,
  writeOrder,
  type SectionOrder,
} from "../src/views/plugins/section-order";

/** A row as the tab holds one, which is all the arrangement ever looks at. */
function row(key: string) {
  return { key } as unknown as import("@/lib/catalog-browse").BrowseCatalog;
}

function groups(...names: [string, string[]][]): [string, ReturnType<typeof row>[]][] {
  return names.map(([plugin, keys]) => [plugin, keys.map(row)] as [string, ReturnType<typeof row>[]]);
}

function laid(groups_: [string, ReturnType<typeof row>[]][]): [string, string[]][] {
  return groups_.map(([plugin, rows]) => [plugin, rows.map((r) => r.key)]);
}

function memory(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(ORDER_KEY, initial);
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

test("an untouched tab lists plugins and rows in the order they arrived", () => {
  // The absence of an arrangement has to look exactly like the tab before arrangements existed,
  // because that is what every user sees until they choose to change anything.
  const input = groups(["Ultima", ["a", "b", "c"]], ["Vegamovies", ["d"]]);
  assert.deepEqual(laid(arrange(input, EMPTY_ORDER)), [["Ultima", ["a", "b", "c"]], ["Vegamovies", ["d"]]]);
});

test("plugins are shown in the order they were put in", () => {
  const input = groups(["Ultima", ["a"]], ["Vegamovies", ["d"]], ["Moviesmod", ["x"]]);
  const order: SectionOrder = { plugins: ["Moviesmod", "Ultima", "Vegamovies"], rows: {}, hidden: [] };
  assert.deepEqual(laid(arrange(input, order)), [
    ["Moviesmod", ["x"]],
    ["Ultima", ["a"]],
    ["Vegamovies", ["d"]],
  ]);
});

test("rows are shown in the order they were put in, inside their own plugin", () => {
  const input = groups(["Ultima", ["a", "b", "c"]]);
  const order: SectionOrder = { plugins: [], rows: { Ultima: ["c", "a", "b"] }, hidden: [] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["c", "a", "b"]]]);
});

test("a row added after the tab was arranged still appears, at the end", () => {
  // A plugin that ships a new row would otherwise be invisible until the arrangement was redone,
  // which is the one outcome an arrangement must never have.
  const input = groups(["Ultima", ["a", "b", "newcomer"]]);
  const order: SectionOrder = { plugins: [], rows: { Ultima: ["b", "a"] }, hidden: [] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["b", "a", "newcomer"]]]);
});

test("a plugin installed after the tab was arranged still appears, at the end", () => {
  const input = groups(["Ultima", ["a"]], ["Newcomer", ["z"]]);
  const order: SectionOrder = { plugins: ["Ultima"], rows: {}, hidden: [] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["a"]], ["Newcomer", ["z"]]]);
});

test("a row that is gone is dropped rather than ordered into a gap", () => {
  const input = groups(["Ultima", ["a"]]);
  const order: SectionOrder = { plugins: [], rows: { Ultima: ["gone", "a"] }, hidden: [] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["a"]]]);
});

test("a plugin installed after the tab was arranged is not claimed by a similarly named one", () => {
  const input = groups(["Ultima", ["a"]], ["Ultima Extra", ["z"]]);
  const order: SectionOrder = { plugins: ["Ultima"], rows: {}, hidden: [] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["a"]], ["Ultima Extra", ["z"]]]);
});

test("a hidden row is not shown, and turning it back on restores where it was", () => {
  const input = groups(["Ultima", ["a", "b", "c"]]);
  const order: SectionOrder = { plugins: [], rows: { Ultima: ["c", "b", "a"] }, hidden: ["b"] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["c", "a"]]]);
  const back = withHidden(order, "b", false);
  assert.deepEqual(laid(arrange(input, back)), [["Ultima", ["c", "b", "a"]]]);
});

test("a plugin left with nothing to show is not given an empty heading", () => {
  const input = groups(["Ultima", ["a"]], ["Vegamovies", ["d"]]);
  const order: SectionOrder = { plugins: [], rows: {}, hidden: ["d"] };
  assert.deepEqual(laid(arrange(input, order)), [["Ultima", ["a"]]]);
});

test("a move stops at the ends rather than wrapping round", () => {
  assert.deepEqual(move(["a", "b", "c"], 0, -1), ["a", "b", "c"], "already first");
  assert.deepEqual(move(["a", "b", "c"], 2, 1), ["a", "b", "c"], "already last");
  assert.deepEqual(move(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(move(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
});

test("moving a row leaves the rest of the arrangement alone", () => {
  const input = groups(["Ultima", ["a", "b", "c"]], ["Vegamovies", ["d"]]);
  const order: SectionOrder = { plugins: ["Vegamovies"], rows: { Ultima: ["a", "b", "c"] }, hidden: ["x"] };
  const moved = withMove(order, input, "Ultima", "c", -1);
  assert.deepEqual(moved.plugins, ["Vegamovies"], "the plugin order is untouched");
  assert.deepEqual(moved.hidden, ["x"], "and so is what is hidden");
  const shown = arrange(input, moved).find(([name]) => name === "Ultima");
  assert.deepEqual(shown?.[1].map((r) => r.key), ["a", "c", "b"], "the row moved one place up");
});

test("moving a row that was never arranged puts the whole plugin in order first", () => {
  // The first move has to record enough for later moves to be relative to what is on screen, or
  // every second move would jump back to the order the plugins arrived in.
  const input = groups(["Ultima", ["a", "b", "c"]]);
  const moved = withMove(EMPTY_ORDER, input, "Ultima", "c", -1);
  assert.deepEqual(laid(arrange(input, moved)), [["Ultima", ["a", "c", "b"]]]);
});

test("moving a plugin reorders the plugins and nothing else", () => {
  const input = groups(["Ultima", ["a"]], ["Vegamovies", ["d"]], ["Moviesmod", ["x"]]);
  // The first plugin down, which is a swap with the one after it rather than a jump to the end.
  const moved = withMove(EMPTY_ORDER, input, "Ultima", null, 1);
  assert.deepEqual(laid(arrange(input, moved)), [
    ["Vegamovies", ["d"]],
    ["Ultima", ["a"]],
    ["Moviesmod", ["x"]],
  ]);
});

test("moving a plugin does not disturb the rows inside it", () => {
  const input = groups(["Ultima", ["a", "b"]], ["Vegamovies", ["d"]]);
  const order: SectionOrder = { plugins: [], rows: { Ultima: ["b", "a"] }, hidden: [] };
  const moved = withMove(order, input, "Ultima", null, 1);
  const ult = arrange(input, moved).find(([name]) => name === "Ultima");
  assert.deepEqual(ult?.[1].map((r) => r.key), ["b", "a"], "the row order held");
});

test("what was arranged is read back", () => {
  const store = memory();
  const order: SectionOrder = { plugins: ["B"], rows: { B: ["2", "1"] }, hidden: ["3"] };
  writeOrder(order, store);
  assert.deepEqual(readOrder(store), order);
});

test("what was arranged is read back after the store is emptied", () => {
  const store = memory();
  writeOrder({ plugins: ["B"], rows: {}, hidden: [] }, store);
  clearOrder(store);
  assert.deepEqual(readOrder(store), EMPTY_ORDER, "so the tab goes back to what it did before");
});

test("an arrangement that cannot be read reads as none, not as a fault", () => {
  // A half-written value is not worth losing the tab over, and the arrangement can be redone.
  for (const junk of ["", "{", "null", "[]", '"a string"', JSON.stringify({ plugins: "no" })]) {
    assert.deepEqual(readOrder(memory(junk)), EMPTY_ORDER, `junk: ${junk}`);
  }
});

test("entries of the wrong type in a stored arrangement are left out", () => {
  const store = memory(JSON.stringify({ plugins: ["A", 7, null], rows: { A: ["k", 3] }, hidden: [1] }));
  assert.deepEqual(readOrder(store), { plugins: ["A"], rows: { A: ["k"] }, hidden: [] });
});

test("no storage at all reads as no arrangement", () => {
  assert.deepEqual(readOrder(null), EMPTY_ORDER);
});

test("an arrangement applies to the page that shows every plugin", () => {
  const input = groups(["Ultima", ["a"]], ["Vegamovies", ["d"]]);
  const order: SectionOrder = { plugins: ["Vegamovies", "Ultima"], rows: { Ultima: ["a"] }, hidden: [] };
  assert.deepEqual(laid(forFilter(input, null, order)), [
    ["Vegamovies", ["d"]],
    ["Ultima", ["a"]],
  ]);
});

test("one plugin on its own is listed as it reports, whatever was arranged", () => {
  // An arrangement says how the plugins sit against each other. A view of one plugin has nothing
  // to interleave, so it is left as it was — which is what the panel tells the user.
  const input = groups(["Ultima", ["a", "b"]], ["Vegamovies", ["d"]]);
  const order: SectionOrder = {
    plugins: ["Vegamovies", "Ultima"],
    rows: { Ultima: ["b", "a"] },
    hidden: ["a"],
  };
  assert.deepEqual(laid(forFilter(input, "Ultima", order)), [["Ultima", ["a", "b"]]]);
});

test("a row hidden on the All page is still there when its plugin is picked on its own", () => {
  const input = groups(["Ultima", ["a", "b"]]);
  const order: SectionOrder = { plugins: [], rows: {}, hidden: ["a"] };
  assert.deepEqual(laid(forFilter(input, "Ultima", order)), [["Ultima", ["a", "b"]]]);
});

test("a picked plugin that is not installed shows nothing rather than everything", () => {
  const input = groups(["Ultima", ["a"]]);
  assert.deepEqual(forFilter(input, "Gone", EMPTY_ORDER), []);
});
