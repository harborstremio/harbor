import test from "node:test";
import assert from "node:assert/strict";
import {
  navigateUnderPreview,
  previewPageStack,
  preservePreviewMode,
  withoutTrailingPlayers,
} from "../src/lib/player/docked-navigation.ts";
import { playerLoadIdentity } from "../src/lib/player/load-identity.ts";
import { liveChannelSource } from "../src/lib/iptv/playback-source.ts";
import type { Frame, PlayerSrc } from "../src/lib/view.ts";

const source = liveChannelSource({
  id: "qa",
  name: "QA",
  url: "https://example.com/live",
  tvgId: null,
  logo: null,
  group: null,
  catchupSource: null,
  durationSec: null,
  attrs: {
    "vlcopt-user-agent": "HarborQA",
    "vlcopt-referrer": "https://example.com/",
  },
});
test("channel changes replace stacked playback while preserving the match underneath", () => {
  const match = { kind: "match-detail", game: {} } as Frame;
  const stack: Frame[] = [
    { kind: "sports" },
    match,
    { kind: "player", src: source },
    { kind: "player", src: source },
  ];
  assert.deepEqual(withoutTrailingPlayers(stack), stack.slice(0, 2));
  assert.equal(stack.length, 4);
  assert.equal(withoutTrailingPlayers(stack).at(-1), match);
});
test("Live TV source settings survive docking; changes in channel, headers or retry trigger loading", () => {
  assert.equal(source.notWebReady, true);
  assert.equal(source.isLive, true);
  assert.equal(source.headers?.["User-Agent"], "HarborQA");
  const key = (src: PlayerSrc) => playerLoadIdentity(src, src.url);
  assert.equal(key(source), key({ ...source, sportsDocked: true }));
  assert.notEqual(key(source), key({ ...source, meta: { ...source.meta, id: "iptv:other" } }));
  assert.notEqual(key(source), key({ ...source, headers: { "User-Agent": "Different" } }));
  assert.notEqual(key(source), key({ ...source, attempt: 1 }));
});

test("preview expand and return preserve playback identity and channel changes preserve presentation", () => {
  const preview = { ...source, sportsDocked: true };
  const expanded = { ...preview, sportsDocked: false };
  const restored = { ...expanded, sportsDocked: true };
  const key = (src: PlayerSrc) => playerLoadIdentity(src, src.url);
  assert.equal(key(preview), key(expanded));
  assert.equal(key(restored), key(preview));
  const next = { ...source, url: "https://example.com/channel-b" };
  assert.equal(preservePreviewMode(expanded, next).sportsDocked, false);
  assert.equal(preservePreviewMode(preview, next).sportsDocked, true);
  assert.equal(preservePreviewMode(expanded, preview).sportsDocked, false);
  assert.equal(preservePreviewMode(source, next), next);
});

test("reading navigation and history retain the exact docked stream session", () => {
  const dock: Frame = { kind: "player", src: { ...source, sportsDocked: true } };
  const initial: Frame[] = [{ kind: "sports" }, dock];
  const manga = navigateUnderPreview(initial, () => [{ kind: "manga" }]);
  assert.equal(manga.at(-1), dock);
  assert.deepEqual(previewPageStack(manga), [{ kind: "manga" }]);
  const book = navigateUnderPreview(manga, (pages) => [
    ...pages,
    { kind: "ebook", ebookId: "book" },
  ]);
  assert.equal(book.at(-1), dock);
  const back = navigateUnderPreview(book, (pages) => pages.slice(0, -1));
  assert.deepEqual(back, manga);
  const forward = navigateUnderPreview(back, (pages) => [...pages, previewPageStack(book).at(-1)!]);
  assert.deepEqual(forward, book);
  assert.equal(
    navigateUnderPreview(forward, (pages) => pages),
    forward,
  );
  assert.deepEqual(initial, [{ kind: "sports" }, dock]);
});

test("new playback replaces the dock and normal full-screen playback retains navigation semantics", () => {
  const dock: Frame = { kind: "player", src: { ...source, sportsDocked: true } };
  const next: Frame = { kind: "player", src: { ...source, url: "https://example.com/next" } };
  assert.deepEqual(
    navigateUnderPreview([{ kind: "manga" }, dock], (pages) => [...pages, next]),
    [{ kind: "manga" }, next],
  );
  const full: Frame[] = [
    { kind: "manga" },
    { kind: "player", src: { ...source, sportsDocked: false } },
  ];
  assert.equal(previewPageStack(full), full);
  assert.deepEqual(
    navigateUnderPreview(full, (pages) => pages.slice(0, -1)),
    [{ kind: "manga" }],
  );
});
