import assert from "node:assert/strict";
import test from "node:test";
import { resolveSidebarNavigation } from "../src/chrome/navigation-policy.ts";

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
