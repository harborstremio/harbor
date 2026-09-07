import { lazy, startTransition, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LibraryKey } from "./settings/library-panel";
import type { RelayMode } from "./settings/relay-section";
import type { DebridKey } from "./settings/streaming-sources-panel";
import { SettingsTools } from "./settings/nav";
import { groupForSection, TOP_GROUPS } from "./settings/groups";
import { requestTracker } from "./settings/tracker-request";
import { SubTabsProvider, type SubTabReg } from "./settings/sub-tabs";
import { SettingsSidebar } from "./settings/settings-sidebar";
import { tabsFor } from "./settings/tab-registry";
import { PageActionsProvider, type PageActionReg } from "./settings/page-actions";
import { SettingsFooter } from "./settings/settings-footer";
import { SettingsActiveContext, type SectionId } from "./settings/shared";
import { SectionCards } from "./settings/section-cards";
import { LicensesPanel } from "./settings/licenses-panel";
import { IconsPanel } from "./settings/icons-panel";
import "./settings/tv-panel/store";
import { useThemeLibraryOpen } from "./settings/theme-panel/library-open-store";
import { BackToTop } from "@/components/back-to-top";
import { resetOmdbBudget } from "@/lib/providers/omdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { useMediaQuery } from "@/lib/use-media-query";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";

const IS_WEB = typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);

const SCROLL_TOP_MS = 420;

function glideToTop(el: HTMLElement): void {
  const from = el.scrollTop;
  if (from <= 0) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    el.scrollTo({ top: 0 });
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - started) / SCROLL_TOP_MS);
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    el.scrollTop = from * (1 - eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const BasicsPanel = lazy(() => import("./settings/basics-panel").then((m) => ({ default: m.BasicsPanel })));
const AccountStub = lazy(() => import("./settings/account").then((m) => ({ default: m.AccountStub })));
const LibraryPanel = lazy(() => import("./settings/library-panel").then((m) => ({ default: m.LibraryPanel })));
const RelaySection = lazy(() => import("./settings/relay-section").then((m) => ({ default: m.RelaySection })));
const StreamingSourcesPanel = lazy(() => import("./settings/streaming-sources-panel").then((m) => ({ default: m.StreamingSourcesPanel })));
const StreamFiltersPanel = lazy(() => import("./settings/stream-filters-panel").then((m) => ({ default: m.StreamFiltersPanel })));
const P2PPanel = lazy(() => import("./settings/p2p-panel").then((m) => ({ default: m.P2PPanel })));
const LanguagePanel = lazy(() => import("./settings/language-panel").then((m) => ({ default: m.LanguagePanel })));
const SubtitlesPanel = lazy(() => import("./settings/subtitles-panel").then((m) => ({ default: m.SubtitlesPanel })));
const QualityPanel = lazy(() => import("./settings/quality-panel").then((m) => ({ default: m.QualityPanel })));
const MpvPanel = lazy(() => import("./settings/mpv-panel").then((m) => ({ default: m.MpvPanel })));
const AnimePanel = lazy(() => import("./settings/anime-panel").then((m) => ({ default: m.AnimePanel })));
const ShadersPanel = lazy(() => import("./settings/shaders-panel").then((m) => ({ default: m.ShadersPanel })));
const PlayerLayoutPanel = lazy(() => import("./settings/player-layout-panel").then((m) => ({ default: m.PlayerLayoutPanel })));
const HotkeysPanel = lazy(() => import("./settings/hotkeys-panel").then((m) => ({ default: m.HotkeysPanel })));
const ControllersPanel = lazy(() => import("./settings/controllers-panel").then((m) => ({ default: m.ControllersPanel })));
const ThemePanel = lazy(() => import("./settings/theme-panel").then((m) => ({ default: m.ThemePanel })));
const StreamBadgesPanel = lazy(() => import("./settings/stream-badges-panel").then((m) => ({ default: m.StreamBadgesPanel })));
const AwardIconsPanel = lazy(() => import("./settings/award-icons-panel").then((m) => ({ default: m.AwardIconsPanel })));
const WebhooksPanel = lazy(() => import("./settings/webhooks-panel").then((m) => ({ default: m.WebhooksPanel })));
const BugReportPanel = lazy(() => import("./settings/bug-report-panel").then((m) => ({ default: m.BugReportPanel })));
const SupportPanel = lazy(() => import("./settings/support-panel").then((m) => ({ default: m.SupportPanel })));
const RemotesPanel = lazy(() => import("./settings/remotes-panel").then((m) => ({ default: m.RemotesPanel })));
const TvPanel = lazy(() => import("./settings/tv-panel").then((m) => ({ default: m.TvPanel })));
const StoragePanel = lazy(() => import("./settings/storage-panel").then((m) => ({ default: m.StoragePanel })));
const TrackersPanel = lazy(() => import("./settings/trackers-panel").then((m) => ({ default: m.TrackersPanel })));
const UpdatesPanel = lazy(() => import("./settings/updates-panel").then((m) => ({ default: m.UpdatesPanel })));
const AdvancedPanel = lazy(() => import("./settings/advanced-panel").then((m) => ({ default: m.AdvancedPanel })));


const SECTION_PRELOAD: Partial<Record<SectionId, () => Promise<unknown>>> = {
  basics: () => import("./settings/basics-panel"),
  account: () => import("./settings/account"),
  library: () => import("./settings/library-panel"),
  relay: () => import("./settings/relay-section"),
  streaming: () => import("./settings/streaming-sources-panel"),
  streamFilters: () => import("./settings/stream-filters-panel"),
  p2p: () => import("./settings/p2p-panel"),
  language: () => import("./settings/language-panel"),
  subtitles: () => import("./settings/subtitles-panel"),
  player: () => import("./settings/quality-panel"),
  mpv: () => import("./settings/mpv-panel"),
  anime: () => import("./settings/anime-panel"),
  shaders: () => import("./settings/shaders-panel"),
  playerLayout: () => import("./settings/player-layout-panel"),
  hotkeys: () => import("./settings/hotkeys-panel"),
  controllers: () => import("./settings/controllers-panel"),
  theme: () => import("./settings/theme-panel"),
  badges: () => import("./settings/stream-badges-panel"),
  awardIcons: () => import("./settings/award-icons-panel"),
  webhooks: () => import("./settings/webhooks-panel"),
  bug: () => import("./settings/bug-report-panel"),
  support: () => import("./settings/support-panel"),
  licenses: () => import("./settings/licenses-panel"),
  icons: () => import("./settings/icons-panel"),
  remotes: () => import("./settings/remotes-panel"),
  tv: () => import("./settings/tv-panel"),
  storage: () => import("./settings/storage-panel"),
  trackers: () => import("./settings/trackers-panel"),
  updates: () => import("./settings/updates-panel"),
  advanced: () => import("./settings/advanced-panel"),
};

const preloaded = new Set<SectionId>();
export function preloadSettingsSection(id: SectionId) {
  if (preloaded.has(id)) return;
  preloaded.add(id);
  void SECTION_PRELOAD[id]?.().catch(() => preloaded.delete(id));
}

const SECTION_META: Record<SectionId, { label: string; sub: string }> = {
  basics: {
    label: "Get started",
    sub: "The handful of settings most people set once. Sign in, choose how Play behaves, and pick your look.",
  },
  account: {
    label: "Account",
    sub: "Your Stremio sign-in. Library, watch progress, and addons sync from here.",
  },
  library: {
    label: "Library & metadata",
    sub: "Optional keys that unlock TMDB rails, baked-in poster ratings, fanart, and TVDB episode data.",
  },
  trakt: {
    label: "Trakt",
    sub: "Connect your Trakt account to scrobble playback, sync your watchlist, and pull personalized recommendations.",
  },
  anilist: {
    label: "AniList",
    sub: "Connect your AniList account to show your anime lists as rails on the Anime page.",
  },
  mal: {
    label: "MyAnimeList",
    sub: "Connect your MyAnimeList account to sync your watch progress and browse your list.",
  },
  simkl: {
    label: "Simkl",
    sub: "Connect your Simkl account to mark what you finish as watched and sync your plan-to-watch list across apps.",
  },
  letterboxd: {
    label: "Letterboxd",
    sub: "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.",
  },
  relay: {
    label: "Harbor Relay",
    sub: IS_WEB
      ? "Watch Together rooms are routed through Harbor's hosted relay."
      : "A Cloudflare Worker on your own account that hosts your Watch Together rooms.",
  },
  streaming: {
    label: "Streaming sources",
    sub: "How Harbor finds and resolves playable streams. Debrid keys and addon installs live here.",
  },
  streamFilters: {
    label: "Stream filters",
    sub: "Build a named filter once, then apply it in the source picker to trim a noisy stream list down to exactly what you want.",
  },
  p2p: {
    label: "P2P & servers",
    sub: "Harbor's built-in peer-to-peer engine, its self-test, and any streaming server you point it at.",
  },
  language: {
    label: "Languages",
    sub: "What language Harbor speaks, and which audio tracks it reaches for first.",
  },
  subtitles: {
    label: "Subtitles",
    sub: "Which languages, where they come from, how they sync, and how they look.",
  },
  player: {
    label: "Player & quality",
    sub: "Pick the playback engine and aspect, shape the audio, and set how episodes skip and advance.",
  },
  mpv: {
    label: "Video tuning",
    sub: "Match the picture quality to your computer, smooth out weak connections, and fine-tune the mpv engine with plain-language controls.",
  },
  anime: {
    label: "Anime tweaks",
    sub: "Smooth motion and where SVP fits in. Frame interpolation for anime lives here; picture shaders moved to their own tab.",
  },
  shaders: {
    label: "Shaders",
    sub: "GPU shaders that reshape the picture as it plays: Anime4K upscaling, HDR tone-mapping, neural upscalers, and sharpeners. Download the ones you want and Harbor applies them in the mpv engine.",
  },
  playerLayout: {
    label: "Player layout",
    sub: "Pick a theme, then rearrange every button in the player chrome. Hide what you never use, promote what you do.",
  },
  hotkeys: {
    label: "Hotkeys",
    sub: "Every shortcut Harbor responds to. Click a binding to rebind it.",
  },
  controllers: {
    label: "Controllers",
    sub: "Use a game controller to browse Harbor and control playback. Tune the sticks and see the button map.",
  },
  theme: {
    label: "Theme & appearance",
    sub: "Color presets, custom backgrounds, and the font pair Harbor renders in.",
  },
  badges: {
    label: "Stream badges",
    sub: "Remap the art for every format badge, write your own match rules, and import packs from the community.",
  },
  awardIcons: {
    label: "Award icons",
    sub: "Install icon packs or upload your own image for every award. Packs are hosted by their makers, not bundled with Harbor.",
  },
  webhooks: {
    label: "Webhooks",
    sub: "Push upcoming releases to Discord or Telegram. Pick which calendars feed the notifications.",
  },
  bug: {
    label: "Report a bug",
    sub: "Send a bug report straight to the Harbor team. Screenshots and screen recordings welcome.",
  },
  support: {
    label: "Support Harbor",
    sub: "Who keeps the lights on, what Harbor is built on, and where to put money if you want to.",
  },
  licenses: {
    label: "Licenses & attribution",
    sub: "Harbor's licence, the projects it is built on, and the people and services that make it possible.",
  },
  icons: {
    label: "Icons & animation",
    sub: "Every icon and animation drawn for Harbor, who drew them, and how to take one with you.",
  },
  remotes: {
    label: "Remotes",
    sub: "Harbor on your other devices: the web app, the phone remote, and the manga reader remote.",
  },
  tv: {
    label: "TV Settings",
    sub: "Set up your television from here. Everything on this page is written to your Harbor account and picked up by Big Picture on the TV, so you never have to type on a remote.",
  },
  storage: {
    label: "Storage",
    sub: "See what Harbor stores on this computer and clear caches when you want the space back.",
  },
  trackers: {
    label: "Trackers",
    sub: "Services that record what you watch. Connect the ones you use and tune what each one sends.",
  },
  updates: {
    label: "Updates & backup",
    sub: "Install updates, try beta builds, and keep a copy of your setup.",
  },
  advanced: {
    label: "Advanced",
    sub: "Diagnostics, manual overrides, things most users never need.",
  },
};

const CHROME_QUERY = 'header, [data-harbor-topchrome], [class~="fixed"]';
const CHROME_GAP = 4;
const CHROME_FLOOR = 40;
const CHROME_CEIL = 200;
const CHROME_TOP_EDGE = 12;

function measureTopChrome(shell: HTMLElement): number {
  let bottom = 0;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(CHROME_QUERY))) {
    if (el === shell || shell.contains(el) || el.contains(shell)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.visibility === "hidden" || cs.opacity === "0") continue;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 || rect.height > CHROME_CEIL) continue;
    if (rect.top > CHROME_TOP_EDGE) continue;
    if (rect.bottom > bottom) bottom = rect.bottom;
  }
  const ornament =
    Number.parseFloat(getComputedStyle(shell).getPropertyValue("--harbor-chrome-ornament")) || 0;
  return Math.max(CHROME_FLOOR, Math.min(CHROME_CEIL, Math.round(bottom + ornament)) + CHROME_GAP);
}

type SavedKey = LibraryKey | DebridKey;

export function Settings({ visible = true }: { visible?: boolean }) {
  const t = useT();
  const { settings, update } = useSettings();
  const [tmdbDraft, setTmdbDraft] = useState(settings.tmdbKey);
  const [omdbDraft, setOmdbDraft] = useState(settings.omdbKey);
  const [rpdbDraft, setRpdbDraft] = useState(settings.rpdbKey);
  const [fanartDraft, setFanartDraft] = useState(settings.fanartKey);
  const [tvdbDraft, setTvdbDraft] = useState(settings.tvdbKey);
  const [rdDraft, setRdDraft] = useState(settings.rdKey);
  const [tbDraft, setTbDraft] = useState(settings.tbKey);
  const [adDraft, setAdDraft] = useState(settings.adKey);
  const [pmDraft, setPmDraft] = useState(settings.pmKey);
  const [dlDraft, setDlDraft] = useState(settings.dlKey);
  const [savedKey, setSavedKey] = useState<SavedKey | null>(null);
  const { settingsSectionRequest, topKind, chromeHidden: viewChromeHidden } = useView();
  const TRACKER_IDS = ["trakt", "anilist", "mal", "simkl", "letterboxd"];
  const resolveSection = (id: string | null | undefined): SectionId => {
    if (!id) return "account";
    if (TRACKER_IDS.includes(id)) {
      requestTracker(id);
      return "trackers";
    }
    return id as SectionId;
  };
  const [landing, setLanding] = useState<string | null>(null);
  const [active, setActive] = useState<SectionId>(
    resolveSection(settingsSectionRequest.section),
  );
  const [relayMode, setRelayMode] = useState<RelayMode>("panel");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [pendingPage, setPendingPage] = useState<{ section: SectionId; tab?: string } | null>(null);
  const [query, setQuery] = useState("");
  const compact = useMediaQuery("(max-width: 899px)");
  const [browseOpen, setBrowseOpen] = useState(false);
  const browseRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!compact) setBrowseOpen(false);
  }, [compact]);

  useEffect(() => {
    if (!compact || !browseOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (!isBackKey(event) || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setBrowseOpen(false);
      browseRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", dismiss, true);
    return () => window.removeEventListener("keydown", dismiss, true);
  }, [compact, browseOpen]);

  const closeBrowse = () => {
    if (!compact) return;
    setBrowseOpen(false);
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  };

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    let raf = 0;
    let last = -1;
    const apply = () => {
      raf = 0;
      const next = measureTopChrome(shell);
      if (next === last) return;
      last = next;
      shell.style.setProperty("--hset-chrome-h", `${next}px`);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    apply();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    ro.observe(shell);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(CHROME_QUERY))) {
      if (el !== shell && !shell.contains(el)) ro.observe(el);
    }
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [
    settings.theme,
    settings.hybridTitleBar,
    settings.useNativeTitleBar,
    settings.customCss,
    topKind,
    viewChromeHidden,
  ]);

  const handleNav = (id: SectionId, anchor?: string) => {
    closeBrowse();
    setLanding(null);
    setPendingPage(null);
    startTransition(() => {
      setActive(id);
      setPendingAnchor(anchor ?? null);
    });
  };

  const pendingTab = useRef<string | null>(null);
  const selectFromRail = (id: SectionId, tab?: string) => {
    closeBrowse();
    setPendingPage(null);
    pendingTab.current = tab ?? null;
    if (id === active) {
      if (tab) subRegRef.current?.onChange(tab);
      pendingTab.current = null;
      return;
    }
    handleNav(id);
  };

  const openPage = (id: SectionId, tab?: string) => {
    selectFromRail(id, tab);
    setPendingAnchor(null);
    setPendingPage({ section: id, tab });
  };

  useEffect(() => {
    if (!settingsSectionRequest.section) return;
    setLanding(null);
    setActive(resolveSection(settingsSectionRequest.section));
  }, [settingsSectionRequest]);

  useEffect(() => {
    if (active !== "relay") setRelayMode("panel");
  }, [active]);

  const [pageActions, setPageActions] = useState<PageActionReg>(null);
  const [subRegRaw, setSubReg] = useState<SubTabReg>(null);
  const subReg = subRegRaw?.section === active && subRegRaw.tabs.length > 0 ? subRegRaw : null;
  const subRegRef = useRef<SubTabReg>(null);
  subRegRef.current = subReg;
  useEffect(() => {
    if (!import.meta.env.DEV || !subReg) return;
    const listed = tabsFor(active).map((tab) => tab.id);
    if (listed.length === 0) return;
    const live = subReg.tabs.map((tab) => tab.id);
    const missing = live.filter((id) => !listed.includes(id));
    if (missing.length) {
      console.warn(
        `[settings] tab-registry drift on "${active}" - sidebar missing [${missing.join(", ")}]`,
      );
    }
  }, [active, subReg]);
  useEffect(() => {
    const want = pendingTab.current;
    if (!want || !subReg) return;
    if (subReg.tabs.some((tab) => tab.id === want)) {
      pendingTab.current = null;
      if (subReg.value !== want) subReg.onChange(want);
    }
  }, [subReg]);

  useEffect(() => {
    if (!pendingPage || active !== pendingPage.section) return;
    if (pendingPage.tab && subReg?.value !== pendingPage.tab) return;
    scrollRef.current?.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
    setPendingPage(null);
  }, [active, pendingPage, subReg?.value]);

  const triedTabs = useRef<Set<string>>(new Set());
  const restoreTab = useRef<string | null>(null);
  const pendingAnchorRef = useRef<string | null>(null);
  pendingAnchorRef.current = pendingAnchor;

  useEffect(() => {
    if (pendingAnchorRef.current) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [active]);

  const lastSubTab = useRef<string | null>(null);
  useEffect(() => {
    const next = subReg?.value ?? null;
    const prev = lastSubTab.current;
    lastSubTab.current = next;
    if (prev === null || next === null || next === prev) return;
    if (pendingAnchorRef.current) return;
    const el = scrollRef.current;
    if (el) glideToTop(el);
  }, [subReg?.value]);

  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current && !pendingAnchorRef.current) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
    wasVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!pendingAnchor) return;
    const target = pendingAnchor;
    let tries = 0;
    let timer = 0;
    const findTarget = (): HTMLElement | null => {
      const exact = document.getElementById(target);
      if (exact) return exact;
      const root = scrollRef.current;
      if (!root) return null;
      const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id^="set-"]'));
      let best: HTMLElement | null = null;
      for (const s of sections) {
        if (!(s.id.startsWith(target) || target.startsWith(s.id))) continue;
        if (best == null || Math.abs(s.id.length - target.length) < Math.abs(best.id.length - target.length)) {
          best = s;
        }
      }
      return best;
    };
    const tryScroll = () => {
      const el = findTarget();
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.remove("hset-jumped");
        void el.offsetWidth;
        el.classList.add("hset-jumped");
        window.setTimeout(() => el.classList.remove("hset-jumped"), 1400);
        setPendingAnchor(null);
        return;
      }
      const reg = subRegRef.current;
      if (reg && triedTabs.current.size < reg.tabs.length) {
        const next = reg.tabs.find((tab) => !triedTabs.current.has(tab.id));
        if (next) {
          triedTabs.current.add(next.id);
          if (next.id !== reg.value) {
            reg.onChange(next.id);
            tries = 0;
            timer = window.setTimeout(tryScroll, 50);
            return;
          }
        }
      }
      if (tries++ < 30) timer = window.setTimeout(tryScroll, 50);
      else {
        if (restoreTab.current && subRegRef.current) subRegRef.current.onChange(restoreTab.current);
        setPendingAnchor(null);
      }
    };
    triedTabs.current = new Set();
    restoreTab.current = subRegRef.current?.value ?? null;
    if (subRegRef.current) triedTabs.current.add(subRegRef.current.value);
    timer = window.setTimeout(tryScroll, 60);
    return () => window.clearTimeout(timer);
  }, [active, pendingAnchor]);

  const saveKey = (which: SavedKey, value: string) => {
    const trimmed = value.trim();
    if (which === "tmdb") update({ tmdbKey: trimmed });
    else if (which === "omdb") {
      update({ omdbKey: trimmed });
      resetOmdbBudget();
    } else if (which === "rpdb") {
      if (trimmed) update({ rpdbKey: trimmed, showImdbBadge: false, showRtBadge: false });
      else update({ rpdbKey: trimmed });
    }
    else if (which === "fanart") update({ fanartKey: trimmed });
    else if (which === "tvdb") update({ tvdbKey: trimmed });
    else if (which === "rd") update({ rdKey: trimmed });
    else if (which === "tb") update({ tbKey: trimmed });
    else if (which === "ad") update({ adKey: trimmed });
    else if (which === "pm") update({ pmKey: trimmed });
    else if (which === "dl") update({ dlKey: trimmed });
    setSavedKey(which);
    setTimeout(() => setSavedKey((s) => (s === which ? null : s)), 1400);
  };

  const themeLibOpen = useThemeLibraryOpen();
  const wide = active === "theme" && themeLibOpen;
  const activeGroup = groupForSection(active);
  const landingGroup = landing ? (TOP_GROUPS.find((g) => g.id === landing) ?? null) : null;
  useEffect(() => {
    if (!activeGroup) return;
    const run = () => activeGroup.children.forEach((child) => preloadSettingsSection(child));
    const ric = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) { const h = ric(run); return () => (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(h); }
    const tid = window.setTimeout(run, 200);
    return () => window.clearTimeout(tid);
  }, [activeGroup]);

  useEffect(() => {
    if (themeLibOpen) scrollRef.current?.scrollTo({ top: 0 });
  }, [themeLibOpen]);

  const chromeHidden = wide || (active === "relay" && relayMode !== "panel");

  return (
    <SettingsActiveContext.Provider value={{ setActive: handleNav, openPage }}>
    <PageActionsProvider value={{ reg: pageActions, setReg: setPageActions }}>
    <SubTabsProvider value={{ section: active, reg: subReg, setReg: setSubReg }}>
    <div ref={shellRef} className="harbor-settings-shell flex h-full flex-col bg-canvas">
      <div
        data-tauri-drag-region
        className="hset-top-space shrink-0"
        style={{ blockSize: "var(--hset-chrome-h, 92px)" }}
      />
      <div className="hset-grid" data-browse-open={compact && browseOpen ? "" : undefined}>
        <SettingsTools query={query} setQuery={(value) => {
          setQuery(value);
          if (compact && value.trim()) setBrowseOpen(true);
        }} onSubmit={handleNav} />
        <div className="hset-heading">
          <div className="hset-content">
            <h1 ref={titleRef} tabIndex={-1} className="hset-title">
              {t(landingGroup?.label ?? SECTION_META[active].label)}
            </h1>
          </div>
          <button
            ref={browseRef}
            type="button"
            className="hset-browse-toggle"
            aria-expanded={browseOpen}
            aria-controls="hset-page-navigation"
            onClick={() => setBrowseOpen((open) => !open)}
          >
            {browseOpen ? t("Close pages") : t("Browse pages")}
          </button>
        </div>
        <SettingsSidebar
          active={active}
          activeTab={subReg?.value ?? null}
          meta={SECTION_META}
          query={query}
          onSelect={selectFromRail}
          onJump={handleNav}
        />
        <main ref={scrollRef} inert={compact && browseOpen} className="hset-main" data-hset-wide={wide ? "" : undefined}>
        <div className="hset-content">
          <Suspense
            fallback={
              <div
                className="h-64 rounded-md bg-elevated"
                aria-label={t("Loading settings")}
              />
            }
          >
          {landingGroup && (
            <SectionCards
              sections={landingGroup.children}
              meta={SECTION_META}
              onOpen={(id) => handleNav(id)}
            />
          )}
          <div
            key={active}
            className={`harbor-cascade flex flex-col ${landingGroup ? "hidden" : ""}`}
          >
          {active === "basics" && <BasicsPanel />}

          {active === "account" && <AccountStub />}

          {active === "library" && (
            <LibraryPanel
              tmdbDraft={tmdbDraft}
              omdbDraft={omdbDraft}
              rpdbDraft={rpdbDraft}
              fanartDraft={fanartDraft}
              tvdbDraft={tvdbDraft}
              setTmdbDraft={setTmdbDraft}
              setOmdbDraft={setOmdbDraft}
              setRpdbDraft={setRpdbDraft}
              setFanartDraft={setFanartDraft}
              setTvdbDraft={setTvdbDraft}
              savedKey={savedKey}
              saveKey={saveKey}
            />
          )}

          {active === "relay" && (
            <RelaySection mode={relayMode} onModeChange={setRelayMode} />
          )}

          {active === "streaming" && (
            <StreamingSourcesPanel
              rdDraft={rdDraft}
              tbDraft={tbDraft}
              adDraft={adDraft}
              pmDraft={pmDraft}
              dlDraft={dlDraft}
              setRdDraft={setRdDraft}
              setTbDraft={setTbDraft}
              setAdDraft={setAdDraft}
              setPmDraft={setPmDraft}
              setDlDraft={setDlDraft}
              savedKey={savedKey}
              saveKey={saveKey}
            />
          )}

          {active === "streamFilters" && <StreamFiltersPanel />}

          {active === "p2p" && <P2PPanel />}

          {active === "language" && <LanguagePanel />}
          {active === "subtitles" && <SubtitlesPanel />}

          {active === "player" && <QualityPanel />}

          {active === "mpv" && <MpvPanel />}

          {active === "anime" && <AnimePanel />}

          {active === "shaders" && <ShadersPanel />}

          {active === "playerLayout" && <PlayerLayoutPanel />}

          {active === "hotkeys" && <HotkeysPanel />}

          {active === "controllers" && <ControllersPanel />}






          {active === "theme" && <ThemePanel />}

          {active === "badges" && <StreamBadgesPanel />}
          {active === "awardIcons" && <AwardIconsPanel />}

          {active === "webhooks" && <WebhooksPanel />}

          {active === "bug" && <BugReportPanel />}
          {active === "support" && <SupportPanel />}

          {active === "remotes" && <RemotesPanel />}

          {active === "tv" && <TvPanel />}

          {active === "storage" && <StoragePanel />}

          {active === "trackers" && <TrackersPanel />}

          {active === "updates" && <UpdatesPanel />}

          {active === "advanced" && <AdvancedPanel />}

          {active === "licenses" && <LicensesPanel />}
          {active === "icons" && <IconsPanel />}
          </div>
          </Suspense>
        </div>
        {pageActions && !chromeHidden && <SettingsFooter reg={pageActions} />}
        </main>
      </div>
      <BackToTop scrollRef={scrollRef} />
    </div>
    </SubTabsProvider>
    </PageActionsProvider>
    </SettingsActiveContext.Provider>
  );
}
