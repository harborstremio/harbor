import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { isAnimeRow } from "@/views/anime";
import type { HomeRow } from "@/views/home/home-types";
import { SFX } from "@/lib/sfx";
import { useView, type PlayEpisode } from "@/lib/view";
import { useActiveKid } from "@/lib/profiles";
import { isAndroidTv } from "@/lib/platform";
import {
  exitBigPicture,
  goBigPictureTab,
  popBigPicture,
  pushBigPicture,
  routeKey,
  useBigPicture,
} from "@/lib/big-picture";
import { ensureBigPictureTokens } from "./bp-tokens";
import { bpOverscan } from "./bp-safe-area";
import { useBpFocusRoot } from "./use-bp-focus";
import { BpAmbient } from "./bp-ambient";
import { BpExitConfirm } from "./bp-exit-confirm";
import { BpPhoneTyping } from "./bp-phone-typing";
import { BpTopBar, bpTabKinds, useBpTabGate } from "./bp-top-bar";
import { BpHintBar, type BpAction } from "./bp-hint-bar";
import { BpHome } from "./bp-home";
import {
  BpAddon,
  BpAnime,
  BpCollection,
  BpCollectionDetail,
  BpCollections,
  BpDetail,
  BpDiscover,
  BpLibrary,
  BpLive,
  BpMovies,
  BpPerson,
  BpSearch,
  BpService,
  BpSettings,
  BpShows,
  BpRouteFallback,
  BpStreams,
  bpWarmRoutes,
} from "./bp-routes";
import { bpAddonIngestRows } from "./addons/bp-addon-posters";
import { useBpCatalog } from "./use-bp-catalog";
import { useBpSound } from "./use-bp-sound";
import { useBpFullscreen } from "./use-bp-fullscreen";
import { useBpIntro } from "./use-bp-intro";
import { BpIntro } from "./bp-intro";
import { ensureBundledAwards } from "@/lib/awards-history";
import { bpBootSplashDismiss } from "./bp-boot-splash";
import { bpIntroPoolSave } from "./bp-intro-pool";
import { BpOnboarding, useBpOnboardingGate } from "./bp-onboarding";
import { BP_ONBOARD_STEP_VIEWS } from "./onboarding";
import { bigPictureChromeState, bpActiveTab, bpTvShell, cycleTab } from "./bp-logic";
import { BpWhoIsWatching } from "./bp-who-is-watching";
import { useBpWhoLayer } from "./bp-who-is-watching-layer";
import { useBpProfileReset } from "./use-bp-profile-reset";
import { forceBpMeta } from "./bp-focus-meta";
import { resetBpViewState } from "./bp-view-state";
import { clearBpPositions } from "./bp-restore";
import { pushBpBack, runBpBack } from "./bp-back";
import { BpQuickPanel } from "./bp-quick-panel";
import { BpScreensaver } from "./bp-screensaver";
import { BpControllerToast } from "./bp-controller-toast";

// The ten-foot player is NOT mounted here. It needs the player's live state,
// which lives in views/player, so views/player/bp-ten-foot.tsx mounts it and
// fills its slots. Mounting it from this file is what left BpPlayerShell with
// no children and every player surface unreachable. It still portals to
// document.body, outside the root below, because rootStyle drops
// visibility:hidden on [data-bp-root] the moment playback opens and a hidden
// element cannot take focus.

const HINTS: Record<string, BpAction[]> = {
  home: ["select", "exit", "search", "tabs"],
  anime: ["select", "back", "search", "tabs"],
  shows: ["select", "back", "tabs"],
  movies: ["select", "back", "tabs"],
  live: ["select", "back", "tabs"],
  discover: ["select", "back", "tabs"],
  search: ["type", "phone", "back", "tabs"],
  library: ["select", "back", "tabs"],
  detail: ["select", "back"],
  person: ["select", "back"],
  collection: ["select", "back"],
  collections: ["select", "back", "tabs"],
  "tmdb-collection": ["select", "back"],
  service: ["select", "back", "tabs"],
  addon: ["select", "back"],
  settings: ["select", "back", "tabs"],
};

const SOURCES_HINTS: BpAction[] = ["select", "back"];
// Last, because the bar is right aligned and this hint sits physically under
// the action rail it names. The bar advertised neither of the two buttons that
// own every setup screen, which is how the flow read as a maze on a remote.
// The gesture hint is chosen per screen and can be absent, because four of the
// ten render no skip and the last one opens with the ring already on its only
// button. Naming either of those is the lie the bar exists to stop telling.
const ONBOARD_HINTS: BpAction[] = ["select", "back"];

type BpSourcesTarget = {
  meta: Meta;
  episode?: PlayEpisode;
  resume: boolean;
  auto: boolean;
  applyPreference: boolean;
};

export function BigPictureShell() {
  const t = useT();
  const { active, stack } = useBigPicture();
  const { picker, player } = useView();
  const route = stack[stack.length - 1] ?? { kind: "home" as const };
  const rootRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const kid = useActiveKid();
  const chrome = bigPictureChromeState({
    active,
    kidProfileActive: kid !== null,
    playbackOpen: Boolean(picker || player),
  });
  const playing = chrome.hidden;
  const [quickOpen, setQuickOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [sources, setSources] = useState<BpSourcesTarget | null>(null);
  const who = useBpWhoLayer();
  const tabGate = useBpTabGate();
  const tabOrder = useMemo(() => bpTabKinds(tabGate), [tabGate]);
  const { rows, loading } = useBpCatalog();
  const mosaicPool = useMemo(() => rows.flatMap((r) => r.metas).slice(0, 90), [rows]);
  // Pass 2 for the addons row, done here because the shell already holds rows.
  // Every meta carries the addon that returned it, so the row's mosaics are free
  // off catalogs home fetched anyway. Mounting useBpCatalog inside the row
  // instead would build a third, unmemoised copy of the whole home catalog.
  useEffect(() => {
    bpAddonIngestRows(rows);
  }, [rows]);
  // The splash is Harbor's front door. Flattening rows in order made it show
  // whichever catalog happened to sort first, so it draws one poster per row in
  // turn and keeps anime and user rows behind the broad catalogs.
  const introPool = useMemo(() => {
    const userRow = (r: HomeRow) =>
      r.key.startsWith("list-") || r.key.startsWith("collection-") || r.key.startsWith("source-");
    const watchable = (m: Meta) =>
      Boolean(m.poster) && (m.type === "movie" || m.type === "series" || m.type === "anime");

    const rank = (r: HomeRow) => (userRow(r) ? 2 : isAnimeRow(r) ? 1 : 0);
    const lanes = [...rows]
      .sort((a, b) => rank(a) - rank(b))
      .map((r) => r.metas.filter(watchable))
      .filter((l) => l.length > 0);
    if (lanes.length === 0) return [];

    const seen = new Set<string>();
    const out: Meta[] = [];
    const depth = Math.max(...lanes.map((l) => l.length));
    for (let i = 0; i < depth && out.length < 140; i += 1) {
      for (const lane of lanes) {
        const m = lane[i];
        if (!m || seen.has(m.id)) continue;
        seen.add(m.id);
        out.push(m);
        if (out.length >= 140) break;
      }
    }
    return out;
  }, [rows]);
  const intro = useBpIntro(active, !loading && rows.length > 0);
  const introUp = intro !== "done";
  useEffect(() => {
    bpIntroPoolSave(introPool.map((m) => m.poster).filter((p): p is string => !!p));
  }, [introPool]);
  // Belt and braces for the boot splash. BpIntro takes it down the moment it
  // mounts, but a session that never shows an intro at all would otherwise
  // leave index-tv.html's splash sitting on top of the home screen forever.
  //
  // The award table is pulled here too, and deliberately after the splash has
  // gone rather than during boot: it is the largest asset the app owns and
  // fetching it any earlier competes with the first paint it is supposed to
  // stay out of the way of. Desktop already set it before mounting, so this is
  // a no-op there.
  useEffect(() => {
    if (introUp) return;
    bpBootSplashDismiss(true);
    ensureBundledAwards();
    bpWarmRoutes();
  }, [introUp]);
  // Setup waits for the splash. Two full-screen takeovers at z-60 at once would
  // leave the focus scope on whichever mounted last with nothing behind it.
  const onboarding = useBpOnboardingGate(chrome.mounted && !introUp);
  const [onboardHint, setOnboardHint] = useState<BpAction | null>(null);
  const onboardingOpenRef = useRef(onboarding.open);
  onboardingOpenRef.current = onboarding.open;
  useBpSound(chrome.navigationEnabled);
  useBpFullscreen(chrome.mounted);

  useEffect(() => {
    if (active && kid && !bpTvShell()) exitBigPicture();
  }, [active, kid]);

  useEffect(() => {
    if (!active) return;
    SFX.boot();
    ensureBigPictureTokens();
    restoreRef.current = document.activeElement as HTMLElement | null;
    // Released, never restored to what was captured on the way in. The desktop
    // onboarding modal locks the body too and unlocks itself the moment Big
    // Picture opens, so a captured "hidden" outlives its owner and leaves the
    // desktop app unscrollable after exit. Any owner that still wants the lock
    // re-asserts it from its own effect.
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-big-picture", "true");
    SFX.open();
    return () => {
      document.body.style.overflow = "";
      document.documentElement.removeAttribute("data-big-picture");
      forceBpMeta(null);
      resetBpViewState();
      clearBpPositions();
      restoreRef.current?.focus?.();
    };
  }, [active]);

  // Everything the shell itself answers for, expressed as a back HANDLER rather
  // than as a consumer of the chain. bp-back.ts points window.__harborBack at
  // runBpBack, and runBpBack only walks handlers registered through pushBpBack.
  // This logic used to sit downstream of that call, so it was reachable from a
  // keyboard but never from the remote: MainActivity read false off every plain
  // route and called leave(). Measured on the stick, one Back on the search page
  // and pidof app.harbor came back empty.
  const fallback = useCallback((): boolean => {
    // First, above every other layer. canClose is false while no profile is active,
    // which swallows Back and makes the chooser genuinely modal in the one case where
    // there is no valid state behind it.
    if (who.open) {
      who.close();
      return true;
    }
    if (phoneOpen) {
      setPhoneOpen(false);
      return true;
    }
    if (confirmExit) {
      setConfirmExit(false);
      return true;
    }
    if (quickOpen) {
      setQuickOpen(false);
      return true;
    }
    if (sources) {
      setSources(null);
      return true;
    }
    if (popBigPicture()) return true;
    // At the true root the two platforms want opposite things. On a television
    // Big Picture IS the app and Back at the root belongs to the launcher, so
    // decline and let MainActivity finish the activity. In the window there is
    // something behind Big Picture to go back to, which is what the confirm asks.
    if (isAndroidTv()) return false;
    setConfirmExit(true);
    return true;
  }, [quickOpen, confirmExit, phoneOpen, sources, who]);

  // Registered once, read through a ref. Re-registering on every dep change
  // would move this to the end of the handler list, and runBpBack walks from the
  // end, so the shell would start swallowing Back before any open dialog saw it.
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  useEffect(() => pushBpBack(() => fallbackRef.current()), []);

  const onBack = useCallback(() => {
    runBpBack();
  }, []);

  // Stays wired while setup is up and declines inside instead. Passing
  // undefined here also drops the shell's preventDefault on Tab, and Tab out of
  // an aria-modal setup layer walks native tab order into the route behind it.
  const onOptions = useCallback(() => {
    if (sources || onboardingOpenRef.current) return;
    if (route.kind === "search") {
      setPhoneOpen((v) => !v);
      return;
    }
    setQuickOpen((v) => !v);
  }, [route.kind, sources]);

  useEffect(() => {
    const open = () => setPhoneOpen(true);
    window.addEventListener("bp:phone-typing", open);
    return () => window.removeEventListener("bp:phone-typing", open);
  }, []);

  useBpProfileReset();

  const activeTab = useMemo(
    () =>
      bpActiveTab(
        stack.map((r) => r.kind),
        tabOrder,
      ),
    [stack, tabOrder],
  );

  const onTab = useCallback(
    (delta: number) => goBigPictureTab(cycleTab(tabOrder, activeTab, delta)),
    [activeTab, tabOrder],
  );

  // ":who" first, and the suffix is load-bearing rather than cosmetic: routeKey feeds
  // useBpFocusRoot's seed pass, which is what puts the ring on a tile when the chooser
  // opens. Without it the surface can come up with nothing focused until the first
  // arrow press.
  const layer = who.open
    ? ":who"
    : sources
      ? ":sources"
      : phoneOpen
        ? ":phone"
        : confirmExit
          ? ":exit"
          : quickOpen
            ? ":quick"
            : onboarding.open
              ? ":onboard"
              : "";

  useBpFocusRoot({
    rootRef,
    onBack,
    onOptions,
    // PageUp and PageDown would otherwise change the route behind the chooser.
    onTab: who.open || quickOpen || sources || onboarding.open ? undefined : onTab,
    enabled: chrome.navigationEnabled && !introUp,
    routeKey: `${routeKey(route)}${layer}`,
  });

  const openDetail = useCallback((m: Meta) => {
    forceBpMeta(m);
    pushBigPicture({ kind: "detail", metaId: `${m.type}:${m.id}` });
  }, []);

  const openSources = useCallback(
    (
      meta: Meta,
      episode: PlayEpisode | undefined,
      resume: boolean,
      auto: boolean,
      applyPreference: boolean,
    ) => {
      setSources({ meta, episode, resume, auto, applyPreference });
    },
    [],
  );

  const routeId = routeKey(route);
  // Route only. This used to list `player` as well, which tore the source list
  // down the moment playback opened, so Back out of a stream that never started
  // landed on the detail page instead of the list the user was mid-choice in.
  // BpStreams latches autoFiredRef once it has fired, so keeping it mounted
  // across a playback session cannot re-fire auto.
  useEffect(() => {
    setSources(null);
  }, [routeId]);

  const rootStyle = useMemo<CSSProperties | undefined>(() => {
    const o = bpOverscan();
    const vars = o > 0 ? ({ "--bp-overscan": String(o) } as CSSProperties) : undefined;
    if (!playing) return vars;
    return { ...vars, visibility: "hidden", pointerEvents: "none" };
  }, [playing]);

  if (!chrome.mounted) return null;

  return (
    <>
      {createPortal(
        <div
          ref={rootRef}
          data-bp-root
          /* Static for the life of the tree, never toggled. Every rule that
             reads it is in BP_TOKENS and the trap is recorded there: a value
             that changes on this root invalidates style for the whole subtree
             and measured 104.8ms median on a Stick 4K Max. isAndroidTv rather
             than isAndroid, and rather than bpTvShell, because it is the gate
             the other two performance decisions in this directory already use
             (bp-decor-motion, bp-ambient-layers) and only that WebView was
             measured. */
          data-bp-tv={isAndroidTv() ? "" : undefined}
          role="application"
          aria-label={t("Big Picture")}
          aria-hidden={playing || undefined}
          className="fixed inset-0 z-[900] overflow-hidden bg-[var(--bp-void)] text-ink [animation:bp-enter_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
          style={rootStyle}
        >
          {/* The guide is a dense grid read at ten feet. Artwork behind it competes
              with every cell and there is nowhere for it to sit that is not under
              text, so Live TV gets the flat canvas and no ambient at all. */}
          {route.kind !== "search" && route.kind !== "live" && (
            <BpAmbient pool={mosaicPool} still={route.kind === "anime"} />
          )}
          <BpTopBar active={activeTab} />
          <main
            key={routeId}
            // bp-enter, not bp-fade. main is keyed, so the outgoing page is gone
            // in the same frame and a bare opacity ramp leaves a moment of empty
            // ambient before the new one materialises: every tab change produced
            // the identical undirected dissolve. bp-enter adds a 1.035 settle so
            // the page ARRIVES instead of appearing, and it is affordable because
            // BpAmbient sits outside main and the backdrop is already correct
            // across the boundary, so only the content has to move.
            //
            // Any replacement keyframe must still end exactly on the element's
            // own base style. bp-tokens sets animation-fill-mode: backwards on
            // this element precisely because "both" left Blink's
            // HasCurrentOpacityAnimation set and held the surface promoted for
            // the rest of the session. bp-enter's `to` is transform: none, which
            // satisfies that; a keyframe ending anywhere else reintroduces it.
            className="absolute inset-0 [animation:bp-enter_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
          >
            <Suspense fallback={<BpRouteFallback />}>
              {route.kind === "home" && <BpHome onSelect={openDetail} />}
              {route.kind === "anime" && <BpAnime onSelect={openDetail} />}
              {route.kind === "shows" && <BpShows onSelect={openDetail} />}
              {route.kind === "movies" && <BpMovies onSelect={openDetail} />}
              {route.kind === "live" && <BpLive />}
              {route.kind === "discover" && <BpDiscover onSelect={openDetail} />}
              {route.kind === "search" && <BpSearch onSelect={openDetail} />}
              {route.kind === "library" && <BpLibrary onSelect={openDetail} />}
              {route.kind === "detail" && (
                <BpDetail metaId={route.metaId} onSelect={openDetail} onSources={openSources} />
              )}
              {route.kind === "person" && (
                <BpPerson personId={route.personId} name={route.name} onSelect={openDetail} />
              )}
              {route.kind === "collection" && (
                <BpCollection
                  collectionId={route.collectionId}
                  name={route.name}
                  image={route.image}
                  onSelect={openDetail}
                />
              )}
              {route.kind === "collections" && (
                <BpCollections
                  onOpen={(c) =>
                    pushBigPicture({
                      kind: "tmdb-collection",
                      collectionId: c.collectionId,
                      name: c.name,
                      image: c.image,
                    })
                  }
                />
              )}
              {route.kind === "tmdb-collection" && (
                <BpCollectionDetail
                  collectionId={route.collectionId}
                  name={route.name}
                  image={route.image}
                  onSelect={openDetail}
                />
              )}
              {route.kind === "service" && (
                <BpService service={route.service} onSelect={openDetail} />
              )}
              {route.kind === "addon" && (
                <BpAddon
                  name={route.name}
                  base={route.base}
                  logo={route.logo}
                  onSelect={openDetail}
                />
              )}
              {route.kind === "settings" && <BpSettings />}
            </Suspense>
          </main>
          {sources && (
            <Suspense fallback={<BpRouteFallback />}>
              <BpStreams
                key={`${sources.meta.id}:${sources.episode?.videoId ?? ""}`}
                meta={sources.meta}
                episode={sources.episode}
                resume={sources.resume}
                autoPlay={sources.auto}
                applyPreference={sources.applyPreference}
                onClose={() => setSources(null)}
              />
            </Suspense>
          )}
          {introUp && <BpIntro pool={introPool} leaving={intro === "leaving"} />}
          {onboarding.open && (
            <BpOnboarding
              resumeIndex={onboarding.resumeIndex}
              onSuspend={onboarding.suspend}
              onComplete={onboarding.complete}
              onHint={setOnboardHint}
              steps={BP_ONBOARD_STEP_VIEWS}
            />
          )}
          {who.open && <BpWhoIsWatching onClose={who.close} />}
          {quickOpen && <BpQuickPanel onClose={() => setQuickOpen(false)} />}
          {phoneOpen && <BpPhoneTyping onClose={() => setPhoneOpen(false)} />}
          {confirmExit && (
            <BpExitConfirm
              onConfirm={() => {
                setConfirmExit(false);
                exitBigPicture();
              }}
              onCancel={() => setConfirmExit(false)}
            />
          )}
          <BpHintBar
            actions={
              onboarding.open
                ? onboardHint
                  ? [...ONBOARD_HINTS, onboardHint]
                  : ONBOARD_HINTS
                : sources
                  ? SOURCES_HINTS
                  : (HINTS[route.kind] ?? HINTS.home)
            }
            // Setup is a z-60 page like the source list, so the bar has to be
            // lifted over it or the only Back affordance is painted out.
            raised={Boolean(sources) || onboarding.open}
            // Every layer here is a [data-bp-dialog], and focusBpTopBar refuses
            // while one is open, so the jump is only real on a bare route. The
            // search route types into an input, where the handler stands down.
            jump={layer === "" && route.kind !== "search"}
          />
          <BpScreensaver blocked={introUp || layer !== ""} />
          <BpControllerToast />
        </div>,
        document.body,
      )}
    </>
  );
}
