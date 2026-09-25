// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import test from "node:test";
import {
  contextNavigationFooter,
  partitionContextActions,
} from "../src/lib/context-quick-actions.ts";

test("unsupported image copy is omitted from the strip without inventing paste", () => {
  const result = partitionContextActions(
    [],
    [{ id: "image:copy", label: "Copy Image", disabled: true }],
    [],
  );
  assert.deepEqual(result.quick, []);
});

test("root navigation keeps own profile above Go to then Refresh without duplicating Settings", () => {
  const settings = { id: "page:go:settings", label: "Settings" };
  const footer = contextNavigationFooter(
    [
      { id: "page:back", label: "Back" },
      { id: "page:my-profile", label: "Open my profile", group: "pages" },
      { id: "page:refresh", label: "Refresh", shortcut: "Ctrl+R", group: "reload" },
      {
        id: "page:go-to",
        label: "Go to",
        children: [settings, { id: "page:go:home", label: "Home" }],
      },
    ],
    [settings],
  );
  assert.deepEqual(
    footer.map((action) => action.id),
    ["page:my-profile", "page:go-to", "page:refresh"],
  );
  assert.deepEqual(
    footer[1].children?.map((action) => action.id),
    ["page:go:home"],
  );
});

test("the strip moves an explicit copy command without conflating image bytes and image link", () => {
  const entity = [{ id: "comment:copy", label: "Copy comment text", quickCopy: true }];
  const content = [
    {
      id: "image",
      label: "Image",
      children: [
        { id: "image:copy", label: "Copy image" },
        { id: "image:copy-link", label: "Copy image link" },
      ],
    },
  ];
  const result = partitionContextActions(entity, content, []);
  assert.deepEqual(
    result.quick.map((a) => a.id),
    ["comment:copy"],
  );
  assert.deepEqual(result.entity, []);
  assert.equal(result.content[0].children?.length, 2);
  const poster = partitionContextActions([], content, []);
  assert.deepEqual(
    poster.quick.map((a) => a.id),
    ["image:copy"],
  );
  assert.deepEqual(
    poster.content[0].children?.map((a) => a.id),
    ["image:copy-link"],
  );
});

test("navigation commands preserve their original capability and avoid duplicates", () => {
  const back = { id: "page:back", label: "Back", disabled: true };
  const settings = { id: "page:go:settings", label: "Settings", run: () => {} };
  const nav = [
    back,
    {
      id: "page:go-to",
      label: "Go to",
      children: [settings, { id: "page:go:home", label: "Home" }],
    },
  ];
  const result = partitionContextActions(nav, [], nav);
  assert.deepEqual(result.quick, [back, settings]);
  assert.deepEqual(
    result.entity[0].children?.map((a) => a.id),
    ["page:go:home"],
  );
  assert.equal(
    result.quick.some((a) => /paste/i.test(a.id)),
    false,
  );
});

test("selection never silently replaces a poster copy and empty groups are removed", () => {
  const result = partitionContextActions(
    [],
    [
      { id: "selection:copy", label: "Copy selected text" },
      { id: "image", label: "Image", children: [{ id: "image:copy", label: "Copy image" }] },
    ],
    [],
  );
  assert.deepEqual(
    result.quick.map((a) => a.id),
    ["image:copy"],
  );
  assert.deepEqual(
    result.content.map((a) => a.id),
    ["selection:copy"],
  );
});

test("moving a child command preserves its parent's disabled capability", () => {
  const result = partitionContextActions(
    [],
    [],
    [
      {
        id: "page:go-to",
        label: "Go to",
        disabled: true,
        reason: "Navigation unavailable",
        children: [{ id: "page:go:settings", label: "Settings", run: () => {} }],
      },
    ],
  );
  assert.equal(result.quick[0].disabled, true);
  assert.equal(result.quick[0].reason, "Navigation unavailable");
});
