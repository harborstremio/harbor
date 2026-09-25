// @ts-expect-error Node types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node types are outside the browser tsconfig.
import test from "node:test";
import {
  composeActions,
  findAction,
  fitMenu,
  executeContextAction,
} from "../src/lib/context-actions";

test("composition deduplicates the same command identity, not distinct copy operations", () => {
  const actions = composeActions(
    [{ id: "copy-image", label: "Copy", run() {} }],
    [
      { id: "copy-image", label: "Copy again", run() {} },
      { id: "copy-link", label: "Copy", run() {} },
    ],
  );
  assert.deepEqual(
    actions.map((a) => a.id),
    ["copy-image", "copy-link"],
  );
});

test("menu fits measured size into a small viewport including oversized menus", () => {
  assert.deepEqual(
    fitMenu({ x: 790, y: 590 }, { width: 260, height: 420 }, { width: 800, height: 600 }),
    { x: 532, y: 172 },
  );
  assert.deepEqual(
    fitMenu({ x: -4, y: 70 }, { width: 900, height: 800 }, { width: 800, height: 600 }),
    { x: 8, y: 8 },
  );
});

test("execution re-resolves current action and rejects a disappeared or disabled command", async () => {
  let count = 0;
  const stale = {
    id: "delete",
    label: "Delete",
    run() {
      count++;
    },
  };
  const target = { actions: () => [{ ...stale, disabled: true }], isValid: () => true };
  await assert.rejects(executeContextAction(target, "delete"));
  await assert.rejects(executeContextAction({ ...target, actions: () => [] }, "delete"));
  await assert.rejects(
    executeContextAction({ actions: () => [stale], isValid: () => false }, "delete"),
  );
  assert.equal(count, 0);
  await executeContextAction({ actions: () => [stale] }, "delete");
  assert.equal(count, 1);
});

test("submenu commands resolve by identity", () => {
  const command = { id: "poster:save", label: "Save", run() {} };
  assert.equal(
    findAction([{ id: "poster", label: "Image", children: [command] }], command.id),
    command,
  );
});

test("an in-flight command cannot execute twice, including through a reopened menu", async () => {
  const finishers: (() => void)[] = [];
  let count = 0;
  const source = {
    actions: () => [
      {
        id: "delete:file-a",
        label: "Delete",
        async run() {
          count++;
          await new Promise<void>((resolve) => {
            finishers.push(resolve);
          });
        },
      },
    ],
  };
  const first = executeContextAction(source, "delete:file-a");
  const second = executeContextAction(source, "delete:file-a");
  finishers.forEach((finish) => finish());
  await first;
  await assert.rejects(second, /already running/);
  assert.equal(count, 1);
});

test("a disabled parent prevents executing its previously available submenu command", async () => {
  let ran = false;
  await assert.rejects(
    executeContextAction(
      {
        actions: () => [
          {
            id: "group",
            label: "Group",
            disabled: true,
            children: [
              {
                id: "child",
                label: "Child",
                run() {
                  ran = true;
                },
              },
            ],
          },
        ],
      },
      "child",
    ),
  );
  assert.equal(ran, false);
});

test("dismissal is action-specific and membership changes keep their destination picker open", async () => {
  const source = {
    actions: () => [
      { id: "open", label: "Open", run() {} },
      {
        id: "member",
        label: "Destination",
        checked: false,
        dismiss: "keep-open" as const,
        run() {},
      },
    ],
  };
  assert.equal((await executeContextAction(source, "open")).dismiss, "on-success");
  assert.equal((await executeContextAction(source, "member")).dismiss, "keep-open");
});

test("destructive confirmation must match the freshly resolved actor, target, and scope", async () => {
  let scope = "actor-a:file-a:version-1";
  let runs = 0;
  const source = {
    actions: () => [
      {
        id: "delete:scoped",
        label: "Delete file…",
        confirmation: {
          key: scope,
          title: "Delete this downloaded file?",
          description: "Only file-a and its download record will be removed.",
          confirmLabel: "Delete file",
          successLabel: "File deleted",
        },
        run() {
          runs++;
        },
      },
    ],
  };
  await assert.rejects(executeContextAction(source, "delete:scoped"), /confirmation/i);
  const originalScope = scope;
  scope = "actor-a:file-a:version-2";
  await assert.rejects(
    executeContextAction(source, "delete:scoped", { confirmationKey: originalScope }),
    /changed/i,
  );
  assert.equal(runs, 0);
  const result = await executeContextAction(source, "delete:scoped", { confirmationKey: scope });
  assert.equal(runs, 1);
  assert.equal(
    result.dismiss,
    "keep-open",
    "confirmed operations retain their truthful result feedback",
  );
});

test("a confirmation cannot execute a replacement command after confirmation metadata disappears", async () => {
  let runs = 0;
  const source = {
    actions: () => [
      {
        id: "replacement",
        label: "Different operation",
        run() {
          runs++;
        },
      },
    ],
  };
  await assert.rejects(
    executeContextAction(source, "replacement", { confirmationKey: "previous-scope" }),
    /changed/i,
  );
  assert.equal(runs, 0);
});
