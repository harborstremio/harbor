// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import test from "node:test";
import { collectionAuthorHandle } from "../src/lib/collection-author.ts";

test("community metadata and saved-copy provenance identify the actual author", () => {
  assert.equal(collectionAuthorHandle({ handle: " Creator.One " }), "creator.one");
  assert.equal(
    collectionAuthorHandle({ sourceHandle: "Original", sourceId: "source-id" }),
    "original",
  );
  assert.equal(collectionAuthorHandle({ sourceId: "source-id" }), null);
  assert.equal(collectionAuthorHandle({}), null);
  assert.equal(collectionAuthorHandle({ handle: "https://wrong.example/person" }), null);
});
