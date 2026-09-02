// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { filterTracksByPreferredLanguage, isKnownLanguage } from "../src/lib/subtitles/language.ts";
import { subtitleLanguage } from "../src/lib/local-library/player-src.ts";

const src = readFileSync(
  new URL("../src/lib/subtitles/providers/addons.ts", import.meta.url),
  "utf8",
);

test("an addon that declares subtitles is never dropped for manifest metadata", () => {
  assert.match(src, /function declaresSubtitles/, "needs a resource-level check");
  assert.match(
    src,
    /if \(!declaresSubtitles\(addon\)\) return null;/,
    "only addons without the subtitles resource may be skipped",
  );
  const pick = src.slice(src.indexOf("function pickAddonId"), src.indexOf("function extraSegment"));
  const lastReturn = pick.lastIndexOf("return best;");
  assert.ok(lastReturn > 0, "pickAddonId must fall through to a best-effort id");
});

test("the strict manifest match is still tried first", () => {
  const pick = src.slice(src.indexOf("function pickAddonId"), src.indexOf("function extraSegment"));
  const strict = pick.indexOf("addonAccepts(addon");
  const permissive = pick.indexOf("declaresSubtitles(addon)");
  assert.ok(strict >= 0 && permissive >= 0);
  assert.ok(strict < permissive, "advertised ids must win before falling back");
});

test("addons providing no subtitles resource are still excluded", () => {
  assert.match(src, /if \(!declaresSubtitles\(addon\)\) return null;/);
});

const modal = readFileSync(
  new URL("../src/components/player/subtitle-menu/search-section.tsx", import.meta.url),
  "utf8",
);

test("the player subtitle modal passes the playing content ids to addons", () => {
  assert.match(
    modal,
    /candidateIds: playing\?\.candidateIds/,
    "anime and non-imdb ids must reach addons",
  );
  assert.match(modal, /stremioId: playing\?\.stremioId/, "stremioId is the addon fallback id");
});

test("the modal only reuses playing ids when the target is what is playing", () => {
  assert.match(modal, /isPlayingTarget\(tgt, playingTarget\) \? playbackContext : null/);
  assert.doesNotMatch(
    modal,
    /!isOverride \? playbackContext/,
    "isOverride is stale inside run(), the target must be compared directly",
  );
});

const source = readFileSync(
  new URL("../src/lib/subtitles/addon-source.ts", import.meta.url),
  "utf8",
);

test("one slow addon manifest cannot drop every other local addon", () => {
  assert.doesNotMatch(
    source,
    /withSubtitleTimeout\(\s*Promise\.all\(/,
    "a shared timeout around Promise.all loses all locals when one hangs",
  );
  assert.match(source, /localOnly\.map\(\(l\): Promise<Addon \| null> =>/);
});

test("a cached manifest resolves without any network wait", () => {
  assert.match(source, /if \(l\.manifest\) return Promise\.resolve\(/);
});

const search = readFileSync(new URL("../src/lib/subtitles/search.ts", import.meta.url), "utf8");
const fetchIntoPlayer = readFileSync(
  new URL("../src/lib/subtitles/fetch-into-player.ts", import.meta.url),
  "utf8",
);
const subtitleMenu = readFileSync(
  new URL("../src/components/player/subtitle-menu.tsx", import.meta.url),
  "utf8",
);
const subtitleModal = readFileSync(
  new URL("../src/components/popups/subtitle-modal.tsx", import.meta.url),
  "utf8",
);
const subtitlePanelSize = readFileSync(
  new URL("../src/components/player/subtitle-menu/panel-size.ts", import.meta.url),
  "utf8",
);

test("one slow subtitle addon cannot discard faster addon results", () => {
  assert.match(
    src,
    /callOne\(addon, type, id, extra, timeoutMs\)/,
    "each addon request needs its own timeout",
  );
  assert.doesNotMatch(
    search,
    /withSubtitleTimeout\(searchAddons\(/,
    "the combined addon result must not be discarded by one shared timeout",
  );
  assert.match(
    search,
    /for \(const addon of opts\.addons\)/,
    "one search task per addon so a slow addon cannot hold back the rest",
  );
  assert.match(search, /searchAddons\(\[addon\], q, tmo\)/);
});

test("an enriched addon timeout still falls back to the standard subtitle endpoint", () => {
  const call = src.slice(
    src.indexOf("async function callOne"),
    src.indexOf("export async function searchAddons"),
  );
  assert.match(call, /enrichedBudget/);
  assert.match(call, /retrying without stream hints/);
  assert.match(call, /const bareUrl = `\$\{base\}\/subtitles\/\$\{type\}\/\$\{id\}\.json`/);
  assert.ok(
    call.indexOf("withSubtitleTimeout(") < call.indexOf("const bareUrl"),
    "the enriched request must be bounded before the bare fallback runs",
  );
});

test("automatic subtitle loading limits each preferred language independently", () => {
  assert.match(fetchIntoPlayer, /const EXTRA_TRACKS_PER_LANGUAGE = 15/);
  assert.match(fetchIntoPlayer, /spreadBySourcePerLanguage\(/);
  assert.match(
    fetchIntoPlayer,
    /spreadBySourcePerLanguage\(eagerPool, consumed, EXTRA_TRACKS_PER_LANGUAGE\)/,
  );
});

test("the subtitle menu only keeps configured languages", () => {
  const tracks = [
    { id: "en", lang: "eng" },
    { id: "ar", lang: "Arabic" },
    { id: "es", lang: "spa" },
    { id: "fr", lang: "French" },
    { id: "untagged" },
  ];
  assert.deepEqual(
    filterTracksByPreferredLanguage(tracks, ["English", "Arabic"]).map((track) => track.id),
    ["en", "ar", "untagged"],
  );
});

test("release suffixes are not mistaken for subtitle language tags", () => {
  assert.equal(isKnownLanguage("eng"), true);
  assert.equal(isKnownLanguage("en"), true);
  assert.equal(isKnownLanguage("in"), true);
  const video = "/movies/The.Imitation.Game.2014-Pahe.in.mkv";
  assert.equal(subtitleLanguage(video, "/movies/The.Imitation.Game.2014-Pahe.in.srt"), undefined);
  assert.equal(subtitleLanguage(video, "/movies/The.Imitation.Game.2014-Pahe.in.en.srt"), "en");
  assert.equal(subtitleLanguage(video, "/movies/The.Imitation.Game.2014-Pahe.in.in.srt"), "id");
});

test("the configured languages reach the separate subtitle popup", () => {
  assert.match(
    subtitleMenu,
    /buildOverlayState\(propsRef\.current, preferredLanguages, subtitleContext\)/,
  );
  assert.match(subtitleModal, /preferredLanguages=\{state\.preferredLanguages\}/);
});

test("subtitle popup fills compact players while staying above the controls", () => {
  assert.match(subtitleMenu, /fixed end-14 bottom-\[150px\]/);
  assert.match(subtitleModal, /mb-\[84px\] me-\[56px\]/);
  assert.match(subtitleMenu, /<ResizableSubtitlePanel className="fixed end-14/);
  assert.match(
    subtitlePanelSize,
    /DEFAULT_SUBTITLE_PANEL_SIZE[^=]*= \{ width: 560, height: 460 \}/,
  );
  assert.doesNotMatch(subtitleMenu, /flex h-\[460px\].*w-\[560px\]/);
  assert.doesNotMatch(subtitleModal, /me-\[120px\]/);
});

test("every anchored player popup shares one anchor", () => {
  const root = new URL("../src/components/player/", import.meta.url);
  const drifted: string[] = [];
  const walk = (dir: URL) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        walk(new URL(`${e.name}/`, dir));
      } else if (e.name.endsWith(".tsx")) {
        const at = new URL(e.name, dir);
        const src = readFileSync(at, "utf8");
        const hit = src.match(/fixed end-\S+ bottom-\[\d+px\]/);
        if (hit && hit[0] !== "fixed end-14 bottom-[150px]") drifted.push(`${e.name} ${hit[0]}`);
      }
    }
  };
  walk(root);
  assert.deepEqual(drifted, []);
});
