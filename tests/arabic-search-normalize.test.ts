// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { arabicAwareMatch, normalizeArabic } from "../src/lib/iptv/rtl.ts";

const QUERY = "الدم المشروك";
const q = normalizeArabic(QUERY);

const DIRTY_TITLES: Array<[string, string]> = [
  ["exact", "الدم المشروك"],
  ["provider prefix", "AR | الدم المشروك"],
  ["harakat", "الدَّم المشروك"],
  ["tatweel", "الدم المشـــروك"],
  ["hamza alef", "أالدم المشروك"],
  ["rlm mark", "‏الدم المشروك"],
  ["lrm between words", "الدم‎ المشروك"],
  ["zero width space", "الدم المش​روك"],
  ["non breaking space", "الدم المشروك"],
  ["decomposed", "الدم المشروك".normalize("NFD")],
  ["double space", "الدم  المشروك"],
];

for (const [label, title] of DIRTY_TITLES) {
  test(`iptv search finds an arabic title with ${label}`, () => {
    assert.ok(normalizeArabic(title).includes(q), `"${title}" should match "${QUERY}"`);
  });
}

test("unrelated titles still do not match", () => {
  assert.ok(!normalizeArabic("مسلسل آخر تماما").includes(q));
  assert.ok(!normalizeArabic("Breaking Bad S01").includes(q));
});

test("arabic-indic digits fold to ascii so year searches work", () => {
  assert.ok(normalizeArabic("فيلم ٢٠٢٤").includes(normalizeArabic("2024")));
});

test("live tv channel search shares the same normalizer", () => {
  assert.ok(arabicAwareMatch("قناة‏  الجزيرة", normalizeArabic("الجزيره")));
});

test("the vod library search normalizes instead of raw lowercase", () => {
  const src = readFileSync(new URL("../src/views/playlist-vod.tsx", import.meta.url), "utf8");
  assert.match(src, /normalizeArabic\(deferredQuery\)/, "the query must be normalized");
  assert.doesNotMatch(
    src,
    /m\.title\.toLowerCase\(\)\.includes/,
    "raw lowercase substring match cannot find arabic titles",
  );
  assert.match(src, /movieIndex = useMemo/, "titles are normalized once, not per keystroke");
});
