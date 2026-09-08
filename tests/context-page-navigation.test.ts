import assert from "node:assert/strict";
import test from "node:test";
import { resolveSidebarNavigation } from "../src/chrome/navigation-policy.ts";
import * as registry from "../src/lib/context-page-store.ts";

test("shared sidebar policy preserves customization while enforcing hidden pages and PIN gates", () => {
  const items = [
    { id: "home", view: "home", label: "Home" },
    { id: "movies", view: "movies", label: "Movies", parentalKey: "movies" },
    { id: "anime", view: "anime", label: "Anime", hideKey: "anime" },
    { id: "vod", view: "vod", label: "Playlists" },
    { id: "kids", view: "kids", label: "Kids" },
    { id: "library", view: "library", label: "Library" },
    { id: "settings", view: "settings", label: "Settings", pinGated: true },
  ];
  const config = {
    order: ["library", "movies", "home", "settings"],
    hidden: [],
    renamed: { home: "Harbor" },
  };
  const result = resolveSidebarNavigation(items, config, {
    kid: false,
    showPlaylistsTab: false,
    hideContent: { anime: true },
    locked: true,
    hiddenTabs: { movies: true },
  });
  assert.deepEqual(
    result.map((entry: { item: { id: string }; gated: boolean }) => [entry.item.id, entry.gated]),
    [
      ["home", false],
      ["library", false],
      ["settings", true],
    ],
  );
  assert.equal(result[0].item.label, "Harbor");
  const kid = resolveSidebarNavigation(items, config, {
    kid: true,
    showPlaylistsTab: true,
    hideContent: {},
    locked: false,
    hiddenTabs: {},
  });
  assert.deepEqual(
    kid.map((entry: { item: { id: string } }) => entry.item.id),
    ["kids"],
  );
});

test("refresh commands reject inactive or busy pages and use the current handler", async () => {
  const calls: string[] = [];
  let state = {
    id: "history",
    page: "library",
    label: "Refresh history",
    active: true,
    busy: false,
    run: () => {
      calls.push("old");
    },
  };
  const unregister = registry.registerPageContextRefresh(() => state);
  assert.equal(registry.getPageContextRefresh("live"), null);
  state = {
    ...state,
    run: () => {
      calls.push("current");
    },
  };
  await registry.runPageContextRefresh("library", "history");
  assert.deepEqual(calls, ["current"]);
  state = { ...state, busy: true };
  await assert.rejects(() => registry.runPageContextRefresh("library", "history"), /busy|already/i);
  state = { ...state, busy: false, active: false };
  await assert.rejects(
    () => registry.runPageContextRefresh("library", "history"),
    /available|active/i,
  );
  unregister();
  assert.equal(registry.getPageContextRefresh("library"), null);
});
