import assert from "node:assert/strict";
import test from "node:test";
import { resolveContextNavigation } from "../src/chrome/navigation-policy.ts";
import { requestAppBack } from "../src/lib/app-back.ts";

test("custom sidebar shortcuts do not hide other allowed Go to destinations", () => {
  const items = [
    { id: "home", view: "home", label: "Home" },
    { id: "manga", view: "manga", label: "Manga", hideKey: "manga" as const },
    { id: "downloads", view: "downloads", label: "Downloads" },
    { id: "settings", view: "settings", label: "Settings" },
  ];
  const config = { order: [], hidden: [], renamed: {} };
  const policy = {
    kid: false,
    showPlaylistsTab: true,
    hideContent: {},
    locked: false,
    hiddenTabs: {},
  };
  const chrome = { items: ["home"], labels: { home: "Landing" } };
  assert.deepEqual(
    resolveContextNavigation(items, config, policy, chrome).map((row) => row.item.label),
    ["Landing", "Manga", "Downloads", "Settings"],
  );
  assert.deepEqual(
    resolveContextNavigation(
      items,
      { ...config, hidden: ["downloads"] },
      { ...policy, hideContent: { manga: true } },
      chrome,
    ).map((row) => row.item.id),
    ["home", "settings"],
  );
});

test("visible and mouse Back use local handling before stack navigation without a Home fallback", () => {
  const events = new EventTarget();
  let pops = 0;
  let local = 0;
  const listener = (event: Event) => {
    event.preventDefault();
    local++;
  };
  events.addEventListener("harbor:local-back", listener);
  assert.equal(
    requestAppBack(
      true,
      () => {
        pops++;
      },
      events,
    ),
    true,
  );
  assert.equal(local, 1);
  assert.equal(pops, 0);
  events.removeEventListener("harbor:local-back", listener);
  assert.equal(
    requestAppBack(
      true,
      () => {
        pops++;
      },
      events,
    ),
    true,
  );
  assert.equal(pops, 1);
  assert.equal(
    requestAppBack(
      false,
      () => {
        pops++;
      },
      events,
    ),
    false,
  );
  assert.equal(pops, 1);
});
