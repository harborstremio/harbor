import { NavGlyph } from "@/components/icons/nav-glyph";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGamepads } from "@/lib/gamepad/store";
import { useParental, type HiddenTabs, type LockableTab } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { BpStatus } from "./bp-status";
import { BpProfileMenu } from "./bp-profile-menu";
import { useBpT } from "./bp-i18n";
import { HarborMark } from "@/components/icons/harbor-mark";
import { useHarborLogo } from "@/lib/harbor-logo";
import { goBigPictureTab, type BigPictureTabKind } from "@/lib/big-picture";

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type BpTab = {
  kind: BigPictureTabKind;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  hiddenByAnime?: boolean;
  parentalKey?: LockableTab;
};

const TABS: BpTab[] = [
  { kind: "home", label: "Home", icon: (a) => <HomeIcon active={a} /> },
  {
    kind: "discover",
    label: "Discover",
    icon: () => <NavGlyph name="explore" className="h-[26px] w-[26px] p-[2px]" />,
  },
  {
    kind: "anime",
    label: "Anime",
    icon: (a) => <AnimeIcon active={a} />,
    hiddenByAnime: true,
    parentalKey: "anime",
  },
  { kind: "shows", label: "Shows", icon: (a) => <TvIcon active={a} />, parentalKey: "shows" },
  {
    kind: "movies",
    label: "Movies",
    icon: (a) => <MoviesIcon active={a} />,
    parentalKey: "movies",
  },
  // Deliberately not gated on hasLive. A TV-only viewer has never seen the
  // desktop app, so hiding the tab until a playlist exists hid the only route to
  // adding one. Live TV owns its own setup screen when there is nothing yet.
  {
    kind: "live",
    label: "Live TV",
    icon: () => <NavGlyph name="livetv" className="h-[26px] w-[26px] p-[2px]" />,
  },
  {
    kind: "search",
    label: "Search",
    icon: () => <NavGlyph name="search" className="h-[26px] w-[26px] p-[2px]" />,
  },
  {
    kind: "library",
    label: "Library",
    icon: (a) => <LibraryIcon active={a} />,
    parentalKey: "library",
  },
  // Ungated for the same reason as Live TV: it needs a TMDB key, and hiding it
  // until there is one hid the only place that explains how to add one.
  {
    kind: "collections",
    label: "Collections",
    icon: () => <NavGlyph name="collections" className="h-[26px] w-[26px] p-[2px]" />,
  },
  { kind: "settings", label: "Settings", icon: (a) => <SettingsIcon active={a} /> },
];

export type BpTabGate = {
  animeHidden: boolean;
  locked: boolean;
  hiddenTabs: HiddenTabs;
};

// The tab strip and the shoulder cycle both read this, so a tab can never be
// hidden from one and reachable through the other.
export function useBpTabGate(): BpTabGate {
  const { settings } = useSettings();
  const { locked, hiddenTabs } = useParental();
  const animeHidden = Boolean(settings.hideContent.anime);
  return useMemo(() => ({ animeHidden, locked, hiddenTabs }), [animeHidden, locked, hiddenTabs]);
}

function visibleTabs(gate: BpTabGate): BpTab[] {
  return TABS.filter((tab) => {
    if (tab.hiddenByAnime && gate.animeHidden) return false;
    if (gate.locked && tab.parentalKey && gate.hiddenTabs[tab.parentalKey]) return false;
    return true;
  });
}

export function bpTabKinds(gate: BpTabGate): BigPictureTabKind[] {
  return visibleTabs(gate).map((tab) => tab.kind);
}

const ITEM_HEIGHT = "h-[clamp(44px,5vh,58px)]";

// Labelled tabs do not fit at 1280x800, so below 1400px every tab collapses to
// its icon and the strip fits with room to spare. Scrolling stays as the last
// resort, with the padding pair giving the focus glow room overflow would clip.
const TAB_TRACK =
  "flex w-full min-w-0 items-center gap-[clamp(8px,0.9vw,16px)] overflow-x-auto py-[24px] -my-[24px] px-[8px] -mx-[8px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// Harbor's nav icons are fixed 26px art with their own overflowing badges, so the
// box matches that size rather than restyling anything inside them.
const ICON_BOX = "flex h-[26px] w-[26px] shrink-0 items-center justify-center";

const TAB_BASE = `flex ${ITEM_HEIGHT} shrink-0 items-center whitespace-nowrap rounded-[var(--bp-r-xs)] text-[calc(clamp(15px,1.6vh,17px)*var(--bp-up,1))] font-semibold transition-colors duration-[var(--bp-dur-fast)]`;

type BpHint = { x: number; label: string } | null;

// The tab track scrolls horizontally, so overflow-y computes to auto and would
// clip anything hanging below a button. One hint lives in the nav instead and
// measures the tab it belongs to.
// Two bugs, one mechanism. Tailwind v4 compiles translate-y-* to the CSS
// `translate` property, so a transition list naming `transform` matched nothing
// the state classes wrote and only the opacity ever animated: the 5px rise, the
// entire craft in this component, did not exist at runtime. And the horizontal
// position was an inline `left`, which is not in any transition list and is a
// layout property anyway, so moving along the tab strip teleported the tooltip
// to the new x while cross-fading and read as two unrelated popups rather than
// as one thing travelling.
//
// Both now ride the same compositor-friendly `translate`, named correctly. The
// x is composed into it, so the -50% centring, the slide and the rise are one
// property on one per-screen element.
function BpTabHint({ hint }: { hint: BpHint }) {
  const x = hint ? hint.x : 0;
  return (
    <span
      aria-hidden
      style={{
        translate: `calc(${x}px - 50%) ${hint ? "0px" : "-5px"}`,
        opacity: hint ? 1 : 0,
      }}
      className="pointer-events-none absolute left-0 top-full z-10 pt-[clamp(6px,0.7vh,11px)] transition-[opacity,translate] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] motion-reduce:transition-none"
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-[clamp(2px,0.3vh,6px)] h-[9px] w-[9px] -translate-x-1/2 rotate-45 rounded-[2px] border-s border-t border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)]"
      />
      <span className="relative block whitespace-nowrap rounded-[var(--bp-r-sm)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)] px-[clamp(10px,0.9vw,17px)] py-[clamp(4px,0.6vh,9px)] text-[clamp(12px,1.55vh,17px)] font-semibold text-ink shadow-[0_10px_28px_rgba(0,0,0,0.45)]">
        {hint?.label ?? ""}
      </span>
    </span>
  );
}

function BpTabButton({
  tab,
  on,
  compact,
  title,
  onHint,
}: {
  tab: BpTab;
  on: boolean;
  compact?: boolean;
  title?: string;
  onHint: (el: HTMLElement | null, label: string) => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      // Named so a row can ask for its own destination by kind. bpChromeOrder
      // matches on this; without it nothing could target a specific tab and
      // Left out of any row landed on whichever tab was already active.
      data-bp-tab={tab.kind}
      data-bp-tab-on={on ? "true" : undefined}
      onClick={() => goBigPictureTab(tab.kind)}
      onMouseEnter={(e) => onHint(e.currentTarget, title ?? "")}
      onMouseLeave={() => onHint(null, "")}
      onFocus={(e) => onHint(e.currentTarget, title ?? "")}
      onBlur={() => onHint(null, "")}
      aria-label={title}
      className={`${TAB_BASE} justify-center ${
        !compact && on ? "gap-[clamp(6px,0.5vw,9px)] px-[clamp(11px,1vw,20px)]" : "aspect-square"
      } ${on ? "bg-[var(--bp-on)] text-ink" : "text-ink-subtle hover:text-ink"}`}
    >
      <span data-bp-tab-icon className={ICON_BOX}>
        {tab.icon(on)}
      </span>
      {!compact && on && <span>{title}</span>}
    </button>
  );
}

function BpShoulderHint({ label, usingPad }: { label: string; usingPad?: boolean }) {
  return (
    <span
      aria-hidden
      className={`${usingPad ? "flex" : "hidden min-[1400px]:flex"} ${ITEM_HEIGHT} min-w-[clamp(44px,5vh,58px)] shrink-0 items-center justify-center rounded-[var(--bp-r-sm)] border border-[var(--bp-edge-2)] px-2 text-[clamp(11px,1.5vh,16px)] font-bold tracking-wide text-ink-muted`}
    >
      {label}
    </span>
  );
}

export function BpTopBar({ active }: { active: BigPictureTabKind }) {
  const t = useBpT();
  const clock = useClock();
  const { mark: customMark, wordmark: customWordmark } = useHarborLogo();
  const usingPad = useGamepads().length > 0;
  const gate = useBpTabGate();
  const tabs = useMemo(() => visibleTabs(gate), [gate]);
  // Settings leaves the strip for the far right, but it stays in the same track
  // so Right off the last tab still reaches it instead of dying on a boundary.
  const strip = useMemo(() => tabs.filter((tab) => tab.kind !== "settings"), [tabs]);
  const cog = useMemo(() => tabs.find((tab) => tab.kind === "settings"), [tabs]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [hint, setHint] = useState<BpHint>(null);

  const onHint = useCallback((el: HTMLElement | null, label: string) => {
    const nav = navRef.current;
    if (!el || !nav || !label) {
      setHint(null);
      return;
    }
    const a = el.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    setHint({ x: a.left - b.left + a.width / 2, label });
  }, []);

  // The strip scrolls itself to the active tab, and a hint measured before that
  // scroll would sit over the wrong icon.
  useEffect(() => setHint(null), [active]);

  // Reaching a tab through a click or the shoulder cycle leaves focus on the
  // page body, so nothing else ever scrolls the strip to the current tab.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reveal = () => {
      const el = track.querySelector<HTMLElement>("[data-bp-tab-on='true']");
      if (!el) return;
      const t = track.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      const isRtl = getComputedStyle(track).direction === "rtl";
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const left = track.scrollLeft + (e.left - t.left) - (t.width - e.width) / 2;
      const target = isRtl ? Math.max(-max, Math.min(0, left)) : Math.max(0, Math.min(max, left));
      track.scrollTo({ left: target, behavior: "auto" });
    };
    reveal();
    const ro = new ResizeObserver(reveal);
    ro.observe(track);
    return () => ro.disconnect();
  }, [active, tabs.length]);

  return (
    <header
      data-bp-top-bar
      className="pointer-events-none absolute inset-x-0 top-0 z-30 grid h-[var(--bp-bar-h)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[clamp(9px,0.9vw,17px)] px-[var(--bp-gutter)] pt-[var(--bp-safe-y,0px)]"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[190%] rotate-180"
        style={{ background: "var(--bp-scrim-up)" }}
      />

      <div className="pointer-events-none relative col-start-1 flex items-center gap-[clamp(7px,0.7vw,13px)] justify-self-start">
        {customMark ? (
          <img
            src={customMark}
            alt=""
            draggable={false}
            className="h-[clamp(28px,3.4vh,44px)] w-auto shrink-0 object-contain"
          />
        ) : (
          <HarborMark className="h-[clamp(28px,3.4vh,44px)] w-[clamp(28px,3.4vh,44px)] shrink-0" />
        )}
        {customWordmark ? (
          <img
            src={customWordmark}
            alt=""
            draggable={false}
            className="h-[clamp(22px,2.7vh,36px)] w-auto object-contain"
          />
        ) : (
          <span
            className="hidden whitespace-nowrap text-[clamp(24px,3vh,40px)] font-medium leading-none tracking-tight text-ink [&_*]:text-inherit min-[1500px]:inline"
            style={{ fontFamily: '"Fraunces", "Iowan Old Style", "Georgia", serif' }}
          >
            Harb
            <span
              className="inline-block"
              style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
            >
              o
            </span>
            r
          </span>
        )}
      </div>

      <nav
        ref={navRef}
        data-bp-row
        className="pointer-events-auto relative col-start-2 flex min-w-0 items-center gap-[clamp(8px,0.9vw,16px)]"
      >
        {usingPad && <BpShoulderHint label="L1" usingPad={usingPad} />}
        <div ref={trackRef} data-bp-scroll-x className={TAB_TRACK}>
          {strip.map((tab) => (
            <BpTabButton
              key={tab.kind}
              tab={tab}
              on={tab.kind === active}
              title={t(tab.label)}
              onHint={onHint}
            />
          ))}
          {/* The profile joins Settings in the same track for the same reason
              Settings is here: column 3 sits outside [data-bp-row], so a
              focusable there dies on a boundary. It is not a tab because every
              item in the strip pushes a route and this one changes who the app
              belongs to, which is not something to scan past while browsing. */}
          <span className="ms-auto flex shrink-0 items-center gap-[clamp(8px,0.9vw,16px)] ps-[clamp(4px,0.4vw,8px)]">
            <span
              aria-hidden
              className="h-[clamp(20px,2.4vh,30px)] w-px shrink-0 bg-[var(--bp-edge-2)]"
            />
            <BpProfileMenu onHint={onHint} />
            {cog && (
              <BpTabButton
                tab={cog}
                on={cog.kind === active}
                compact
                title={t(cog.label)}
                onHint={onHint}
              />
            )}
          </span>
        </div>
        {usingPad && <BpShoulderHint label="R1" usingPad={usingPad} />}
        <BpTabHint hint={hint} />
      </nav>

      <div className="pointer-events-auto relative col-start-3 flex shrink-0 items-center justify-self-end gap-[clamp(9px,0.9vw,17px)] whitespace-nowrap">
        <BpStatus />
        <span
          data-bp-clock
          className="font-mono text-[clamp(14px,1.9vh,22px)] font-semibold tabular-nums leading-none text-ink"
        >
          {clock}
        </span>
      </div>
    </header>
  );
}
