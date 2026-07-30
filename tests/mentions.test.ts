import assert from "node:assert/strict";
import test from "node:test";
import { MAX_MENTIONS, mentionToken, scanMentions, segmentMentions } from "../src/lib/social/mentions.ts";
import { renderBbcode } from "../src/lib/social/bbcode.ts";

const withMentions = (body: string) => renderBbcode(body, new Set(scanMentions(body).notified));

const handles = (body: string) => scanMentions(body).notified;
const linked = (body: string) =>
  segmentMentions(body)
    .filter((s) => s.handle !== null)
    .map((s) => s.text);

test("a plain mention resolves", () => {
  assert.deepEqual(handles("@harbor"), ["harbor"]);
  assert.deepEqual(linked("@harbor"), ["@harbor"]);
});

test("a mention mid sentence resolves and keeps the surrounding text", () => {
  const segments = segmentMentions("hey @harbor look at this");
  assert.deepEqual(
    segments.map((s) => [s.text, s.handle]),
    [
      ["hey ", null],
      ["@harbor", "harbor"],
      [" look at this", null],
    ],
  );
});

test("an email address produces no mention", () => {
  assert.deepEqual(handles("mail me at bob@example.com"), []);
  assert.deepEqual(linked("mail me at bob@example.com"), []);
});

test("a url path produces no mention", () => {
  assert.deepEqual(handles("https://harbor.gg/@bob"), []);
  assert.deepEqual(handles("see /u/@bob"), []);
});

test("hyphenated handles resolve, a trailing hyphen is dropped", () => {
  assert.deepEqual(handles("@big-bob-42 says hi"), ["big-bob-42"]);
  assert.deepEqual(linked("@bob- trailing"), ["@bob"]);
});

test("handles shorter than three characters are not mentions", () => {
  assert.deepEqual(handles("@ab"), []);
  assert.deepEqual(handles("@abc"), ["abc"]);
});

test("an over long handle is truncated to twenty four characters", () => {
  assert.deepEqual(handles("@abcdefghijklmnopqrstuvwxyz"), ["abcdefghijklmnopqrstuvwx"]);
  assert.deepEqual(handles(`@${"a".repeat(24)}`), ["a".repeat(24)]);
});

test("only the first five distinct handles are notified", () => {
  const body = "@one-a @two-b @three-c @four-d @five-e @six-f";
  const { notified, ignored } = scanMentions(body);
  assert.equal(notified.length, MAX_MENTIONS);
  assert.deepEqual(notified, ["one-a", "two-b", "three-c", "four-d", "five-e"]);
  assert.deepEqual(ignored, ["six-f"]);
});

test("a mention past the cap is left as plain text", () => {
  const body = "@one-a @two-b @three-c @four-d @five-e @six-f";
  assert.deepEqual(linked(body), ["@one-a", "@two-b", "@three-c", "@four-d", "@five-e"]);
  const tail = segmentMentions(body).at(-1);
  assert.equal(tail?.handle, null);
  assert.equal(tail?.text, " @six-f");
});

test("repeats of one handle are one distinct mention whatever the case", () => {
  const body = "@Bob @bob @BOB @two-b @three-c @four-d @five-e @six-f";
  const { notified, ignored } = scanMentions(body);
  assert.deepEqual(notified, ["bob", "two-b", "three-c", "four-d", "five-e"]);
  assert.deepEqual(ignored, ["six-f"]);
  assert.deepEqual(linked(body), ["@Bob", "@bob", "@BOB", "@two-b", "@three-c", "@four-d", "@five-e"]);
});

test("adjacent punctuation is not part of the handle", () => {
  assert.deepEqual(handles("(@bob), @sue-x! [@kai]"), ["bob", "sue-x", "kai"]);
});

test("a second mention with no separator is not resolved", () => {
  assert.deepEqual(handles("@aaa@bbb"), ["aaa"]);
  assert.deepEqual(handles("_@bob"), []);
});

test("a body with no mentions comes back as one plain segment", () => {
  const body = "nothing to see here";
  assert.deepEqual(segmentMentions(body), [{ text: body, handle: null }]);
  assert.deepEqual(segmentMentions(""), [{ text: "", handle: null }]);
});

test("segments always rebuild the original body", () => {
  for (const body of [
    "@bob hi",
    "hi @bob",
    "a @bob b @sue-x c",
    "bob@example.com and @bob",
    "@one-a @two-b @three-c @four-d @five-e @six-f",
    "",
    "no mentions at all",
  ]) {
    assert.equal(
      segmentMentions(body)
        .map((s) => s.text)
        .join(""),
      body,
    );
  }
});

test("an allowed set keeps a fragment from resolving more than the whole body did", () => {
  const live = new Set(["bob"]);
  assert.deepEqual(
    segmentMentions("@bob and @sue-x", live).map((s) => s.handle),
    ["bob", null],
  );
});

test("bbcode marks a mention with a data attribute the view can delegate from", () => {
  const html = withMentions("hi @bob-smith");
  assert.match(html, /<span data-harbor-mention="bob-smith"[^>]*>@bob-smith<\/span>/);
  assert.match(html, /var\(--color-accent\)/);
});

test("bbcode leaves mentions alone unless the caller opts in", () => {
  assert.equal(renderBbcode("hi @bob-smith"), "hi @bob-smith");
});

test("bbcode never emits an unescaped mention body", () => {
  const html = withMentions('<img src=x onerror=alert(1)> @bob-smith "quoted"');
  assert.equal(html.includes("<img"), false);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot;quoted&quot;/);
});

test("bbcode does not link a mention inside code or a url path", () => {
  assert.equal(withMentions("[code]@bob-smith[/code]").includes("data-harbor-mention"), false);
  assert.equal(withMentions("https://harbor.gg/@bob-smith").includes("data-harbor-mention"), false);
});

test("the composer token follows the same preceding character rule", () => {
  assert.deepEqual(mentionToken("hi @bo", 6), { start: 3, query: "bo" });
  assert.deepEqual(mentionToken("@", 1), { start: 0, query: "" });
  assert.equal(mentionToken("bob@ex", 6), null);
  assert.equal(mentionToken("https://x.gg/@bo", 16), null);
  assert.equal(mentionToken("hi @bob there", 13), null);
  assert.equal(mentionToken(`@${"a".repeat(25)}`, 26), null);
});
