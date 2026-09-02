// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import "./_localstorage-stub.ts";
import {
  matchesThemeBehavior,
  themeBehavior,
} from "../src/views/settings/theme-panel/custom-themes-section/community-store/theme-behavior-filter.ts";

// The presence helpers are pure, but their production module also imports the
// API client (which expects Vite's import.meta.env). Compile the real source
// without those imports so Node can exercise the helpers themselves.
const presenceSource = readFileSync(
  new URL("../src/lib/social/presence.ts", import.meta.url),
  "utf8",
).replace(/^import[^\n]+;\r?\n/gm, "");
const compiledPresence = ts.transpileModule(presenceSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const presenceModule = await import(
  `data:text/javascript;charset=utf-8,${encodeURIComponent(compiledPresence)}`
);
const resolvePresence = presenceModule.resolvePresence as (
  value: unknown,
  online?: boolean,
) => "online" | "away" | "dnd" | "offline";
const presenceStatusLabel = presenceModule.presenceStatusLabel as (
  value: "online" | "away" | "dnd" | "offline",
) => string;

const friendsPanel = readFileSync(
  new URL("../src/views/profile/friends-panel.tsx", import.meta.url),
  "utf8",
);
const userHoverCard = readFileSync(
  new URL("../src/views/profile/user-hover-card.tsx", import.meta.url),
  "utf8",
);

test("legacy and absent layouts map to their effective theme behavior", () => {
  for (const layout of [null, undefined, "", "sidebar", "dracula", "nord", "forest"]) {
    assert.equal(themeBehavior(layout), "sidebar", `${String(layout)} should use the sidebar`);
  }
  assert.equal(themeBehavior("royal"), "topdock");
});

test("direct theme behaviors retain their own filter identity", () => {
  for (const behavior of [
    "sidebar",
    "topdock",
    "rail",
    "stremio",
    "minui",
    "cinematic",
    "custom",
  ] as const) {
    assert.equal(themeBehavior(behavior), behavior);
    assert.equal(matchesThemeBehavior(behavior, behavior), true);
  }
  assert.equal(themeBehavior("unknown-layout"), null);
});

test("explicit presence wins over a stale online compatibility boolean", () => {
  assert.equal(resolvePresence("offline", true), "offline");
  assert.equal(resolvePresence("online", false), "online");
  assert.equal(resolvePresence("away", false), "away");
  assert.equal(resolvePresence("dnd", true), "dnd");
  assert.equal(resolvePresence(undefined, true), "online");
  assert.equal(resolvePresence(undefined, false), "offline");
});

test("offline presence is described as state, not as the owner's visibility action", () => {
  assert.equal(presenceStatusLabel("offline"), "Offline");
  assert.match(userHoverCard, /presenceStatusLabel\(presence\)/);
});

test("friends are counted, ordered, and grouped through resolved presence", () => {
  assert.match(friendsPanel, /function friendIsOnline[\s\S]*friendPresence\(f\) !== "offline"/);
  assert.match(friendsPanel, /const online = friends\.filter\(friendIsOnline\)/);
  assert.match(friendsPanel, /const offline = friends\.filter\(\(f\) => !friendIsOnline\(f\)\)/);
  assert.match(friendsPanel, /const vOnline = visible\.filter\(friendIsOnline\)/);
  assert.match(friendsPanel, /const vOffline = visible\.filter\(\(f\) => !friendIsOnline\(f\)\)/);
  assert.doesNotMatch(friendsPanel, /filter\(\(f\) => !?f\.online\)/);
});
