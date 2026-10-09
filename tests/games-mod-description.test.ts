import assert from "node:assert/strict";
import { test } from "node:test";
import { modDescriptionBlocks } from "../src/lib/games/mod-description";

test("creator text retains notes while explicit headings and lists become readable sections", () => {
  const blocks = modDescriptionBlocks("Installation\n\n- Copy the files\n- Keep your saves\n\n1/15/18 Change Log:\n\nFIXED: A long-standing issue.\nUnknown creator text stays here.");
  assert.deepEqual(blocks, [
    { kind: "heading", lines: ["Installation"] },
    { kind: "list", lines: ["Copy the files", "Keep your saves"] },
    { kind: "heading", lines: ["1/15/18 Change Log:"] },
    { kind: "paragraph", lines: ["FIXED: A long-standing issue."] },
    { kind: "paragraph", lines: ["Unknown creator text stays here."] },
  ]);
});
test("provider HTML remains literal text and long prose is never promoted to a heading", () => {
  const text = '<img src=x onerror="alert(1)">';
  assert.deepEqual(modDescriptionBlocks(text), [{ kind: "paragraph", lines: [text] }]);
  const sentence = "Update 1: " + "A full sentence describing the change. ".repeat(5);
  assert.equal(modDescriptionBlocks(sentence)[0].kind, "paragraph");
  assert.equal(modDescriptionBlocks(sentence)[0].lines[0], sentence.trim());
});
test("CRLF and translated prose retain their content", () => {
  assert.deepEqual(modDescriptionBlocks("说明\r\n\r\n请保留存档。"), [{ kind: "paragraph", lines: ["说明"] }, { kind: "paragraph", lines: ["请保留存档。"] }]);
});

test("numbered installation steps retain their ordering and explicit restarts", () => {
  assert.deepEqual(modDescriptionBlocks("2. Back up saves\n3. Copy files\n1. Start another sequence"), [
    { kind: "ordered-list", start: 2, lines: ["Back up saves", "Copy files"] },
    { kind: "ordered-list", start: 1, lines: ["Start another sequence"] },
  ]);
});
