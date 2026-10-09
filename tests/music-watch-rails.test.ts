const compactCss = (value: string) =>
  value
    .replace(/\s*([{}:;,/])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/@media\s+\(/g, "@media(")
    .replace(/;}/g, "}");
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MusicQueueOrder } from "../src/lib/music/queue-order";
import type { MusicTrack } from "../src/lib/music/types";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const watchTsx = read("../src/components/music/music-watch.tsx");
const watchCss = compactCss(read("../src/components/music/music-watch.css"));
const langs = [
  "ar",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "ru",
  "tr",
  "vi",
  "zh",
];
const label = (lang: string, key: string) => {
  const source =
    read(`../src/lib/i18n/locales/${lang}/music-videos.ts`) +
    read(`../src/lib/i18n/locales/${lang}/music-queue.ts`);
  return new RegExp(`"${key.replace(/\./g, "\\.")}":\\s*"([^"]*)"`).exec(source)?.[1] ?? null;
};

const track = (id: string, mediaKind: "audio" | "video" = "video"): MusicTrack => ({
  id,
  title: `Title ${id}`,
  artist: `Artist ${id}`,
  artwork: "",
  durationSeconds: 180,
  durationLabel: "3:00",
  mediaKind,
});

const off = { shuffle: false, repeat: "off" as const };
const one = (order: MusicQueueOrder, queue: MusicTrack[], index: number, modes = off) =>
  order.upcoming(queue, index, modes, 1)[0] ?? null;

test("Up next takes the real next queue entry, not a search result", () => {
  const queue = [track("a"), track("b"), track("c")];
  assert.equal(one(new MusicQueueOrder(), queue, 0)?.id, "b");
  assert.equal(one(new MusicQueueOrder(), queue, 1)?.id, "c");
});

test("an empty queue or a last-position index yields nothing to render", () => {
  assert.equal(one(new MusicQueueOrder(), [], 0), null);
  assert.equal(one(new MusicQueueOrder(), [], -1), null);
  const queue = [track("a"), track("b")];
  assert.equal(one(new MusicQueueOrder(), queue, 1), null);
  assert.equal(one(new MusicQueueOrder(), [track("a")], 0), null);
});

test("repeat-one has no next entry because the current video plays again", () => {
  const queue = [track("a"), track("b")];
  assert.equal(one(new MusicQueueOrder(), queue, 0, { shuffle: false, repeat: "one" }), null);
});

test("repeat-all wraps to the head of the queue from the last position", () => {
  const queue = [track("a"), track("b"), track("c")];
  assert.equal(one(new MusicQueueOrder(), queue, 2, { shuffle: false, repeat: "all" })?.id, "a");
});

test("what Up next shows is what advancing actually plays, shuffle included", () => {
  const queue = [track("a"), track("b"), track("c"), track("d"), track("e")];
  const modes = { shuffle: true, repeat: "off" as const };
  const order = new MusicQueueOrder();
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const shown = order.upcoming(queue, 0, modes, 1, random)[0];
  assert.ok(shown);
  assert.notEqual(shown.id, "a");
  assert.equal(order.next(queue, 0, modes, true, null, random)?.id, shown.id);
});

test("the queue entry may be a song, so its kind is labelled rather than assumed", () => {
  const queue = [track("a"), track("b", "audio")];
  assert.equal(one(new MusicQueueOrder(), queue, 0)?.mediaKind, "audio");
  assert.match(watchTsx, /<VideoNext item=\{queueUpNext\} queue=\{player\.queue\} badge \/>/);
  assert.match(watchTsx, /\{badge && <MusicMediaBadge kind=\{item\.mediaKind\} compact \/>\}/);
});

test("the music video page reads the same queue source the now-playing pull-out reads", () => {
  assert.match(watchTsx, /import \{ musicUpcoming, useMusicTransport \} from "\.\/music-queue"/);
  assert.match(
    watchTsx,
    /const queueUpNext = musicUpcoming\(player\.queue, player\.queueIndex, 1\)\[0\] \?\? null;/,
  );
  assert.match(watchTsx, /useMusicTransport\(\);/);
});

test("Up next renders nothing at all when there is no next entry, never a bare heading", () => {
  const aside = watchTsx.slice(
    watchTsx.indexOf('<aside className="music-watch-next">'),
    watchTsx.indexOf("</aside>"),
  );
  assert.match(aside, /\{queueUpNext && \(/);
  const guard = aside.indexOf("{queueUpNext && (");
  assert.ok(guard !== -1 && guard < aside.indexOf('t("music.row.upNext")'));
});

test("a singular Up next sits above the related rail, which is now After that", () => {
  const aside = watchTsx.slice(
    watchTsx.indexOf('<aside className="music-watch-next">'),
    watchTsx.indexOf("</aside>"),
  );
  assert.ok(aside.indexOf('t("music.row.upNext")') < aside.indexOf('t("music.videos.next")'));
  assert.equal((aside.match(/t\("music\.row\.upNext"\)/g) ?? []).length, 1);
  assert.equal(label("en", "music.videos.next"), "After that");
  assert.equal(label("en", "music.row.upNext"), "Up next");
});

test("both rail labels ship translated in every language rather than English", () => {
  for (const lang of langs) {
    const after = label(lang, "music.videos.next");
    const upNext = label(lang, "music.row.upNext");
    assert.ok(after, `${lang} is missing music.videos.next`);
    assert.ok(upNext, `${lang} is missing music.row.upNext`);
    assert.notEqual(after, upNext, `${lang} gives both rails the same label`);
    if (lang !== "en") {
      assert.notEqual(after, "After that", `${lang} still carries the English After that`);
      assert.notEqual(upNext, "Up next", `${lang} still carries the English Up next`);
    }
  }
});

test("the two headings share one rule so the rails read as one column", () => {
  assert.equal((watchTsx.match(/className="music-watch-next-heading"/g) ?? []).length, 2);
  assert.match(watchCss, /\.music-watch-next-heading\{[^}]*font-size:13px/);
  assert.match(watchCss, /\.music-watch-up-next\{[^}]*border-bottom:/);
  assert.doesNotMatch(watchTsx, /text-\[13px\] font-medium uppercase/);
});

test("the loading skeletons still belong to the related rail alone", () => {
  assert.match(watchTsx, /\{busy && \(\s*<ul className="music-watch-next-list"/);
  assert.match(watchTsx, /similarBusy \? \(/);
  assert.match(watchTsx, /function VideoNextSkeleton/);
});

test("the entry shown as Up next is not repeated as the first row of After that", () => {
  assert.match(
    watchTsx,
    /const related = queueUpNext\s*\? similar\.filter\(\(?item\)? => searchTrackKey\(item\) !== searchTrackKey\(queueUpNext\)\)\s*: similar;/,
  );
  assert.match(watchTsx, /const upNext = related\.slice\(0, 4\);/);
  assert.match(watchTsx, /const moreVideos = related\.slice\(4\);/);
  assert.doesNotMatch(
    watchTsx,
    /queue=\{similar\}/,
    "the rails must queue the list they display, or clicking row two skips a video",
  );
});

test("both rails identify a track the way the rest of music search does", () => {
  assert.match(watchTsx, /import \{ searchTrackKey \} from "@\/lib\/music\/now-search";/);
});
