import assert from "node:assert/strict";
import { test } from "node:test";
import { bindPageActions, type PageAction } from "../src/views/settings/page-actions";

test("a ready footer action uses edits made after it became enabled", () => {
  const received: string[] = [];
  let actions: PageAction[] = [{ id: "submit", label: "Submit", onSelect: () => { received.push("First summary"); } }];
  const [button] = bindPageActions(actions, () => actions);
  actions = [{ id: "submit", label: "Submit", onSelect: () => { received.push("Revised summary and details"); } }];
  button.onSelect();
  assert.deepEqual(received, ["Revised summary and details"]);
});

test("a retained footer action cannot run after becoming disabled or being removed", () => {
  let calls = 0;
  let actions: PageAction[] = [{ id: "submit", label: "Submit", onSelect: () => { calls += 1; } }];
  const [button] = bindPageActions(actions, () => actions);
  actions = [{ ...actions[0], disabled: true }];
  button.onSelect();
  actions = [];
  button.onSelect();
  assert.equal(calls, 0);
});
