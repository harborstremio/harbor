// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  expandedCardWidth,
  isSuitableWideArtworkSize,
  normalizePosterCardSettings,
  pickAlternativeWideArtwork,
  rewriteWideArtworkRung,
  scrollDeltaToRevealCard,
  stableCardNavigationRect,
} from "../src/lib/poster-backdrop-expansion.ts";

test("expanding cards keep the poster height and reject unsuitable artwork", () => {
  assert.equal(expandedCardWidth(180), 320);
  assert.equal(isSuitableWideArtworkSize(1280, 720), true);
  assert.equal(isSuitableWideArtworkSize(600, 338), false);
  assert.equal(isSuitableWideArtworkSize(900, 1200), false);
  assert.equal(isSuitableWideArtworkSize(1700, 330), false);
  assert.equal(isSuitableWideArtworkSize(1920, 500), false);
});

test("expanded cards keep their original spatial-navigation center", () => {
  const expanded = { left: 100, right: 420, top: 20, bottom: 260, width: 320, height: 240 };
  assert.deepEqual(stableCardNavigationRect(expanded, 160, false), {
    left: 100,
    right: 260,
    top: 20,
    bottom: 260,
    width: 160,
    height: 240,
    cx: 180,
    cy: 140,
  });
  assert.deepEqual(stableCardNavigationRect(expanded, 160, true), {
    left: 260,
    right: 420,
    top: 20,
    bottom: 260,
    width: 160,
    height: 240,
    cx: 340,
    cy: 140,
  });
});

test("expanded cards remain fully visible at either row edge", () => {
  const viewport = { left: 100, right: 900 };
  assert.equal(scrollDeltaToRevealCard({ left: 120, right: 880 }, viewport, 20), 0);
  assert.equal(scrollDeltaToRevealCard({ left: 600, right: 930 }, viewport, 20), 50);
  assert.equal(scrollDeltaToRevealCard({ left: 70, right: 400 }, viewport, 20), -50);
  assert.equal(scrollDeltaToRevealCard({ left: 50, right: 950 }, viewport, 20), 0);
});

test("wide artwork prefers a different TMDB image and upgrades its resolution", () => {
  const current = "https://image.tmdb.org/t/p/original/current.jpg";
  const candidates = [
    "https://image.tmdb.org/t/p/w780/current.jpg",
    "https://image.tmdb.org/t/p/w780/alternate.jpg",
  ];

  assert.equal(pickAlternativeWideArtwork(candidates, current), candidates[1]);
  assert.equal(pickAlternativeWideArtwork([candidates[0]], current), undefined);
  assert.equal(
    rewriteWideArtworkRung(candidates[1]),
    "https://image.tmdb.org/t/p/w1280/alternate.jpg",
  );

  const cinemetaPoster = "https://images.metahub.space/poster/small/tt0427340/img";
  const cinemetaBackdrop = "https://images.metahub.space/background/medium/tt0427340/img";
  assert.equal(pickAlternativeWideArtwork([cinemetaBackdrop], cinemetaPoster), cinemetaBackdrop);
});

test("Expanding Cards reflows the row and preserves card overlays", () => {
  const rowSource = readFileSync(new URL("../src/components/row.tsx", import.meta.url), "utf8");
  const cardSource = readFileSync(
    new URL("../src/components/pick-card.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const navigationSource = readFileSync(
    new URL("../src/lib/keyboard-navigation.ts", import.meta.url),
    "utf8",
  );

  assert.match(rowSource, /harbor-expanding-row flex flex-nowrap/);
  assert.match(
    rowSource,
    /flexBasis: `\$\{expansion\.expandedWidth \?\? expansion\.baseWidth\}px`/,
  );
  assert.match(rowSource, /--row-poster-height/);
  assert.match(cardSource, /<ExpandingCardArtwork[\s\S]*src=\{expandingCard\.artwork\}/);
  assert.ok(
    cardSource.indexOf("<ExpandingCardArtwork") < cardSource.indexOf("<ScoreStack"),
    "wide artwork must remain underneath IMDb and other card badges",
  );
  assert.doesNotMatch(cssSource, /poster-backdrop-morph/);
  assert.match(cssSource, /data-row-card-expanded="true"/);
  assert.match(rowSource, /data-tv-nav-base-width=\{expansion\?\.baseWidth\}/);
  assert.match(rowSource, /if \(!expandedCard\) track\.style\.scrollSnapType = ""/);
  assert.match(navigationSource, /stableCardNavigationRect\(r, baseWidth, rtl\)/);
  assert.match(cardSource, /kids \|\| !settings\.hoverPreviewEnabled \? "none"/);
  assert.doesNotMatch(cardSource, /hoverPreviewEnabled \|\| expandingCard\.enabled/);
  assert.match(cardSource, /if \(!expandingCard\.enabled\) hoverPreviewFocus/);
  assert.match(cardSource, /hoverPreviewEnter\(meta, e\.currentTarget, e\.buttons\)/);
});

test("Focused Card, Expanding Cards, and Poster Dock remain independent", () => {
  const settingsSource = readFileSync(
    new URL("../src/views/settings/theme-panel/display/poster-card-section.tsx", import.meta.url),
    "utf8",
  );
  const rowSource = readFileSync(new URL("../src/components/row.tsx", import.meta.url), "utf8");
  const defaultsSource = readFileSync(
    new URL("../src/lib/settings/defaults.ts", import.meta.url),
    "utf8",
  );
  const loadSource = readFileSync(new URL("../src/lib/settings/load.ts", import.meta.url), "utf8");

  assert.match(settingsSource, /update\(\{ posterBackdropExpansion \}\)/);
  assert.doesNotMatch(settingsSource, /posterDockMagnification: false/);
  assert.doesNotMatch(settingsSource, /!settings\.posterBackdropExpansion/);
  assert.match(
    settingsSource,
    /label=\{t\("Focused Card"\)\}[\s\S]*value=\{settings\.posterFocusedCard\}/,
  );
  assert.ok(
    settingsSource.indexOf('label={t("Focused Card")}') <
      settingsSource.indexOf('label={t("Expanding Cards")}'),
    "Focused Card must be a separate top-level setting",
  );
  assert.match(rowSource, /effShape === "portrait" && settings\.posterDockMagnification/);
  assert.doesNotMatch(rowSource, /posterDockMagnification && !expandingCards/);
  assert.match(defaultsSource, /posterFocusedCard: false/);
  assert.match(loadSource, /normalizePosterCardSettings\(parsed\)/);
  assert.deepEqual(
    normalizePosterCardSettings({
      posterBackdropExpansion: true,
      posterDockMagnification: true,
    }),
    {
      posterBackdropExpansion: true,
      posterFocusedCard: false,
      posterDockMagnification: true,
    },
  );
  assert.deepEqual(
    normalizePosterCardSettings({
      posterBackdropExpansion: true,
      posterFocusedCard: false,
      posterDockMagnification: true,
    }),
    {
      posterBackdropExpansion: true,
      posterFocusedCard: false,
      posterDockMagnification: true,
    },
  );
  assert.deepEqual(
    normalizePosterCardSettings({
      posterBackdropExpansion: false,
      posterFocusedCard: true,
      posterDockMagnification: true,
    }),
    {
      posterBackdropExpansion: false,
      posterFocusedCard: true,
      posterDockMagnification: true,
    },
  );
});

test("Focused Card is global and independent from card expansion", () => {
  const hookSource = readFileSync(
    new URL("../src/components/pick-card/use-expanding-card.tsx", import.meta.url),
    "utf8",
  );
  const cardSource = readFileSync(
    new URL("../src/components/pick-card.tsx", import.meta.url),
    "utf8",
  );
  const rowSource = readFileSync(new URL("../src/components/row.tsx", import.meta.url), "utf8");
  const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(hookSource, /const focusedCardEffectEnabled = focusEnabled/);
  assert.doesNotMatch(hookSource, /enabled && focusEnabled/);
  assert.match(cardSource, /focusEnabled: settings\.posterFocusedCard/);
  assert.match(
    cardSource,
    /expandingCard\.focusEnabled\s*\?\s*"group-focus:\[-webkit-transform:translate3d\(0,-0\.5rem,0\)\]/,
  );
  assert.match(hookSource, /focusIntentRef\.current = true/);
  assert.doesNotMatch(hookSource, /row\?\.setFocused|setRowCardFocused/);
  assert.doesNotMatch(rowSource, /focusedCardIndex|deemphasized/);
  assert.match(cssSource, /#root\[data-card-focus-active\]/);
  assert.match(cssSource, /\[data-media-card\]/);
  assert.match(cssSource, /brightness\(0\.68\) saturate\(0\.78\) blur\(0\.7px\)/);
  assert.match(cssSource, /\[data-focused-card\]:is\(:focus-visible, \[data-tv-focused="true"\]\)/);
  assert.doesNotMatch(cssSource, /\[data-expanding-card\]\[data-tv-focused="true"\]/);
});

test("pointer hover never expands cards and keeps normal hover styles and preview", () => {
  const hookSource = readFileSync(
    new URL("../src/components/pick-card/use-expanding-card.tsx", import.meta.url),
    "utf8",
  );
  const cardSource = readFileSync(
    new URL("../src/components/pick-card.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    hookSource,
    /HOVER_EXPAND|pointerIntentRef|pointerArmedRef|hoverTimerRef|hoverEnabled|onPointerEnter|onPointerLeave/,
  );
  assert.doesNotMatch(cardSource, /expandingCard\.onPointer|posterBackdropExpansionHover/);
  assert.doesNotMatch(cardSource, /hoverPreviewEnabled \|\| expandingCard\.enabled/);
  assert.match(cardSource, /hoverPreviewEnter\(meta, e\.currentTarget, e\.buttons\)/);
});

test("wide artwork is prepared before the row is allowed to expand", () => {
  const hookSource = readFileSync(
    new URL("../src/components/pick-card/use-expanding-card.tsx", import.meta.url),
    "utf8",
  );
  const artworkSource = readFileSync(
    new URL("../src/lib/expanding-card-artwork.ts", import.meta.url),
    "utf8",
  );

  assert.match(hookSource, /if \(!url \|\| !row \|\| !enabled\) return/);
  assert.match(hookSource, /prepareExpandingCardArtwork\(meta, tmdbKey, priority\)/);
  assert.match(hookSource, /loadArtwork\("auto"\)/);
  assert.match(hookSource, /loadArtwork\("high"\)/);
  assert.match(hookSource, /artworkKeyRef\.current !== artworkKey/);
  assert.match(hookSource, /onArtworkReady/);
  assert.match(artworkSource, /image\.decode\(\)\.then/);
  assert.match(artworkSource, /isSuitableWideArtworkSize/);
  assert.match(artworkSource, /tvdbArtwork\?\.backgrounds/);
  assert.match(artworkSource, /meta\.background \? \[meta\.background\]/);
  assert.ok(
    artworkSource.indexOf("const immediate") < artworkSource.indexOf("await artworkCandidates"),
    "the existing backdrop must be decoded before remote artwork fallbacks are requested",
  );
  assert.match(artworkSource, /\|simkl\)/);
  assert.doesNotMatch(hookSource, /meta\.background/);
});
