import assert from "node:assert/strict";
import test from "node:test";
import {
  registerContextTarget,
  registeredContextTarget,
  type ContextMenuTarget,
} from "../src/lib/context-menu.tsx";
import { executeContextAction } from "../src/lib/context-actions.ts";

class Node {
  isConnected = true;
  tag: string;
  parentElement: Node | null;
  constructor(tag: string, parentElement: Node | null = null) {
    this.tag = tag;
    this.parentElement = parentElement;
  }
  matches(selector: string) {
    return selector.split(",").some((part) => part.trim().startsWith(this.tag));
  }
  closest(selector: string): Node | null {
    return this.matches(selector) ? this : (this.parentElement?.closest(selector) ?? null);
  }
  get element() {
    return this as unknown as Element;
  }
}
const target = (id: string): ContextMenuTarget => ({
  kind: "actions",
  id,
  label: id,
  actions: () => [],
});

test("registered poster owns its image, but a nested link stops the surrounding comment", () => {
  const card = new Node("button");
  registerContextTarget(card.element, () => target("movie"));
  assert.equal(registeredContextTarget(new Node("img", card).element)?.kind, "actions");
  const comment = new Node("div");
  registerContextTarget(comment.element, () => target("comment"));
  assert.equal(registeredContextTarget(new Node("img", new Node("a", comment)).element), null);
  const author = new Node("button", comment);
  registerContextTarget(author.element, () => target("author"));
  const authorTarget = registeredContextTarget(new Node("img", author).element);
  assert.equal(authorTarget?.kind === "actions" && authorTarget.id, "author");
});

test("a comment image can be independent without losing the comment body's own target", () => {
  const comment = new Node("div");
  registerContextTarget(comment.element, () => ({
    ...target("comment"),
    contentPolicy: "separate",
  }));
  assert.equal(registeredContextTarget(new Node("img", comment).element), null);
  assert.equal(registeredContextTarget(new Node("span", comment).element)?.kind, "actions");
});

test("open actions read the latest state but retain the original profile guard", async () => {
  const row = new Node("div");
  let profile = "a";
  let disabled = false;
  let count = 0;
  registerContextTarget(row.element, () => {
    const captured = profile;
    return {
      kind: "actions",
      id: "row",
      label: "row",
      isValid: () => profile === captured,
      actions: () => [
        {
          id: "run",
          label: "run",
          disabled,
          run() {
            count++;
          },
        },
      ],
    };
  });
  const opened = registeredContextTarget(row.element)!;
  assert.equal(opened.kind, "actions");
  if (opened.kind !== "actions") return;
  disabled = true;
  await assert.rejects(executeContextAction(opened, "run"));
  disabled = false;
  await executeContextAction(opened, "run");
  profile = "b";
  await assert.rejects(executeContextAction(opened, "run"));
  assert.equal(count, 1);
});

test("removed or recycled rows cannot execute an old menu command", async () => {
  const row = new Node("div");
  let id = "first";
  const cleanup = registerContextTarget(row.element, () => ({
    ...target(id),
    actions: () => [{ id: "run", label: "run", run() {} }],
  }));
  const opened = registeredContextTarget(row.element)!;
  if (opened.kind !== "actions") throw new Error("Missing fixture target");
  id = "second";
  await assert.rejects(executeContextAction(opened, "run"));
  id = "first";
  cleanup();
  await assert.rejects(executeContextAction(opened, "run"));
});

test("media primary commands stay fresh and an episode or membership change invalidates the target", async () => {
  const row = new Node("div");
  let episode = 1;
  let source = "first-list";
  let label = "Play";
  registerContextTarget(row.element, () => ({
    kind: "meta",
    meta: { id: "tt1234567", type: "series", name: "Fixture" },
    episode: { season: 1, episode },
    membership: { kind: "list", id: source },
    primary: { actions: () => [{ id: "play", label, run() {} }] },
  }));
  const opened = registeredContextTarget(row.element)!;
  if (opened.kind !== "meta" || !opened.primary) throw new Error("Missing media target");
  label = "Resume";
  assert.equal(opened.primary.actions()[0].label, "Resume");
  episode = 2;
  assert.equal(opened.isValid?.(), false);
  await assert.rejects(executeContextAction(opened.primary, "play"));
  episode = 1;
  source = "second-list";
  assert.equal(opened.isValid?.(), false);
  await assert.rejects(executeContextAction(opened.primary, "play"));
});
