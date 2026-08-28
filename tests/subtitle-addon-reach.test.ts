// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  filterTracksByPreferredLanguage,
  languageName,
  normalizeSubtitleLang,
} from "../src/lib/subtitles/language.ts";

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

test("valid addon subtitles survive missing and generic language metadata", () => {
  assert.doesNotMatch(src, /!isPlausibleLang\(s\.lang\)/);
  assert.match(src, /normalizeSubtitleLang\(s\.lang \?\? s\.language\)/);
  assert.equal(normalizeSubtitleLang(undefined), "und");
  assert.equal(normalizeSubtitleLang("translation"), "und");
  assert.equal(normalizeSubtitleLang("hun"), "hu");
  assert.equal(normalizeSubtitleLang("magyar"), "hu");
  assert.equal(normalizeSubtitleLang("Fordítás: magyar"), "hu");
  assert.equal(normalizeSubtitleLang("Felirat-eszköztár"), "und");
  assert.equal(normalizeSubtitleLang("multilingual"), "multi");
  assert.equal(languageName("und"), "Unknown");
  assert.equal(languageName("multi"), "Multi");
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
const modalOverlayApp = readFileSync(
  new URL("../src/views/modal-overlay-app.tsx", import.meta.url),
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
  assert.match(search, /searchAddons\(opts\.addons, q, tmo\)/);
});

test("an enriched addon timeout still falls back to the standard subtitle endpoint", () => {
  const call = src.slice(
    src.indexOf("async function callOne"),
    src.indexOf("export async function searchAddons"),
  );
  assert.match(call, /enrichedBudget/);
  assert.match(call, /also checking without stream hints/);
  assert.match(call, /const bareUrl = `\$\{base\}\/subtitles\/\$\{type\}\/\$\{id\}\.json`/);
  assert.ok(
    call.indexOf("withSubtitleTimeout(") < call.indexOf("const bareUrl"),
    "the enriched request must be bounded before the bare fallback runs",
  );
});

test("a non-empty enriched response cannot hide an addon's standard translation results", () => {
  const call = src.slice(
    src.indexOf("async function callOne"),
    src.indexOf("export async function searchAddons"),
  );
  assert.doesNotMatch(call, /if \(enriched\.length > 0\) return enriched/);
  assert.match(call, /for \(const subtitle of \[\.\.\.enriched, \.\.\.bare\]\)/);
  assert.match(call, /return merged/);
});

test("automatic subtitle loading limits each visible language independently", () => {
  assert.match(fetchIntoPlayer, /const EXTRA_TRACKS_PER_LANGUAGE = 40/);
  assert.match(fetchIntoPlayer, /spreadBySourcePerLanguage\(/);
  assert.match(
    fetchIntoPlayer,
    /spreadBySourcePerLanguage\(eagerPool, consumed, EXTRA_TRACKS_PER_LANGUAGE\)/,
  );
});

test("automatic subtitle loading protects rate-limited built-in providers", () => {
  assert.match(fetchIntoPlayer, /const BUILT_IN_EAGER_LIMIT_PER_LANGUAGE = 1/);
  assert.match(fetchIntoPlayer, /function limitEagerProviderDownloads/);
  assert.match(fetchIntoPlayer, /const eagerPool = limitEagerProviderDownloads/);
  assert.match(fetchIntoPlayer, /spreadBySourcePerLanguage\(eagerPool, consumed/);
});

test("built-in providers keep their longer timeout budget", () => {
  assert.match(fetchIntoPlayer, /const BUILT_IN_TIMEOUT_MS = 12_000/);
  assert.match(search, /const extraTimeout = opts\.extra\.timeoutMs \?\? tmo/);
  assert.match(search, /extraTimeout \+ 500/);
});

test("automatic subtitle loading consumes provider results progressively", () => {
  assert.match(fetchIntoPlayer, /const PROGRESSIVE_TRACKS_PER_LANGUAGE = 35/);
  assert.match(fetchIntoPlayer, /const SUBTITLE_ADD_CONCURRENCY = 4/);
  assert.match(fetchIntoPlayer, /Array\.from\(/);
  assert.match(fetchIntoPlayer, /onPartial: queuePartial/);
  assert.match(fetchIntoPlayer, /await progressiveQueue/);
});

test("automatic core subtitle providers do not wait for addon inventory", () => {
  const autoload = readFileSync(
    new URL("../src/views/player/hooks/use-track-autoload.ts", import.meta.url),
    "utf8",
  );
  assert.match(autoload, /stage === "core"/);
  assert.match(autoload, /\{ addons: false \}/);
  assert.match(autoload, /stage === "addons"/);
  assert.match(autoload, /opensubtitles: false, wyzie: false, addons: true, extras: false/);
  assert.match(autoload, /refreshing \|\| initialSearches > 0 \? "searching" : "idle"/);
});

test("Auto Sync moviehash enrichment never blocks progressive subtitle discovery", () => {
  const autoload = readFileSync(
    new URL("../src/views/player/hooks/use-track-autoload.ts", import.meta.url),
    "utf8",
  );
  const searchStart = autoload.indexOf("const res = await fetchSubtitlesIntoPlayer({");
  const hashMerge = autoload.indexOf("if (movieHashPromise)");
  assert.ok(searchStart >= 0 && hashMerge > searchStart);
  assert.doesNotMatch(
    autoload.slice(searchStart, hashMerge),
    /await resolveVideoHash\(src\)/,
    "the initial provider search must start without waiting for remote moviehash reads",
  );
  assert.match(autoload, /\[subs\/autoload\] moviehash stage found/);
});

test("content advisory waits for playback readiness and subtitle discovery", () => {
  const player = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");
  const advisory = readFileSync(
    new URL("../src/views/player/hooks/use-content-advisory.ts", import.meta.url),
    "utf8",
  );
  assert.match(player, /!subtitleSearchActive/);
  assert.match(advisory, /if \(!enabled \|\| !ready \|\| !meta\) return/);
  assert.match(advisory, /window\.setTimeout/);
});

test("the detached subtitle popup waits for the real add result", () => {
  assert.match(modalOverlayApp, /modalOverlayRequestAction<"ok" \| "failed" \| "limited">/);
  assert.match(modalOverlayApp, /if \(result === "limited"\) markLimitReached\(url\)/);
  assert.match(subtitleMenu, /modalOverlayEmitResult\("modal:\/\/subtitle\/add-result"/);
  assert.match(subtitleMenu, /wasLimitReached\(e\.payload\.url\)/);
});

test("the subtitle menu only keeps configured languages", () => {
  const tracks = [
    { id: "en", lang: "eng" },
    { id: "ar", lang: "Arabic" },
    { id: "es", lang: "spa" },
    { id: "fr", lang: "French" },
  ];
  assert.deepEqual(
    filterTracksByPreferredLanguage(tracks, ["English", "Arabic"]).map((track) => track.id),
    ["en", "ar"],
  );
});

test("the configured languages reach the separate subtitle popup", () => {
  assert.match(
    subtitleMenu,
    /buildOverlayState\(\s*propsRef\.current,\s*preferredLanguages,\s*subtitleContext,?\s*\)/,
  );
  assert.match(subtitleModal, /preferredLanguages=\{state\.preferredLanguages\}/);
});

test("subtitle popups use the shared resizable panel above the controls", () => {
  assert.match(subtitleMenu, /ResizableSubtitlePanel className="fixed end-6 bottom-24"/);
  assert.match(subtitleModal, /ResizableSubtitlePanel className="mb-24 me-6"/);
  assert.doesNotMatch(subtitleModal, /me-\[120px\]/);
});
