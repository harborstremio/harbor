import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EXTERNAL_LINK_FRAME_PERMISSIONS,
  EXTERNAL_LINK_FRAME_SANDBOX,
} from "../src/lib/external-link-viewer-modal.ts";

const source = readFileSync(
  new URL("../src/components/external-link-viewer.tsx", import.meta.url),
  "utf8",
);
const splitSource = readFileSync(
  new URL("../src/components/external-link-split-button.tsx", import.meta.url),
  "utf8",
);
const interstitialSource = readFileSync(
  new URL("../src/components/link-out-interstitial.tsx", import.meta.url),
  "utf8",
);
const controllerSource = readFileSync(
  new URL("../src/lib/social/external-link-journey-controller.ts", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("viewer uses Harbor identity and the fixed remote-content boundary", () => {
  assert.match(source, /<HarborLoader/);
  assert.match(source, /caption=\{t\("Loading \{hostname\}"/);
  assert.match(source, /sandbox={EXTERNAL_LINK_FRAME_SANDBOX}/);
  assert.match(source, /allow={EXTERNAL_LINK_FRAME_PERMISSIONS}/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.match(source, /tabIndex={-1}/);
  assert.match(source, /\{t\("Retry"\)\}/);
  assert.match(source, /\{t\("Open in browser"\)\}/);
  assert.doesNotMatch(source, /@tauri-apps|postMessage|addEventListener\("message"|\binvoke\(/);
  assert.doesNotMatch(source, /createPortal|aria-modal|role="dialog"/);
  assert.equal(EXTERNAL_LINK_FRAME_SANDBOX, "allow-scripts");
  assert.match(EXTERNAL_LINK_FRAME_PERMISSIONS, /camera 'none'/);
});

test("viewer uses truthful slow-loading copy", () => {
  assert.match(source, /Still loading\?/);
  assert.match(source, /may not support Harbor(?:'|&apos;)s temporary viewer/);
  assert.doesNotMatch(source, /definitely|X-Frame-Options|blocks embedding/);
});

test("viewer politely announces only the slow-loading status copy", () => {
  assert.match(
    source,
    /\{slow && \([\s\S]*?<div role="status" aria-live="polite">[\s\S]*?Still loading\?[\s\S]*?temporary viewer[\s\S]*?<\/div>[\s\S]*?<div className="flex flex-wrap justify-center gap-2">/,
  );
});

test("warning uses a direct main action and an alternate-only menu", () => {
  assert.match(interstitialSource, /<ExternalLinkSplitButton/);
  assert.match(splitSource, /aria-haspopup="menu"/);
  assert.match(splitSource, /aria-expanded={menuOpen}/);
  assert.match(splitSource, /role="menu"/);
  assert.match(splitSource, /role="menuitem"/);
  assert.match(splitSource, /<HarborMark/);
  assert.match(splitSource, /Continue in browser/);
  assert.match(splitSource, /Continue in Harbor/);
  assert.match(splitSource, /window\.addEventListener\("pointerdown"/);
  assert.match(interstitialSource, /handleExternalLinkBack\(menuOpenRef\.current/);
  assert.match(splitSource, /dismissExternalLinkMenu\("outside"/);
  assert.match(
    interstitialSource,
    /requestAnimationFrame\(\(\) => menuButtonRef\.current\?\.focus\(\)\)/,
  );
  assert.doesNotMatch(interstitialSource, /Remember this choice|useSettings|externalLinkOpenMode/);
});

test("warning always remains the first stage and strict opener has no legacy fallback", () => {
  assert.match(interstitialSource, /type Stage = "warning" \| "viewer"/);
  assert.match(interstitialSource, /useState<Stage>\("warning"\)/);
  assert.match(interstitialSource, /useLinkOutJourney/);
  assert.match(interstitialSource, /key={journey\.generation}/);
  assert.equal((interstitialSource.match(/createPortal\(/g) ?? []).length, 1);
  assert.equal((interstitialSource.match(/role="dialog"/g) ?? []).length, 1);
  assert.match(interstitialSource, /openExternalUrlStrict/);
  assert.match(interstitialSource, /<ExternalLinkViewer/);
  assert.match(controllerSource, /source === "alternate"/);
  assert.equal((appSource.match(/<LinkOutInterstitial \/>/g) ?? []).length, 1);
  assert.doesNotMatch(interstitialSource, /\bopenUrl\s*\(/);
  assert.doesNotMatch(source, /createPortal/);
});

test("interstitial delegates synchronized menu and opener state to the tested controller", () => {
  assert.match(interstitialSource, /menuOpenRef\.current = open/);
  assert.match(interstitialSource, /if \(!isCurrentLinkOutJourney\(journey\)\) return/);
  assert.match(interstitialSource, /openExternalLinkInBrowser\({/);
  assert.match(controllerSource, /if \(openingRef\.current\) return/);
});
