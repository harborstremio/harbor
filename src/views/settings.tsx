import { lazy, startTransition, Suspense, useEffect, useRef, useState } from "react";
import type { LibraryKey } from "./settings/library-panel";
import type { RelayMode } from "./settings/relay-section";
import type { DebridKey } from "./settings/streaming-sources-panel";
import { SettingsNav } from "./settings/nav";
import { groupForSection } from "./settings/groups";
import { requestTracker } from "./settings/tracker-request";
import { SubTabsProvider, type SubTabReg } from "./settings/sub-tabs";
import { SubTabBar } from "./settings/sub-tab-bar";
import { SettingsActiveContext, type SectionId } from "./settings/shared";
import "./settings/tv-panel/store";
import { useThemeLibraryOpen } from "./settings/theme-panel/library-open-store";
import { BackToTop } from "@/components/back-to-top";
import { resetOmdbBudget } from "@/lib/providers/omdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

const IS_WEB = typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);

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

type SavedKey = LibraryKey | DebridKey;

export function Settings() {
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
  const { settingsSectionRequest } = useView();
  const TRACKER_IDS = ["trakt", "anilist", "mal", "simkl", "letterboxd"];
  const resolveSection = (id: string | null | undefined): SectionId => {
    if (!id) return "account";
    if (TRACKER_IDS.includes(id)) {
      requestTracker(id);
      return "trackers";
    }
    return id as SectionId;
  };
  const [active, setActive] = useState<SectionId>(
    resolveSection(settingsSectionRequest.section),
  );
  const [relayMode, setRelayMode] = useState<RelayMode>("panel");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);

  const handleNav = (id: SectionId, anchor?: string) => {
    startTransition(() => {
      setActive(id);
      setPendingAnchor(anchor ?? null);
    });
  };

  useEffect(() => {
    if (settingsSectionRequest.section) setActive(resolveSection(settingsSectionRequest.section));
  }, [settingsSectionRequest]);

  useEffect(() => {
    if (active !== "relay") setRelayMode("panel");
  }, [active]);

  const [subRegRaw, setSubReg] = useState<SubTabReg>(null);
  const subReg = subRegRaw && subRegRaw.tabs.length > 0 ? subRegRaw : null;
  const subRegRef = useRef<SubTabReg>(null);
  subRegRef.current = subReg;
  const triedTabs = useRef<Set<string>>(new Set());
  const restoreTab = useRef<string | null>(null);
  const pendingAnchorRef = useRef<string | null>(null);
  pendingAnchorRef.current = pendingAnchor;

  useEffect(() => {
    if (pendingAnchorRef.current) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [active]);

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
        el.style.transition = "box-shadow 0.5s ease";
        el.style.boxShadow = "0 0 0 2px var(--color-accent)";
        window.setTimeout(() => {
          el.style.boxShadow = "0 0 0 0 transparent";
        }, 1300);
        window.setTimeout(() => {
          el.style.transition = "";
          el.style.boxShadow = "";
        }, 1900);
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

  return (
    <SettingsActiveContext.Provider value={{ setActive }}>
    <SubTabsProvider value={{ reg: subReg, setReg: setSubReg }}>
    <div className="flex h-full bg-surface">
      <SettingsNav active={active} onChange={handleNav} />
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-28 pb-16"
      >
        <div
          data-tauri-drag-region
          className={wide ? "mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-8" : "mx-auto flex max-w-3xl flex-col gap-10 px-12"}
        >
          {!wide && !(active === "relay" && relayMode !== "panel") && (
            <header className="flex flex-col gap-4">
              <h1 className="font-display text-[32px] font-medium leading-[1.1] tracking-tight text-ink">
                {t(SECTION_META[active].label)}
              </h1>
              {subReg && (
                <SubTabBar tabs={subReg.tabs} value={subReg.value} onChange={subReg.onChange} />
              )}
            </header>
          )}

          <Suspense
            fallback={
              <div
                className="h-64 rounded-md bg-elevated"
                aria-label={t("Loading settings")}
              />
            }
          >
          <div key={active} className="harbor-cascade flex flex-col gap-10">
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
          </div>
          </Suspense>
        </div>
      </main>
      <BackToTop scrollRef={scrollRef} />
    </div>
    </SubTabsProvider>
    </SettingsActiveContext.Provider>
  );
}
