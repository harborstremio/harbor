// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { stripSdhText } from "../src/lib/subtitles/sdh-filter.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("bracketed sound descriptions go, but only in latin script", () => {
  assert.equal(stripSdhText("[door creaks]"), "");
  assert.equal(stripSdhText("[DOOR CREAKS]"), "");
  assert.equal(stripSdhText("[скрип двери]"), "[скрип двери]");
  assert.equal(stripSdhText("[موسيقى حزينة]"), "[موسيقى حزينة]");
  assert.equal(stripSdhText("[הדלת חורקת]"), "[הדלת חורקת]");
  assert.equal(stripSdhText("[歌詞]"), "[歌詞]");
  assert.equal(stripSdhText("[music] [more]"), "");
  assert.equal(stripSdhText("- [door slams]"), "");
  assert.equal(stripSdhText("[door creaks] {whispered dialogue}"), "{whispered dialogue}");
  assert.equal(stripSdhText("[a] mid [b] line"), "mid line");
});

test("all-caps latin speaker labels go, and nothing else that ends in a colon does", () => {
  assert.equal(stripSdhText("JOHN: I told you so."), "I told you so.");
  assert.equal(stripSdhText("JOHN AND MARY: hello"), "hello");
  assert.equal(stripSdhText("MAN #2: over here"), "over here");
  assert.equal(stripSdhText("MAN ON TV: The storm."), "The storm.");
  assert.equal(stripSdhText("- JOHN: Hi."), "- Hi.");
  assert.equal(stripSdhText("OK: fine"), "fine");
  assert.equal(stripSdhText("MAN: (angrily) Get out!"), "(angrily) Get out!");

  assert.equal(stripSdhText("john: lowercase speaker"), "john: lowercase speaker");
  assert.equal(stripSdhText("Dr. Smith: hello there"), "Dr. Smith: hello there");
  assert.equal(stripSdhText("Note: bring the keys."), "Note: bring the keys.");
  assert.equal(stripSdhText("Chapter 3: The Reckoning"), "Chapter 3: The Reckoning");
  assert.equal(stripSdhText("The score was 3:1 at half."), "The score was 3:1 at half.");
  assert.equal(stripSdhText("Meet me at 10:30 tonight."), "Meet me at 10:30 tonight.");
  assert.equal(stripSdhText("Visit https://harbor.tv now."), "Visit https://harbor.tv now.");
});

test("shouting is not a speaker label", () => {
  assert.equal(stripSdhText("STOP THE CAR RIGHT NOW"), "STOP THE CAR RIGHT NOW");
  assert.equal(stripSdhText("I SAID NO!"), "I SAID NO!");
  assert.equal(stripSdhText("THE END"), "THE END");
  assert.equal(stripSdhText("NASA sent a probe."), "NASA sent a probe.");
  assert.equal(stripSdhText("НЕТ! Я НЕ ПОЙДУ!"), "НЕТ! Я НЕ ПОЙДУ!");
});

test("the all-caps rule is ascii only, so non-latin speaker labels survive untouched", () => {
  assert.equal(stripSdhText("МАША: Привет"), "МАША: Привет");
  assert.equal(stripSdhText("ПЁТР: Привет"), "ПЁТР: Привет");
  assert.equal(stripSdhText("أحمد: أين أنت؟"), "أحمد: أين أنت؟");
  assert.equal(stripSdhText("דוד: בוא הנה"), "דוד: בוא הנה");
  assert.equal(stripSdhText("田中：こっちへ来い。"), "田中：こっちへ来い。");
  assert.equal(stripSdhText("李明：你在哪里？"), "李明：你在哪里？");
  assert.equal(stripSdhText("こんにちは"), "こんにちは");
  assert.equal(stripSdhText("مرحبا يا صديقي"), "مرحبا يا صديقي");
});

test("parentheses only go when the content is shouted latin, so real asides survive", () => {
  assert.equal(stripSdhText("(OMINOUS MUSIC)"), "");
  assert.equal(stripSdhText("he said (MUSIC) loudly"), "he said (MUSIC) loudly");
  assert.equal(stripSdhText("(A) start"), "start");

  assert.equal(stripSdhText("(ominous music)"), "(ominous music)");
  assert.equal(stripSdhText("(Ominous music)"), "(Ominous music)");
  assert.equal(stripSdhText("(He walks in slowly.)"), "(He walks in slowly.)");
  assert.equal(stripSdhText("Il a dit (bonjour) fort"), "Il a dit (bonjour) fort");
  assert.equal(stripSdhText("(музыка)"), "(музыка)");
  assert.equal(stripSdhText("(歌詞)"), "(歌詞)");
  assert.equal(stripSdhText("（ドアの音）"), "（ドアの音）");
  assert.equal(stripSdhText("【重要】"), "【重要】");
  assert.equal(stripSdhText("Text with (unclosed paren"), "Text with (unclosed paren");
});

test("song lyrics are the film, not furniture, so music notes are never touched", () => {
  const lyric = "♪ Hello darkness my old friend ♪";
  assert.equal(stripSdhText(lyric), lyric);
  assert.equal(stripSdhText("♪ 今日はいい天気 ♪"), "♪ 今日はいい天気 ♪");
  assert.equal(stripSdhText("♪ (music) ♪"), "♪ (music) ♪");
  assert.equal(stripSdhText("♪♪♪"), "♪♪♪");
});

test("multi-line cues drop only the lines that empty out", () => {
  assert.equal(stripSdhText("[door creaks]\nHello there"), "Hello there");
  assert.equal(stripSdhText("[DOOR CREAKS]\n[WIND HOWLS]"), "");
  assert.equal(stripSdhText("JOHN:\nI told you so."), "I told you so.");
  assert.equal(stripSdhText("- JOHN: Hi.\n- MARY: Bye."), "- Hi.\n- Bye.");
  assert.equal(stripSdhText("[sighs]\nJOHN: Fine.\n(quietly) Go."), "Fine.\n(quietly) Go.");
});

test("a line that keeps any real character is kept, orphan punctuation and all", () => {
  assert.equal(stripSdhText("Meet me at [REDACTED]."), "Meet me at .");
  assert.equal(stripSdhText("MAN (V.O.): Long ago."), "MAN (V.O.): Long ago.");
  assert.equal(stripSdhText("— SFX: [glass shatters]"), "— SFX:");
  assert.equal(stripSdhText("1. Numbered list item"), "1. Numbered list item");
});

test("empty and absent input round-trips rather than throwing", () => {
  assert.equal(stripSdhText(""), "");
  assert.equal(stripSdhText("   "), "");
  assert.equal(stripSdhText("\n\n"), "");
});

test("the filter never invents ass override tags or eats existing ones", () => {
  assert.equal(stripSdhText("{\\an8}[wind howls] top"), "{\\an8} top");
  assert.equal(stripSdhText("{\\k50}La {\\k50}la ♪"), "{\\k50}La {\\k50}la ♪");
});

test("the html5 engine strips at read time and never mutates the parsed cue model", () => {
  const bridge = read("src/lib/player/html5/bridge.ts");
  assert.match(bridge, /import \{ stripSdhText \} from "@\/lib\/subtitles\/sdh-filter"/);
  assert.match(bridge, /hideSdh \? stripSdhText\(/);
  assert.doesNotMatch(bridge, /\.cues = .*stripSdhText/);

  const parser = read("src/lib/subtitles/parser.ts");
  assert.doesNotMatch(parser, /stripSdhText/);
  const prepare = read("src/lib/subtitles/prepare.ts");
  assert.doesNotMatch(prepare, /stripSdhText/);
  const textSync = read("src/views/player/text-sync-list.tsx");
  assert.doesNotMatch(textSync, /stripSdhText/);
});

test("mpv gets the safe filter level only, and never a rewritten enclosure list", () => {
  const style = read("src/lib/player/sub-style.ts");
  assert.match(style, /\["sub-filter-sdh", /);
  assert.match(style, /\["sub-filter-sdh-harder", false\]/);
  assert.doesNotMatch(style, /sub-filter-sdh-enclosures/);
  assert.doesNotMatch(style, /sub-filter-regex/);
});

test("the setting is off by default and gated off for forced and foreign-only tracks", () => {
  const defaults = read("src/lib/settings/defaults.ts");
  assert.match(defaults, /subHideSdh: false,/);
  const media = read("src/views/player/hooks/use-player-media.ts");
  assert.match(media, /sdhFilterAllowed/);
  assert.match(media, /!selectedSubTrack\?\.forced/);
  assert.match(media, /!selectedSubTrack\?\.foreignOnly/);
  assert.match(media, /sdhSafeForLanguage\(selectedSubTrack\?\.lang\)/);
});
