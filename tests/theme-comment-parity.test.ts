// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const store = "src/views/settings/theme-panel/custom-themes-section/community-store";
const render = read(`${store}/comments/comment-render.tsx`);
const item = read(`${store}/comments/comment-item.tsx`);
const profile = read("src/views/profile/comment-item.tsx");

test("theme comments linkify mentions like profile comments do", () => {
  assert.match(render, /segmentMentions/, "mentions must be segmented");
  assert.match(render, /<MentionLink key=\{i\} handle=\{seg\.handle\}/);
  assert.match(profile, /<MentionLink/, "profile is the parity target");
});

test("theme comments mask profanity like profile comments do", () => {
  assert.match(render, /segmentProfanity/);
  assert.match(render, /blur-\[5px\]/, "masked text uses the same blur treatment");
});

test("mentions survive inside bbcode formatting", () => {
  assert.match(render, /case "text":\s*return <TextRun key=\{i\} v=\{n\.v\} \/>;/);
  assert.doesNotMatch(
    render,
    /case "text":\s*return <span key=\{i\}>\{n\.v\}<\/span>;/,
    "raw text nodes would skip mention parsing",
  );
});

test("the author is clickable and hoverable in both surfaces", () => {
  for (const [name, src] of [["theme", item], ["profile", profile]] as const) {
    assert.match(src, /UserHoverCard/, `${name} comments need a hover card`);
    assert.match(src, /Avatar/, `${name} comments need an avatar`);
  }
  assert.match(item, /requestOpenProfile\(handle\)/, "clicking the theme author opens their profile");
});

test("the theme comment type carries the fields the server now returns", () => {
  const types = read("src/lib/theme-store.ts");
  assert.match(types, /authorHandle\?: string \| null;/);
  assert.match(types, /authorAvatar\?: string \| null;/);
  assert.match(types, /authorHandle: typeof c\.authorHandle === "string" \? c\.authorHandle : null/);
});
