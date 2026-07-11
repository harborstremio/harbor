import assert from "node:assert/strict";
import test from "node:test";
import { eventToBinding, matchesBinding } from "../src/lib/hotkeys.ts";

function keyboardEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...overrides,
  } as KeyboardEvent;
}

test("uses the physical Slash key when the active keyboard layout is Arabic", () => {
  const event = keyboardEvent({ key: "ظ", code: "Slash" });

  assert.equal(eventToBinding(event), "Slash");
  assert.equal(matchesBinding(event, "Slash"), true);
  assert.equal(matchesBinding(event, "/"), true);
});

test("uses physical letter keys while preserving existing character bindings", () => {
  const event = keyboardEvent({ key: "ش", code: "KeyA" });

  assert.equal(eventToBinding(event), "KeyA");
  assert.equal(matchesBinding(event, "KeyA"), true);
  assert.equal(matchesBinding(event, "a"), true);
});

test("keeps semantic non-printable keys stable across layouts", () => {
  const event = keyboardEvent({ key: "Escape", code: "Escape" });

  assert.equal(eventToBinding(event), "Escape");
  assert.equal(matchesBinding(event, "Escape"), true);
});

test("preserves legacy shifted punctuation bindings", () => {
  const event = keyboardEvent({ key: "<", code: "Comma", shiftKey: true });

  assert.equal(matchesBinding(event, "shift+<"), true);
});
