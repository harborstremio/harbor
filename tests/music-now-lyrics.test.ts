// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const TSX = readFileSync("src/components/music/music-now-playing.tsx", "utf8");
const CSS = readFileSync("src/components/music/music-now-playing.css", "utf8");
const LOCALES = [
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

const GUARD = "if (!current || !display) return null;";

function optionsRow(): string {
  const at = TSX.indexOf('<div className="music-now-options">');
  assert.ok(at > 0, "expected the header options row");
  return TSX.slice(at, TSX.indexOf("</div>", at));
}

function follower(): string {
  const scroll = TSX.indexOf("list.scrollTo(");
  assert.ok(scroll > 0, "expected the lyrics follower to scroll its own list");
  const start = TSX.lastIndexOf("useEffect(() => {", scroll);
  const end = TSX.indexOf("\n  }, [", scroll);
  assert.ok(start > 0 && end > start, "expected the follower to live in its own effect");
  return TSX.slice(start, end);
}

function rule(selector: string): string {
  const base = CSS.slice(0, CSS.indexOf("@container"));
  const at = base.indexOf(`\n${selector} {`);
  return at < 0 ? "" : base.slice(at + 1, base.indexOf("}", at));
}

test("Karaoke sits in the header options row beside the visualizer", () => {
  const row = optionsRow();
  const visualizer = row.indexOf("music.now.visualizer");
  const karaoke = row.indexOf('t("Karaoke")');
  assert.ok(visualizer > 0, "visualizer button must stay in the options row");
  assert.ok(karaoke > visualizer, "the Karaoke button belongs after the visualizer button");
});

test("the Karaoke button keeps the shape the other option buttons use", () => {
  const row = optionsRow();
  const button = row.slice(row.lastIndexOf("<button", row.indexOf('t("Karaoke")')));
  assert.match(button, /type="button"/);
  assert.match(button, /aria-pressed=\{karaoke\}/);
  assert.match(button, /title=\{t\("Karaoke"\)\}/);
  assert.match(button, /size=\{17\}/);
  assert.match(button, /<span>\{t\("Karaoke"\)\}<\/span>/);
});

test("Karaoke is transient local state, never a persisted appearance flag", () => {
  assert.match(TSX, /useState\(false\);?\s*$/m);
  assert.match(TSX, /setKaraoke\(/);
  assert.ok(
    !/setMusicAppearance\(\{[^}]*karaoke/i.test(TSX),
    "karaoke must not be written into appearance preferences",
  );
});

test("the karaoke view is rendered on the shared contract", () => {
  assert.match(TSX, /import \{ MusicKaraoke \} from "\.\/music-karaoke"/);
  assert.match(TSX, /<MusicKaraoke open=\{karaoke\} onClose=\{\(\) => setKaraoke\(false\)\} \/>/);
});

test("lyrics is a member of the tab array, so it inherits the roving tabindex", () => {
  const array = /\(\[([^\]]*)\] as const\)\.map\(\(id, index, ids\)/.exec(TSX);
  assert.ok(array, "expected the tab id array feeding the tablist");
  const ids = array[1].split(",").map((part) => part.trim().replace(/"/g, ""));
  assert.ok(ids.includes("lyrics"), `lyrics must be a tab, got ${ids.join(", ")}`);
  assert.ok(
    ids.includes("queue") && ids.includes("about") && ids.includes("signal"),
    "the existing tabs must survive",
  );
});

test("the lyrics panel reads the live engine rather than its own copy", () => {
  assert.match(
    TSX,
    /import \{ loadTrackLyrics, lyricIndexAt, type LyricLine \} from "@\/lib\/music\/lyrics"/,
  );
  assert.match(TSX, /loadTrackLyrics\(current\)/);
  assert.match(TSX, /lyricIndexAt\(lyrics, [^)]*player\.currentTime/);
});

test("the panel covers loading, empty and ready without stranding the user", () => {
  assert.match(TSX, /setLyricsState\("loading"\)/);
  assert.match(
    TSX,
    /t\(\s*lyricsState === "loading" \? "Finding lyrics" : "No lyrics for this track",?\s*\)/,
  );
  assert.ok(
    /setTimeout\([\s\S]{0,160}?setLyricsState/.test(TSX),
    "the wait must be bounded so a hung request still resolves the panel",
  );
});

test("clicking a line seeks the player", () => {
  assert.match(TSX, /import \{[^}]*\bseekMusic\b[^}]*\} from "@\/lib\/music\/player"/);
  assert.match(TSX, /onClick=\{\(\) => seekMusic\(line\.at\)\}/);
});

test("the active line follows playback by scrolling its own list, not the pull-out", () => {
  assert.match(TSX, /lyricsRef\.current/);
  assert.match(follower(), /list\.scrollTo\(/);
  assert.ok(!TSX.includes("scrollIntoView"), "scrollIntoView would drag the whole pull-out");
  assert.match(rule(".music-now-lyrics"), /overflow-y\s*:\s*auto/);
});

test("the scroll target is measured inside the list, not inside the pull-out", () => {
  const scoped = /position\s*:\s*relative/.test(rule(".music-now-lyrics"));
  const offsetBased = /\.offsetTop/.test(follower());
  assert.ok(
    !offsetBased || scoped,
    "offsetTop resolves against the nearest positioned ancestor, which is the fixed pull-out unless .music-now-lyrics establishes its own positioning context",
  );
});

test("with nothing sung yet the list returns to the first line", () => {
  const effect = follower();
  assert.ok(
    !/activeLyric < 0\)\s*return;/.test(effect),
    "bailing out early keeps the previous track's scroll position",
  );
  assert.ok(
    /scrollTo\(\{\s*top:\s*0\b/.test(effect),
    `the list must go back to the top before the first lyric, got ${effect}`,
  );
});

test("no hook was added below this component's early return", () => {
  const at = TSX.indexOf(GUARD);
  assert.ok(at > 0, `expected the guard ${GUARD}`);
  const after = TSX.slice(at + GUARD.length);
  const hook = /\buse[A-Z]\w*\s*\(/.exec(after);
  assert.equal(
    hook,
    null,
    `hook ${hook?.[0] ?? ""} sits below the early return and will break the hook order`,
  );
});

test("lyric lines clear the 44px target floor", () => {
  const button = rule(".music-now-lyrics button");
  assert.ok(
    /min-height\s*:\s*4[4-9]px|min-height\s*:\s*[5-9]\dpx/.test(button),
    `lyric lines must be tappable, got ${button}`,
  );
});

test("reduced motion is respected by the lyric transition", () => {
  const reduced = CSS.slice(CSS.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/));
  assert.match(reduced, /\.music-now-lyrics button\s*\{\s*transition:\s*none;?\s*\}/);
});

test("Karaoke is present in every locale and written in each script", () => {
  const nonLatin = ["ar", "hi", "ja", "ko", "ru", "zh"];
  for (const lang of LOCALES) {
    const source = readFileSync(`src/lib/i18n/locales/${lang}/music.ts`, "utf8");
    const found = /"?Karaoke"?:\s*"([^"]+)"/.exec(source);
    assert.ok(found, `${lang} is missing the Karaoke label`);
    const localised = [...found[1]].some((char) => (char.codePointAt(0) ?? 0) > 127);
    if (nonLatin.includes(lang))
      assert.ok(localised, `${lang} left the Karaoke label in Latin script: ${found[1]}`);
  }
});

test("the lyric strings reuse keys every locale already carries", () => {
  for (const lang of LOCALES) {
    const source = readFileSync(`src/lib/i18n/locales/${lang}/music.ts`, "utf8");
    for (const key of ["Lyrics", "Finding lyrics", "No lyrics for this track"]) {
      assert.ok(new RegExp(`"?${key}"?:`).test(source), `${lang} is missing ${key}`);
    }
  }
});
