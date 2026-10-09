import assert from "node:assert/strict";
import test from "node:test";
import {
  getHeroDock,
  heroDockSupported,
  isHeroDocked,
  isHubKind,
  markExpandedFromDock,
  setHeroDock,
  setHeroDockSupported,
  wasExpandedFromDock,
} from "../src/lib/hero-dock.ts";
import type { PlayerSrc } from "../src/lib/view.tsx";

test("a pinned video's exact source survives browsing hubs and expanding back to the player", () => {
  const src = {
    url: "https://fixture.invalid/signed.mp4?token=fixture-only",
    meta: { name: "Synthetic movie" },
  } as unknown as PlayerSrc;
  const dock = { src };
  setHeroDock(dock);
  assert.equal(isHeroDocked(), true);
  assert.equal(getHeroDock()?.src, src);
  for (const hub of ["home", "sports", "live", "movies", "shows", "vod"])
    assert.equal(isHubKind(hub), true);
  // expandDock restores this source to the navigation stack, then clears the dock.
  const restored = getHeroDock()?.src;
  setHeroDock(null);
  markExpandedFromDock(true);
  assert.equal(restored, src);
  assert.equal(wasExpandedFromDock(), true);
  assert.equal(isHeroDocked(), false);
  setHeroDock(dock);
  assert.equal(wasExpandedFromDock(), false);
  setHeroDock(null);
});

test("stopping a pinned video removes the source and unsupported engines stay gated", () => {
  const before = heroDockSupported();
  setHeroDockSupported(false);
  assert.equal(heroDockSupported(), false);
  setHeroDock(null);
  assert.equal(getHeroDock(), null);
  assert.equal(isHubKind(undefined), false);
  assert.equal(isHubKind("settings"), false);
  setHeroDockSupported(before);
});
