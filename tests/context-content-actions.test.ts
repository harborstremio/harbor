// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import test from "node:test";
import { contentActions } from "../src/components/context-menu/content-actions.tsx";

test("a linked poster keeps distinct title and image links but does not duplicate the same image URL", () => {
  const image = {
    src: "https://images.example.org/poster.png",
    publicUrl: "https://images.example.org/poster.png",
  };
  const independent = contentActions(
    { image, link: "https://games.example.org/game" },
    () => {},
    false,
  );
  assert.deepEqual(
    independent.map((a) => a.id),
    ["link:open", "link:copy", "image"],
  );
  assert.ok(independent[2].children?.some((a) => a.id === "image:copy-link"));
  const same = contentActions({ image, link: image.src }, () => {}, true);
  assert.equal(
    same.some((a) => a.id === "link:copy"),
    false,
  );
  assert.equal(same.filter((a) => a.id === "image:copy-link").length, 1);
});

test("selected text remains distinct, and private image URLs do not become share links", () => {
  const actions = contentActions(
    { selection: "selected words", image: { src: "blob:https://example.org/fixture" } },
    () => {},
    true,
  );
  assert.equal(actions[0].id, "selection:copy");
  assert.equal(
    actions.some((a) => a.id === "image:copy-link"),
    false,
  );
  assert.equal(actions.find((a) => a.id === "image:view")?.restoreFocus, false);
});
