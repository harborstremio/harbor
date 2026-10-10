// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(at(path), "utf8");

const panel = read("src/views/settings/player-layout-panel/index.tsx");
const preview = read("src/views/settings/player-layout-panel/advisory-preview.tsx");
const toast = read("src/components/player/content-advisory-toast.tsx");
const hook = read("src/views/player/hooks/use-content-advisory.ts");
const overlays = read("src/views/player/stage-overlays.tsx");
const overlayLayers = read("src/views/player/player-overlay-layers.tsx");

test("content advisory uses a quiet borderless presentation", () => {
  assert.match(toast, /start-6 top-20/);
  assert.match(toast, /bg-black\/70/);
  assert.match(toast, /const HOLD_MS = 8_000/);
  assert.match(toast, /const HOVER_TAIL_MS = 2_500/);
  assert.doesNotMatch(
    toast,
    /border-t|shadow-\[|backdrop-blur|rounded-xl|harbor-content-advisory-row/,
  );
  assert.doesNotMatch(toast, /h-\[2px\] bg-white\/10/);
  assert.doesNotMatch(toast, /start-4 top-44|w-\[286px\]|bg-black\/80/);
});

test("content advisory waits for playback and fully unmounts after dismissal", () => {
  assert.match(toast, /usePlaybackPosition/);
  assert.match(toast, /const hasPlaybackStarted = preview \|\| positionSec > 0\.3/);
  assert.match(
    toast,
    /if \(!enabled \|\| preview \|\| !playKey \|\| !hasPlaybackStarted \|\| !hasContent \|\| hasTriggered\)\s+return/,
  );
  assert.match(toast, /type Phase = "idle" \| "holding" \| "collapsing" \| "done"/);
  assert.match(toast, /setPhase\("done"\)[\s\S]*setActive\(false\)/);
  assert.match(
    toast,
    /if \(!enabled \|\| !hasContent \|\| !active \|\| !hasPlaybackStarted \|\| phase === "done"\) return null/,
  );
  assert.match(toast, /isCardExiting \? "pointer-events-none" : "pointer-events-auto"/);
  assert.doesNotMatch(toast, /visible \? "translate-y-0 opacity-100"/);
});

test("content advisory keeps hover, dismiss, and accessibility safeguards without a render loop", () => {
  assert.match(toast, /window\.clearTimeout\(timer\)/);
  assert.doesNotMatch(toast, /requestAnimationFrame|setProgress/);
  assert.match(toast, /durationRef\.current = HOVER_TAIL_MS/);
  assert.match(toast, /onMouseEnter=\{preview \? undefined : \(\) => setPaused\(true\)\}/);
  assert.match(toast, /onFocusCapture=\{preview \? undefined : \(\) => setPaused\(true\)\}/);
  assert.match(toast, /onBlurCapture=\{preview \? undefined : handleBlur\}/);
  assert.match(toast, /event\.currentTarget\.blur\(\)[\s\S]*setPhase\("collapsing"\)/);
  assert.match(toast, /role=\{preview \? undefined : "status"\}/);
  assert.match(toast, /aria-label=\{preview \? undefined : t\("Content advisory"\)\}/);
  assert.match(toast, /aria-label=\{t\("Dismiss"\)\}/);
  assert.match(toast, /aria-hidden="true"/);
  assert.match(toast, /prefers-reduced-motion: reduce/);
});

test("content advisory keeps its preview and component compatibility contracts", () => {
  assert.equal(existsSync(at("src/views/settings/player-layout-panel/advisory-preview.tsx")), true);
  assert.match(panel, /import \{ AdvisoryPreview \} from "\.\/advisory-preview"/);
  assert.match(panel, /preview=\{<AdvisoryPreview \/>\}/);
  assert.match(preview, /<ContentAdvisoryToast preview/);
  assert.match(toast, /useSettings/);
  assert.match(toast, /settings\.contentAdvisoryTheme === "monochrome"/);
  assert.match(toast, /mpaRating\?: string \| null/);
  assert.match(toast, /const SEV_RANK[^\n]+None: 0/);
  assert.match(toast, /SEV_RANK\[category\.severity\] !== undefined/);
});

test("content advisory avoids occupied player corners", () => {
  assert.match(overlayLayers, /const topLeftOccupied = p\.showStats/);
  assert.match(overlayLayers, /const topRightOccupied = roomAvatarTopRight \|\| roomChatTopRight/);
  assert.match(overlayLayers, /topRightOccupied[\s\S]*\? "top-center"[\s\S]*: "top-end"/);
  assert.match(overlays, /position=\{contentAdvisoryPosition\}/);
  assert.match(toast, /position === "top-end"[\s\S]*end-6 top-20/);
  assert.match(toast, /position === "top-center"[\s\S]*start-1\/2 top-20/);
});

test("content advisory keeps IMDb fetching and PiP suppression", () => {
  assert.match(hook, /harborImdbParental\(imdbId\)/);
  assert.match(hook, /if \(!enabled \|\| !playing\) return/);
  assert.match(hook, /setPlayKey\(srcKey\)/);
  assert.match(overlays, /!pipMode && \(\s*<ContentAdvisoryToast/);
});

test("advisories stay opt-in and cannot render from stale data while disabled", () => {
  assert.doesNotMatch(
    read("src/lib/settings/load.ts"),
    /if \(!parsed\._contentAdvisoryOnByDefaultV1\)/,
  );
  assert.match(toast, /category\.severity !== "None"/);
  assert.match(read("src/lib/settings/defaults.ts"), /contentAdvisoryToast: false/);
  assert.match(
    read("src/lib/settings/load.ts"),
    /parsed\.contentAdvisoryToast = parsed\.contentAdvisoryToast === true/,
  );
  assert.match(toast, /const enabled = preview \|\| settings\.contentAdvisoryToast === true/);
});

test("profile background adapts slider units and reloads when the picker opens", () => {
  const picker = read("src/views/settings/account/picker-background.tsx");
  const modal = read("src/components/profile-picker/picker-modal.tsx");
  assert.match(picker, /dim=\{dim \/ 100\}/);
  assert.match(picker, /const pct = Math\.round\(next \* 100\);/);
  assert.match(picker, /setDim\(pct\);\s*void savePickerBgDim\(pct\);/);
  assert.match(
    modal,
    /if \(!pickerOpen\) return;\s*let alive = true;[\s\S]*loadPickerBg\(\)[\s\S]*\}, \[pickerOpen\]\)/,
  );
});
