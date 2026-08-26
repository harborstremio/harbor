import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startIdleAway } from "@/lib/social/idle-away";
import { FloatingBack } from "@/chrome/floating-back";
import { ensureStaticHeroArt } from "@/lib/providers/anime-hero-art-static";
import { ensureCuratedLogos } from "@/lib/curated-logos";
import { ensureAwardMaster } from "@/lib/anime-awards-source";
import { WindowControls } from "@/chrome/window-controls";
import { HybridTitleBar } from "@/chrome/hybrid-title-bar";
import { WindowResizeEdges } from "@/chrome/window-resize-edges";
import { MinUIDock } from "@/chrome/minui-dock";
import { Sidebar } from "@/chrome/sidebar";
import { DraculaSidebar } from "@/chrome/dracula-sidebar";
import { NordSidebar } from "@/chrome/nord-sidebar";
import { ForestSidebar } from "@/chrome/forest-sidebar";
import { RoyalTopbar } from "@/chrome/royal-topbar";
import { SideRail } from "@/chrome/siderail";
import { StremioRail } from "@/chrome/stremio-rail";
import { TopDock } from "@/chrome/topdock";
import { CinematicOverlay } from "@/chrome/cinematic-overlay";
import { Topbar, TogetherButton } from "@/chrome/topbar";
import { startMaintenance, subscribeMemoryPressure } from "@/lib/maintenance";
import { MiddleClickScroll } from "@/lib/use-middle-click-scroll";
import { exitWindowFullscreenOnPlayerClose, toggleWindowFullscreen } from "@/lib/fullscreen-state";
import { flushCloudSync } from "@/views/player/hooks/use-stremio-sync";
import { startWriteQueueFlusher } from "@/lib/stremio-write-queue";
import { setNativeMemoryActive } from "@/lib/native-memory";
import { useOverlayPinned } from "@/lib/overlay-pin";
import { isMobileWeb, isRemoteRoute } from "@/lib/platform";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { activeLayout } from "@/lib/theme";
import { useThemePreview } from "@/lib/theme-preview";
import { DevErrorTrigger } from "@/components/dev-error-trigger";
import { ErrorView } from "@/components/error-view";
import { HarborErrorBoundary } from "@/components/error-boundary";
import { ContextMenu } from "@/components/context-menu";
import { WatchLocalModal } from "@/components/player/watch-local-modal";
import { LocalEpisodesModal } from "@/components/player/local-episodes-modal";
import { LocalVersionsModal } from "@/components/player/local-versions-modal";
import { CurfewGuard } from "@/components/curfew-guard";
import { HoverPreview } from "@/components/hover-preview";
import { CustomHoverCssMount } from "@/components/custom-hover-css-mount";
import { EmbedViewportRoot } from "@/components/embed-viewport";
import { InstallerViewportRoot } from "@/components/installer-viewport";
import { UpdateRoot } from "@/components/update/update-root";
import { VoyageRoot } from "@/components/voyage/voyage-root";
import { ScreensaverRoot } from "@/components/screensaver/screensaver-root";
import { CustomCodeMount } from "@/components/custom-code-mount";
import { MemoryHud } from "@/components/memory-hud";
import { OfflineBanner } from "@/chrome/offline-banner";
const MobileShell = lazy(() =>
  import("@/views/mobile/mobile-shell").then((m) => ({ default: m.MobileShell })),
);
import { WebhookLoopMount } from "@/components/webhook-loop-mount";
import { ListToastHost } from "@/components/lists/list-toast";
import { DiagnosticsConsentHost } from "@/components/diagnostics/diagnostics-consent-host";
import { AnnouncementGlobal } from "@/components/announcement-global";
import { TogetherChatToast } from "@/components/together-chat-toast";
import { TogetherCursors } from "@/components/together-cursors";
import { TogetherHostLeavingPrompt } from "@/components/together-host-leaving-prompt";
import { TogetherInviteToast } from "@/components/together-invite-toast";
import { TogetherSummonToast } from "@/components/together-summon-toast";
import { TogetherParticipantLeftToast } from "@/components/together-participant-left-toast";
import { AnilistSyncToast } from "@/components/anilist/anilist-sync-toast";
import { AnilistAvatarSync } from "@/components/anilist/anilist-avatar-sync";
import { MalAvatarSync } from "@/components/mal/mal-avatar-sync";
import { MalSyncToast } from "@/components/mal/mal-sync-toast";
import { TogetherLeaveForLiveModal } from "@/components/together-leave-for-live-modal";
import { ThemeBackdrop } from "@/components/theme-backdrop";
import { TopRankModal } from "@/components/top-rank-modal";
import { AuthProvider, useAuth } from "@/lib/auth";
import { listMangaProgress } from "@/lib/manga-progress";
import { ProfilesProvider, useProfiles } from "@/lib/profiles";
import { syncProfileStats } from "@/lib/social/stats-sync";
import { useFeaturedListsSync } from "@/lib/social/use-featured-sync";
import { useRatingsSync } from "@/lib/social/use-ratings-sync";
import { useActivitySync } from "@/lib/social/use-activity-sync";
import { authToken, currentAuthor, refreshToken } from "@/lib/theme-auth";
import { useAutoDownloadRunner } from "@/lib/auto-download/runner";
import { RemindersRunner } from "@/lib/reminders-runner";
import { MangaTrackingRunner } from "@/lib/manga-tracking";
import { RemoteHostMount } from "@/lib/remote/host-mount";
import { RemoteOpenBridge } from "@/lib/remote/remote-open-bridge";
import { GamepadRunner } from "@/components/gamepad-runner";
import { ProfileIdentitySync } from "@/lib/profile-identity-sync";
import { HarborAvatarSync } from "@/components/harbor-avatar-sync";
import { HarborNameSync } from "@/components/harbor-name-sync";
import { SettingsProfileBridge } from "@/lib/settings-profile-bridge";
import { TrackerProfileBridge } from "@/lib/tracker-profile-bridge";
import { ProfilePickerModal } from "@/components/profile-picker/picker-modal";
import { WatchlistSync } from "@/lib/watchlist-sync";
import { ContextMenuProvider } from "@/lib/context-menu";
import { TopRankModalProvider } from "@/lib/top-rank-modal";
import { OnboardingProvider } from "@/lib/onboarding";
import { RankingsProvider } from "@/lib/rankings";
import { SettingsProvider } from "@/lib/settings";
import { SearchProvider, useSearch } from "@/lib/search-context";
import { SearchOverlay } from "@/components/search/search-overlay";
import { SearchHotkey } from "@/components/search/search-hotkey";
import { TogetherProvider, useTogether } from "@/lib/together/provider";
import { DvrProvider } from "@/lib/dvr/provider";
import { FavoritesProvider } from "@/lib/iptv/favorites";
import { MediaFavoritesProvider } from "@/lib/media-favorites";
import { CharacterFavoritesProvider } from "@/lib/character-favorites";
import { MangaFavoritesProvider } from "@/lib/manga-favorites";
import { LocalWatchlistProvider } from "@/lib/local-watchlist";
import { useSettings } from "@/lib/settings";
import { torrentEngineSetOptions } from "@/lib/torrent/local-engine";
import { effectiveBinding, eventToBinding, shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { ViewProvider, useView, type Frame, type MetaFilter, type View } from "@/lib/view";
import { requestOpenProfile, requestEditProfile } from "@/lib/social/open-profile";
import { openNotificationCenter } from "@/lib/social/notification-open";
import { anchorFromElement, openAccountMenu } from "@/lib/social/account-menu-open";
import { getUnreadCount, subscribeUnread } from "@/lib/social/unread-bridge";
import { fetchMe } from "@/lib/account/identity";
import { ThemeChromeBridge } from "@/components/theme-chrome-bridge";
import type { MetaType } from "@/lib/cinemeta";
import { useDiscordPresence } from "@/lib/discord/use-discord-presence";
import { useWatchShare } from "@/lib/social/watch-presence";
import { useHungarianDomTranslation } from "@/lib/i18n/use-dom-translation";
import { Home } from "@/views/home";
import { ParentalProvider } from "@/lib/parental";
import { TraktProvider } from "@/lib/trakt/provider";
import { AnilistProvider } from "@/lib/anilist/provider";
import { MalProvider } from "@/lib/mal/provider";
import { SimklProvider } from "@/lib/simkl/provider";
import { LetterboxdProvider } from "@/lib/stremboxd/provider";
import { useKeyboardNavigation, tvFocus } from "@/lib/keyboard-navigation";
import { getNavFocusTarget } from "@/lib/keyboard-navigation/geometry";
import { SFX } from "@/lib/sfx";

const importAnime = () => import("@/views/anime");
const importCalendar = () => import("@/views/calendar");
const importWrapped = () => import("@/views/wrapped");
const importDetail = () => import("@/views/detail");
const importAddons = () => import("@/views/addons");
const importDiscover = () => import("@/views/discover");
const importCatalogs = () => import("@/views/catalogs");
const importAward = () => import("@/views/award");
const importAnimeAward = () => import("@/views/anime-award");
const importFilter = () => import("@/views/filter");
const importGrid = () => import("@/views/grid");
const importPerson = () => import("@/views/person");
const importPeople = () => import("@/views/people");
const importCollection = () => import("@/views/collection");
const importEpisodeDetail = () => import("@/views/episode-detail");
const importPlayPicker = () => import("@/views/play-picker");
const importPlayer = () => import("@/views/player");
const importMovies = () => import("@/views/movies");
const importKids = () => import("@/views/kids");
const importQueue = () => import("@/views/queue");
const importService = () => import("@/views/service");
const importSettings = () => import("@/views/settings");
const importShows = () => import("@/views/shows");
const importLibrary = () => import("@/views/library");
const importCommunityCollections = () => import("@/views/collections/community-hub");
const importLive = () => import("@/views/live");
const importVod = () => import("@/views/playlist-vod");
const importDownloads = () => import("@/views/downloads");
const importMatchDetail = () => import("@/views/live/match-detail-view");
const importOnboarding = () => import("@/components/onboarding");

const AnimeView = lazy(() => importAnime().then((m) => ({ default: m.AnimeView })));
const CalendarView = lazy(() => importCalendar().then((m) => ({ default: m.CalendarView })));
const WrappedView = lazy(() => importWrapped().then((m) => ({ default: m.WrappedView })));
const DetailView = lazy(() => importDetail().then((m) => ({ default: m.DetailView })));
const AddonsView = lazy(() => importAddons().then((m) => ({ default: m.AddonsView })));
const Discover = lazy(() => importDiscover().then((m) => ({ default: m.Discover })));
const Catalogs = lazy(() => importCatalogs().then((m) => ({ default: m.Catalogs })));
const AwardView = lazy(() => importAward().then((m) => ({ default: m.AwardView })));
const AnimeAwardView = lazy(() => importAnimeAward().then((m) => ({ default: m.AnimeAwardView })));
const FilterView = lazy(() => importFilter().then((m) => ({ default: m.FilterView })));
const GridView = lazy(() => importGrid().then((m) => ({ default: m.GridView })));
const PersonView = lazy(() => importPerson().then((m) => ({ default: m.PersonView })));
const PeopleView = lazy(() => importPeople().then((m) => ({ default: m.PeopleView })));
const ProfileView = lazy(() =>
  import("@/views/profile/profile").then((m) => ({ default: m.ProfileView })),
);
const SharedListView = lazy(() =>
  import("@/views/shared-list").then((m) => ({ default: m.SharedListView })),
);
const FeedView = lazy(() => import("@/views/feed").then((m) => ({ default: m.FeedView })));
const GroupsView = lazy(() => import("@/views/groups").then((m) => ({ default: m.GroupsView })));
const GroupView = lazy(() => import("@/views/group").then((m) => ({ default: m.GroupView })));
const CollectionView = lazy(() => importCollection().then((m) => ({ default: m.CollectionView })));
const AddonCollectionView = lazy(() =>
  import("@/views/addon-collection").then((m) => ({ default: m.AddonCollectionView })),
);
const EpisodeDetailView = lazy(() =>
  importEpisodeDetail().then((m) => ({ default: m.EpisodeDetailView })),
);
const CollectionsView = lazy(() =>
  import("@/views/collections").then((m) => ({ default: m.CollectionsView })),
);
const CommunityCollectionsView = lazy(() =>
  importCommunityCollections().then((m) => ({ default: m.CommunityCollectionsView })),
);
const PlayPicker = lazy(() => importPlayPicker().then((m) => ({ default: m.PlayPicker })));
const PlayerView = lazy(() => importPlayer().then((m) => ({ default: m.PlayerView })));
const Movies = lazy(() => importMovies().then((m) => ({ default: m.Movies })));
const Kids = lazy(() => importKids().then((m) => ({ default: m.Kids })));
const KidsDetailView = lazy(() =>
  import("@/views/kids-detail").then((m) => ({ default: m.KidsDetailView })),
);
const QueueView = lazy(() => importQueue().then((m) => ({ default: m.QueueView })));
const ServiceView = lazy(() => importService().then((m) => ({ default: m.ServiceView })));
const Settings = lazy(() => importSettings().then((m) => ({ default: m.Settings })));
const Shows = lazy(() => importShows().then((m) => ({ default: m.Shows })));
const LibraryView = lazy(() => importLibrary().then((m) => ({ default: m.LibraryView })));
const LiveView = lazy(() => importLive().then((m) => ({ default: m.LiveView })));
const MatchDetailView = lazy(() =>
  importMatchDetail().then((m) => ({ default: m.MatchDetailView })),
);
const PlaylistVodView = lazy(() => importVod().then((m) => ({ default: m.PlaylistVodView })));
const DownloadsView = lazy(() => importDownloads().then((m) => ({ default: m.DownloadsView })));
const MangaView = lazy(() => import("@/views/manga").then((m) => ({ default: m.MangaView })));
const OnboardingModal = lazy(() =>
  importOnboarding().then((m) => ({ default: m.OnboardingModal })),
);

function useViewPreloader(tmdbKey: string, enabled: boolean) {
  const keyRef = useRef(tmdbKey);
  keyRef.current = tmdbKey;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const warmCommonViews = () => {
      if (cancelled) return;
      // These are the paths most often reached from the first screen. The
      // rest stay genuinely lazy instead of importing almost the whole app.
      void importDetail();
      void importPlayPicker();
      void importPlayer();
      void importSettings();
      if (keyRef.current) {
        void import("@/lib/feed/pool").then((m) => m.getPool(keyRef.current)).catch(() => {});
      }
    };
    const idle = typeof win.requestIdleCallback === "function";
    const handle = idle
      ? win.requestIdleCallback!(warmCommonViews, { timeout: 2500 })
      : window.setTimeout(warmCommonViews, 1200);
    return () => {
      cancelled = true;
      if (idle) win.cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
    };
  }, [enabled]);
}

const KEEP_ALIVE_MS = 1500;
const IDLE_EVICT_MS = 60 * 1000;
const PRESSURE_EVICT_MS = 1500;
const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 1.6;
const UI_SCALE_STEP = 0.05;
const UI_SCALE_ACTIVITY_EVENT = "harbor:ui-scale-activity";

function clampUiScale(scale: number): number {
  return Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, Math.round(scale * 100) / 100));
}

function useKeepAlive(active: boolean, requested: boolean, pin = false): boolean {
  const [mounted, setMounted] = useState(active && requested);
  useEffect(() => {
    if (!requested) {
      setMounted(false);
      return;
    }
    if (active || pin) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), KEEP_ALIVE_MS);
    return () => clearTimeout(t);
  }, [active, requested, pin]);
  return requested && (mounted || active || pin);
}

function useIdleEvict(active: boolean, pin = false): boolean {
  const [alive, setAlive] = useState(active);
  const [pressure, setPressure] = useState(false);
  useEffect(() => subscribeMemoryPressure(setPressure), []);
  useEffect(() => {
    if (active || pin) {
      setAlive(true);
      return;
    }
    if (!alive) return;
    const t = setTimeout(() => setAlive(false), pressure ? PRESSURE_EVICT_MS : IDLE_EVICT_MS);
    return () => clearTimeout(t);
  }, [active, alive, pressure, pin]);
  return alive || active || pin;
}

export function App({ onReady }: { onReady?: () => void }) {
  useHungarianDomTranslation();
  return (
    <SettingsProvider>
      <ProfilesProvider>
        <ParentalProvider>
          <TraktProvider>
            <AnilistProvider>
              <MalProvider>
                <SimklProvider>
                  <LetterboxdProvider>
                    <RankingsProvider>
                      <AuthProvider>
                        <OnboardingProvider>
                          <TogetherProvider>
                            <ViewProvider>
                              <SearchProvider>
                                <DvrProvider>
                                  <FavoritesProvider>
                                    <MediaFavoritesProvider>
                                      <CharacterFavoritesProvider>
                                        <MangaFavoritesProvider>
                                          <LocalWatchlistProvider>
                                            <ContextMenuProvider>
                                              <TopRankModalProvider>
                                                <HarborErrorBoundary>
                                                  <ProfileIdentitySync />
                                                  <HarborAvatarSync />
                                                  <HarborNameSync />
                                                  <SettingsProfileBridge />
                                                  <TrackerProfileBridge />
                                                  <AnilistAvatarSync />
                                                  <MalAvatarSync />
                                                  <MiddleClickScroll />
                                                  <ThemeBackdrop />
                                                  <WatchlistSync />
                                                  {isMobileWeb() || isRemoteRoute() ? (
                                                    <>
                                                      <Suspense fallback={null}>
                                                        <MobileShell />
                                                      </Suspense>
                                                      <RevealOnMount onReady={onReady} />
                                                    </>
                                                  ) : (
                                                    <Shell onReady={onReady} />
                                                  )}
                                                  {!isMobileWeb() && !isRemoteRoute() && (
                                                    <Suspense fallback={null}>
                                                      <OnboardingModal />
                                                    </Suspense>
                                                  )}
                                                  <TogetherInviteToast />
                                                  <TogetherFloater />
                                                  <TogetherHostLeavingPrompt />
                                                  <TogetherSummonToast />
                                                  <TogetherParticipantLeftToast />
                                                  <AnilistSyncToast />
                                                  <MalSyncToast />
                                                  <ListToastHost />
                                                  <DiagnosticsConsentHost />
                                                  <TogetherLeaveForLiveModal />
                                                  <TogetherLocationPublisher />
                                                  <IdleAwayRunner />
                                                  <SessionRefreshRunner />
                                                  <StatsSyncRunner />
                                                  <FeaturedListsSyncRunner />
                                                  <RatingsSyncRunner />
                                                  <ActivitySyncRunner />
                                                  <AutoDownloadRunner />
                                                  <RemindersRunner />
                                                  <MangaTrackingRunner />
                                                  <RemoteHostMount />
                                                  <RemoteOpenBridge />
                                                  <GamepadRunner />
                                                  <DiscordPresence />
                                                  <WatchPresenceRunner />
                                                  <ContextMenu />
                                                  <AnnouncementGlobal />
                                                  <WatchLocalModal />
                                                  <LocalEpisodesModal />
                                                  <LocalVersionsModal />
                                                  <HoverPreview />
                                                  <CustomHoverCssMount />
                                                  <TopRankModal />
                                                  <ProfilePickerModal />
                                                  <CurfewGuard />
                                                  <SearchOverlay />
                                                  <SearchHotkey />
                                                  <EmbedViewportRoot />
                                                  <InstallerViewportRoot />
                                                  <UpdateRoot />
                                                  <VoyageRoot />
                                                  <ScreensaverRoot />
                                                </HarborErrorBoundary>
                                                <ErrorView />
                                                <DevErrorTrigger />
                                              </TopRankModalProvider>
                                            </ContextMenuProvider>
                                          </LocalWatchlistProvider>
                                        </MangaFavoritesProvider>
                                      </CharacterFavoritesProvider>
                                    </MediaFavoritesProvider>
                                  </FavoritesProvider>
                                </DvrProvider>
                              </SearchProvider>
                            </ViewProvider>
                          </TogetherProvider>
                        </OnboardingProvider>
                      </AuthProvider>
                    </RankingsProvider>
                  </LetterboxdProvider>
                </SimklProvider>
              </MalProvider>
            </AnilistProvider>
          </TraktProvider>
        </ParentalProvider>
      </ProfilesProvider>
    </SettingsProvider>
  );
}

function TogetherFloater() {
  const { chromeHidden } = useView();
  if (chromeHidden) return null;
  return (
    <>
      <TogetherChatToast />
      <TogetherCursors />
    </>
  );
}

function AutoDownloadRunner() {
  const { settings } = useSettings();
  useAutoDownloadRunner(settings.backgroundNetworkActivity);
  return null;
}

function FeaturedListsSyncRunner() {
  useFeaturedListsSync();
  return null;
}

function RatingsSyncRunner() {
  useRatingsSync();
  return null;
}

function ActivitySyncRunner() {
  useActivitySync();
  return null;
}

const SESSION_REFRESH_MS = 6 * 60 * 60 * 1000;

function SessionRefreshRunner() {
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - last < 60000) return;
      last = now;
      void refreshToken();
    };
    refresh();
    const onProfile = () => {
      last = 0;
      refresh();
    };
    const onWake = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, SESSION_REFRESH_MS);
    window.addEventListener("harbor:active-profile-changed", onProfile);
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("harbor:active-profile-changed", onProfile);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", refresh);
    };
  }, []);
  return null;
}

function IdleAwayRunner() {
  useEffect(() => startIdleAway(), []);
  return null;
}

const STATS_SYNC_FIRST_MS = 4000;
const STATS_SYNC_EVERY_MS = 600000;
const STATS_SYNC_MIN_GAP_MS = 120000;

function StatsSyncRunner() {
  const { authKey } = useAuth();
  const { activeId } = useProfiles();
  useEffect(() => {
    if (!authToken()) return;
    const pid = activeId ?? "default";
    let last = 0;
    let alive = true;
    const run = (force: boolean) => {
      if (!alive || !authToken()) return;
      const now = performance.now();
      if (!force && now - last < STATS_SYNC_MIN_GAP_MS) return;
      last = now;
      syncProfileStats(authKey, listMangaProgress(pid).length).catch(() => {});
    };
    const first = window.setTimeout(() => run(true), STATS_SYNC_FIRST_MS);
    const every = window.setInterval(() => run(false), STATS_SYNC_EVERY_MS);
    const onFocus = () => run(false);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(every);
      window.removeEventListener("focus", onFocus);
    };
  }, [authKey, activeId]);
  return null;
}

function TogetherLocationPublisher() {
  const { topKind, meta, personId, picker, player, service, addonDetailId } = useView();
  const { snapshot, sendPresence } = useTogether();
  const inSession = snapshot.state === "joined";
  const participantsCount = snapshot.participants.length;
  useEffect(() => {
    if (!inSession) return;
    const location = computeLocation();
    sendPresence(location ?? undefined);
    const id = window.setInterval(() => sendPresence(location ?? undefined), 6000);
    return () => window.clearInterval(id);
    function computeLocation(): import("@/lib/together/protocol").ParticipantLocation | null {
      const metaToLoc = (m: import("@/lib/cinemeta").Meta) => ({
        id: m.id,
        type: (m.type === "series" ? "series" : "movie") as "movie" | "series",
        name: m.name,
        poster: m.poster,
        background: m.background,
        releaseInfo: m.releaseInfo,
        logo: m.logo,
      });
      if (player) {
        return {
          kind: "player" as const,
          meta: metaToLoc(player.meta),
          episode: player.episode
            ? {
                season: player.episode.season,
                episode: player.episode.episode,
                name: player.episode.name,
              }
            : undefined,
        };
      }
      if (picker) {
        return {
          kind: "picker" as const,
          meta: metaToLoc(picker.meta),
          episode: picker.episode
            ? {
                season: picker.episode.season,
                episode: picker.episode.episode,
                name: picker.episode.name,
              }
            : undefined,
        };
      }
      if (topKind === "meta" && meta) return { kind: "meta" as const, meta: metaToLoc(meta) };
      if (topKind === "person" && personId != null) return { kind: "person" as const, personId };
      if (topKind === "service" && service) return { kind: "service" as const, service };
      if (topKind === "addon-detail" && addonDetailId)
        return { kind: "addon-detail" as const, addonId: addonDetailId };
      if (topKind === "home") return { kind: "home" };
      if (topKind === "discover") return { kind: "discover" };
      if (topKind === "anime") return { kind: "anime" };
      if (topKind === "queue") return { kind: "queue" };
      if (topKind === "addons") return { kind: "addons" };
      if (topKind === "library") return { kind: "home" };
      if (topKind === "settings") return { kind: "settings" };
      return null;
    }
  }, [
    inSession,
    sendPresence,
    topKind,
    meta?.id,
    personId,
    picker?.meta.id,
    picker?.episode?.season,
    picker?.episode?.episode,
    player?.meta.id,
    player?.episode?.season,
    player?.episode?.episode,
    service,
    addonDetailId,
    participantsCount,
  ]);
  return null;
}

function DiscordPresence() {
  useDiscordPresence();
  return null;
}

function WatchPresenceRunner() {
  useWatchShare();
  return null;
}

function filterReactKey(f: MetaFilter): string {
  if (f.kind === "year" || f.kind === "runtime")
    return `filter-${f.kind}-${f.mediaType}-${f.value}`;
  if (f.kind === "country" || f.kind === "language")
    return `filter-${f.kind}-${f.mediaType}-${f.iso}`;
  return `filter-${f.kind}-${f.mediaType}-${f.id}`;
}

function parseDeepLinkEpisode(videoId?: string): { season: number; episode: number } | undefined {
  if (!videoId) return undefined;
  const parts = videoId.split(":");
  if (parts.length < 3) return undefined;
  const season = Number(parts[parts.length - 2]);
  const episode = Number(parts[parts.length - 1]);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return undefined;
  return { season, episode };
}

function RevealOnMount({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

function Shell({ onReady }: { onReady?: () => void }) {
  const {
    topKind,
    service,
    meta,
    metaLiveContext,
    metaEpisodeHint,
    episodeDetail,
    personId,
    profileHandle,
    feedOpen,
    groupsOpen,
    groupId,
    listHandle,
    listId,
    openList,
    collectionId,
    addonCollectionMeta,
    filter,
    grid,
    awardType,
    animeAwardSource,
    picker,
    player,
    setView,
    canGoBack,
    goBack,
    canGoForward,
    goForward,
    openMeta,
    openManga,
    peopleInit,
    openPlayer,
    stackKinds,
    chromeHidden,
  } = useView();
  const { settings, update } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const uiScaleRef = useRef(settings.uiScale);
  const { activeProfile } = useProfiles();
  const kid = activeProfile?.kid ?? null;
  const preview = useThemePreview();
  useEffect(() => {
    void ensureCuratedLogos();
    const id = window.setTimeout(() => {
      void ensureStaticHeroArt();
      void ensureAwardMaster();
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    void torrentEngineSetOptions(
      settings.streamCacheDir || null,
      settings.streamCacheRetentionHours,
      settings.streamCacheMaxGb,
      false,
    );
  }, [settings.streamCacheDir, settings.streamCacheRetentionHours, settings.streamCacheMaxGb]);
  const baseLayout = useMemo(
    () => (preview ? preview.layout : activeLayout(settings.theme)),
    [preview, settings.theme],
  );
  const layout = kid ? "sidebar" : baseLayout;
  const themeHasTopbar =
    layout === "sidebar" ||
    layout === "dracula" ||
    layout === "nord" ||
    layout === "forest" ||
    layout === "stremio";
  useViewPreloader(settings.tmdbKey, settings.preloadViews);

  useEffect(() => {
    if (topKind === "home") return;
    onReady?.();
  }, [onReady, topKind]);

  const handleTvBack = useCallback(() => {
    if (stackKinds.length > 1 || topKind !== "home") {
      goBack();
      return true;
    }
    return false;
  }, [goBack, stackKinds.length, topKind]);

  const handleTvBackToNav = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const nav = getNavFocusTarget();
        if (nav) tvFocus(nav);
      }),
    );
  }, []);

  useKeyboardNavigation({
    enabled: settings.tvNavigation && !player && !picker,
    wrap: false,
    onBack: handleTvBack,
    onBackToNav: handleTvBackToNav,
  });

  useEffect(() => {
    SFX.setTheme(settings.soundTheme);
    const volume = settings.sfxVolume ?? 50;
    SFX.setVolume(volume / 100);
  }, [settings.soundTheme, settings.sfxVolume]);

  useEffect(() => {
    if (settings.soundTheme === "none") return;
    const initAudio = () => SFX.init();
    window.addEventListener("pointerdown", initAudio, { once: true });
    window.addEventListener("keydown", initAudio, { once: true });

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(
        'a[href], button, [data-focusable="true"], [role="button"]',
      ) as HTMLElement | null;

      if (!interactive) return;

      const related = e.relatedTarget as Node | null;
      if (related && interactive.contains(related)) return;

      SFX.hover();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const btn = target.closest(
        'button, a[href], [data-focusable="true"], [role="button"]',
      ) as HTMLElement | null;

      if (!btn) return;

      const isCloseAction =
        (btn.getAttribute("aria-label") || "").toLowerCase().includes("back") ||
        btn.matches(
          "[data-harbor-back], [data-back], [data-close], [data-tv-modal-close], .close-btn, .back-btn",
        ) ||
        !!btn.closest(
          "[data-harbor-back], [data-back], [data-close], [data-tv-modal-close], .close-btn, .back-btn",
        );

      const isMovieCard =
        btn.hasAttribute("data-media-card") ||
        btn.hasAttribute("data-movie-card") ||
        btn.classList.contains("media-card") ||
        !!btn.querySelector("img") ||
        !!btn.closest("[data-tv-hero-zone]");

      const isMenuOrSettings = !!btn.closest(
        '.settings-panel, [role="menu"], [role="dialog"], [data-settings-root], [data-settings-panel]',
      );

      if (isCloseAction) {
        SFX.close();
        return;
      }

      if (isMovieCard || isMenuOrSettings) {
        SFX.open();
        return;
      }

      SFX.click();
    };
    window.addEventListener("mouseover", onMouseOver);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", initAudio);
      window.removeEventListener("keydown", initAudio);
      window.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("click", onClick, true);
    };
  }, [settings.soundTheme]);

  useEffect(() => {
    startWriteQueueFlusher();
    return startMaintenance();
  }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 3) {
        const localBack = new Event("harbor:local-back", { cancelable: true });
        if (!window.dispatchEvent(localBack)) {
          e.preventDefault();
          return;
        }
        if (canGoBack) {
          e.preventDefault();
          goBack();
        }
      } else if (e.button === 4 && canGoForward) {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [canGoBack, goBack, canGoForward, goForward]);

  useEffect(() => {
    uiScaleRef.current = settings.uiScale;
  }, [settings.uiScale]);

  useEffect(() => {
    const setUiScale = (next: number) => {
      const uiScale = clampUiScale(next);
      if (uiScale !== uiScaleRef.current) {
        uiScaleRef.current = uiScale;
        update({ uiScale });
      }
    };
    const stepUiScale = (direction: 1 | -1) => {
      setUiScale(uiScaleRef.current + direction * UI_SCALE_STEP);
    };
    const usesZoomModifier = (e: KeyboardEvent | WheelEvent) => e.ctrlKey || e.metaKey;
    const isDefaultUiScaleUp = (e: KeyboardEvent) =>
      usesZoomModifier(e) && (e.key === "+" || e.key === "=");
    const isDefaultUiScaleDown = (e: KeyboardEvent) =>
      usesZoomModifier(e) && (e.key === "-" || e.key === "_");
    const isDefaultUiScaleReset = (e: KeyboardEvent) => usesZoomModifier(e) && e.key === "0";
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(e)) return;
      const binding = eventToBinding(e);
      const overrides = settings.hotkeys ?? {};
      const uiScaleUpCustom = "globalUiScaleUp" in overrides;
      const uiScaleDownCustom = "globalUiScaleDown" in overrides;
      const uiScaleResetCustom = "globalUiScaleReset" in overrides;
      const matchesUp =
        effectiveBinding("globalUiScaleUp", overrides) === binding ||
        (!uiScaleUpCustom && isDefaultUiScaleUp(e));
      const matchesDown =
        effectiveBinding("globalUiScaleDown", overrides) === binding ||
        (!uiScaleDownCustom && isDefaultUiScaleDown(e));
      const matchesReset =
        effectiveBinding("globalUiScaleReset", overrides) === binding ||
        (!uiScaleResetCustom && isDefaultUiScaleReset(e));
      if (!matchesUp && !matchesDown && !matchesReset) return;
      if (player && matchesReset) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      window.dispatchEvent(new Event(UI_SCALE_ACTIVITY_EVENT));
      if (matchesReset) {
        setUiScale(1);
      } else if (matchesUp) {
        stepUiScale(1);
      } else if (matchesDown) {
        stepUiScale(-1);
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!usesZoomModifier(e)) return;
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new Event(UI_SCALE_ACTIVITY_EVENT));
      stepUiScale(e.deltaY < 0 ? 1 : -1);
    };
    let wheelBound = false;
    const bindWheel = () => {
      if (wheelBound) return;
      wheelBound = true;
      window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    };
    const unbindWheel = () => {
      if (!wheelBound) return;
      wheelBound = false;
      window.removeEventListener("wheel", onWheel, true);
    };
    const onModKey = (e: KeyboardEvent) => {
      if (usesZoomModifier(e)) bindWheel();
      else unbindWheel();
    };
    const onPinchWheel = (e: WheelEvent) => {
      if (wheelBound || !usesZoomModifier(e)) return;
      window.dispatchEvent(new Event(UI_SCALE_ACTIVITY_EVENT));
      stepUiScale(e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", onModKey, true);
    window.addEventListener("keyup", onModKey, true);
    window.addEventListener("blur", unbindWheel);
    window.addEventListener("wheel", onPinchWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", onModKey, true);
      window.removeEventListener("keyup", onModKey, true);
      window.removeEventListener("blur", unbindWheel);
      window.removeEventListener("wheel", onPinchWheel);
      unbindWheel();
    };
  }, [player, settings.hotkeys, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(e)) return;
      if (e.repeat) return;
      if (e.key === "F11") {
        e.preventDefault();
        void toggleWindowFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("harbor://app-closing", async () => {
        await flushCloudSync().catch(() => {});
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("harbor_flush_done").catch(() => {});
      }).then((rawUnlisten) => {
        const u = makeSafeTauriUnlisten(rawUnlisten);
        if (cancelled) u();
        else unlisten = u;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const w = window as unknown as { harbor?: Record<string, unknown> };
    w.harbor = {
      ...(w.harbor ?? {}),
      navigate: (v: string) => setView(v as View),
      back: () => goBack(),
      search: () => setSearchOpen(true),
      openSettings: () => setView("settings"),
      openNotifications: () => openNotificationCenter(),
      openAccountMenu: (el?: unknown) => openAccountMenu(anchorFromElement(el)),
      viewMyProfile: async () => {
        let handle = currentAuthor()?.handle;
        if (!handle) {
          await fetchMe().catch(() => {});
          handle = currentAuthor()?.handle;
        }
        if (handle) requestOpenProfile(handle);
      },
      unreadCount: () => getUnreadCount(),
      onUnread: (cb: (count: number) => void) =>
        typeof cb === "function" ? subscribeUnread(cb) : () => {},
    };
  }, [setView, goBack, setSearchOpen]);

  useEffect(() => {
    if (topKind !== "live") {
      void import("@/lib/multiview/bridge").then(({ mvStopAll }) => mvStopAll().catch(() => {}));
    }
  }, [topKind]);

  useEffect(() => {
    void import("@/lib/addon-store").then(({ seedDefaultAddonsIfFirstRun }) =>
      seedDefaultAddonsIfFirstRun(),
    );
  }, []);

  useEffect(() => {
    let dispose: (() => void) | null = null;
    void import("@/lib/deep-link").then(
      ({
        startDeepLinkBridge,
        onDeepLinkInstall,
        onDeepLinkOpen,
        onDeepLinkOpenList,
        onOpenLocalFile,
        onOpenProfileEdit,
        isProfileEditUrl,
      }) => {
        void startDeepLinkBridge().then((stopBridge) => {
          const stopListener = onDeepLinkInstall((rawUrl) => {
            if (window.__harborInstallerOpen) return;
            if (isProfileEditUrl(rawUrl)) return;
            setView("addons");
          });
          const stopOpen = onDeepLinkOpen(({ type, id, videoId }) => {
            const hint = parseDeepLinkEpisode(videoId);
            openMeta(
              { id, type: type as MetaType, name: "" },
              hint ? { episodeHint: hint } : undefined,
            );
          });
          const stopOpenList = onDeepLinkOpenList(({ handle, listId }) => {
            openList(handle, listId);
          });
          const stopEdit = onOpenProfileEdit(() => {
            const handle = currentAuthor()?.handle;
            if (handle) requestEditProfile(handle);
          });
          const stopFile = onOpenLocalFile((path) => {
            const name = (path.replace(/\\/g, "/").split("/").pop() || "Video").replace(
              /\.[^.]+$/,
              "",
            );
            openPlayer({
              meta: { id: `local:${path}`, type: "movie", name },
              url: path,
              title: name,
              notWebReady: true,
            });
          });
          dispose = () => {
            stopBridge();
            stopListener();
            stopOpen();
            stopOpenList();
            stopEdit();
            stopFile();
          };
        });
      },
    );
    return () => {
      dispose?.();
    };
  }, [setView, openMeta, openPlayer, openList]);

  useEffect(() => {
    if (topKind === "anime" && settings.hideContent.anime) setView("home");
  }, [topKind, settings.hideContent.anime, setView]);

  useEffect(() => {
    if (!kid || player) return;
    const allowed =
      topKind === "kids" ||
      topKind === "meta" ||
      topKind === "picker" ||
      topKind === "grid" ||
      topKind === "collection";
    if (!allowed) setView("kids");
  }, [kid, player, topKind, setView]);

  useEffect(() => {
    if (!activeProfile) return;
    if (activeProfile.kid) {
      setView("kids");
    } else if (topKind === "kids") {
      setView("home");
    }
  }, [activeProfile?.id]);

  const playerActive = !!player;
  useEffect(() => setNativeMemoryActive(playerActive), [playerActive]);
  useEffect(() => {
    if (!playerActive) void exitWindowFullscreenOnPlayerClose();
  }, [playerActive]);
  const pickerTop = topKind === "picker";
  const personTop = topKind === "person";
  const profileTop = topKind === "profile";
  const feedTop = topKind === "feed";
  const groupsTop = topKind === "groups";
  const groupTop = topKind === "group";
  const listTop = topKind === "list";
  const collectionTop = topKind === "collection";
  const addonCollectionTop = topKind === "addon-collection";
  const episodeDetailTop = topKind === "episode-detail";
  const collectionsIndexTop = topKind === "collections";
  const collectionsIndexAlive = useKeepAlive(
    collectionsIndexTop,
    true,
    stackKinds.includes("collections"),
  );
  const detailTop = topKind === "meta";
  const filterTop = topKind === "filter";
  const gridTop = topKind === "grid";
  const awardTop = topKind === "award";
  const animeAwardTop = topKind === "anime-award";
  const settingsTop = topKind === "settings";
  const animeTop = topKind === "anime";
  const discoverTop = topKind === "discover";
  const catalogsTop = topKind === "catalogs";
  const addonsTop = topKind === "addons" || topKind === "addon-detail";
  const calendarTop = topKind === "calendar";
  const wrappedTop = topKind === "wrapped";
  const queueTop = topKind === "queue";
  const serviceTop = topKind === "service";
  const homeTop = topKind === "home";
  const moviesTop = topKind === "movies";
  const kidsTop = topKind === "kids";
  const showsTop = topKind === "shows";
  const libraryTop = topKind === "library";
  const collectionsHubTop = topKind === "collections-hub";
  const liveTop = topKind === "live";
  const vodTop = topKind === "vod";
  const downloadsTop = topKind === "downloads";
  const mangaTop = topKind === "manga";
  const peopleTop = topKind === "people";
  const matchDetailTop = topKind === "match-detail";

  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const onImm = (e: Event) => setImmersive((e as CustomEvent<boolean>).detail === true);
    window.addEventListener("harbor:immersive", onImm);
    return () => window.removeEventListener("harbor:immersive", onImm);
  }, []);
  useEffect(() => {
    if (!liveTop && immersive) setImmersive(false);
  }, [liveTop, immersive]);

  useEffect(() => {
    const root = document.documentElement;
    if (playerActive || pickerTop || immersive || settingsTop || chromeHidden)
      root.dataset.chromeHidden = "true";
    else delete root.dataset.chromeHidden;
  }, [playerActive, pickerTop, immersive, settingsTop, chromeHidden]);

  useEffect(() => {
    document.querySelectorAll("[data-harbor-nav]").forEach((el) => {
      el.toggleAttribute("data-active", el.getAttribute("data-harbor-nav") === topKind);
    });
  }, [topKind]);

  const layer = (top: boolean) => (top ? "contents harbor-layer-active" : "hidden");
  const parkLayer = (top: boolean) =>
    top
      ? "harbor-layer-active flex min-h-0 min-w-0 flex-1 flex-col"
      : "flex min-h-0 min-w-0 flex-1 flex-col absolute inset-0 invisible pointer-events-none [content-visibility:hidden]";

  const overlayPinned = useOverlayPinned();
  const settingsAlive = useIdleEvict(settingsTop, overlayPinned);
  const animeAlive = useIdleEvict(animeTop);
  const discoverAlive = useIdleEvict(discoverTop);
  const catalogsAlive = useIdleEvict(catalogsTop);
  const addonsAlive = useIdleEvict(addonsTop);
  const calendarAlive = useIdleEvict(calendarTop);
  const wrappedAlive = useIdleEvict(wrappedTop);
  const queueAlive = useKeepAlive(queueTop, queueTop);
  const serviceAlive = useKeepAlive(serviceTop, serviceTop && !!service);
  const detailAlive = useKeepAlive(detailTop, !!meta);
  const personAlive = useKeepAlive(personTop, personId !== null);
  const profileAlive = useKeepAlive(profileTop, profileHandle !== null);
  const feedAlive = useKeepAlive(feedTop, feedOpen, stackKinds.includes("feed"));
  const groupsAlive = useKeepAlive(groupsTop, groupsOpen, stackKinds.includes("groups"));
  const groupAlive = useKeepAlive(groupTop, groupId !== null);
  const listAlive = useKeepAlive(listTop, listHandle !== null);
  const addonCollectionAlive = useKeepAlive(
    addonCollectionTop,
    !!addonCollectionMeta,
    stackKinds.includes("addon-collection"),
  );
  const collectionAlive = useKeepAlive(
    collectionTop,
    collectionId !== null,
    stackKinds.includes("collection"),
  );
  const episodeDetailAlive = useKeepAlive(
    episodeDetailTop,
    !!episodeDetail,
    stackKinds.includes("episode-detail"),
  );
  const { matchDetailGame } = useView();
  const matchDetailAlive = useKeepAlive(matchDetailTop, !!matchDetailGame);
  const filterAlive = useKeepAlive(filterTop, !!filter);
  const gridAlive = useKeepAlive(gridTop, !!grid, stackKinds.includes("grid"));
  const awardAlive = useKeepAlive(awardTop, awardTop);
  const animeAwardAlive = useKeepAlive(animeAwardTop, animeAwardTop && !!animeAwardSource);
  const pickerAlive = useKeepAlive(pickerTop, !!picker);
  const moviesAlive = useIdleEvict(moviesTop);
  const kidsAlive = useIdleEvict(kidsTop);
  const showsAlive = useIdleEvict(showsTop);
  const libraryAlive = useIdleEvict(libraryTop);
  const collectionsHubAlive = useIdleEvict(collectionsHubTop);
  const liveAlive = useIdleEvict(liveTop);
  const vodAlive = useIdleEvict(vodTop);
  const downloadsAlive = useIdleEvict(downloadsTop);
  const mangaAlive = useIdleEvict(mangaTop);
  const peopleAlive = useIdleEvict(peopleTop);

  return (
    <div data-kids={kidsTop || kid ? "on" : undefined} className="relative flex h-full">
      {!settingsTop && !playerActive && !liveTop && !pickerTop && layout === "sidebar" && (
        <Sidebar />
      )}
      {!settingsTop && !playerActive && !liveTop && !pickerTop && layout === "dracula" && (
        <DraculaSidebar />
      )}
      {!settingsTop && !playerActive && !liveTop && !pickerTop && layout === "nord" && (
        <NordSidebar />
      )}
      {!settingsTop && !playerActive && !liveTop && !pickerTop && layout === "forest" && (
        <ForestSidebar />
      )}
      {!settingsTop && !playerActive && !liveTop && !pickerTop && layout === "stremio" && (
        <StremioRail />
      )}
      {!settingsTop && !playerActive && !pickerTop && layout === "topdock" && <TopDock />}
      {!settingsTop && !playerActive && !pickerTop && layout === "cinematic" && (
        <CinematicOverlay />
      )}
      {!settingsTop && !playerActive && !pickerTop && layout === "royal" && <RoyalTopbar />}
      {!settingsTop && !playerActive && !pickerTop && layout === "rail" && <SideRail />}
      {!playerActive && !pickerTop && layout === "minui" && <MinUIDock />}
      {!playerActive && !pickerTop && layout === "topdock" && <FloatingBack offsetTop={92} />}
      {!playerActive && !pickerTop && layout === "cinematic" && <FloatingBack offsetTop={92} />}
      {!playerActive && !pickerTop && layout === "royal" && <FloatingBack offsetTop={92} />}
      {!playerActive && !pickerTop && layout === "rail" && (
        <FloatingBack offsetLeft={settings.sidebarCollapsed ? 88 : 220} offsetTop={28} />
      )}
      {!playerActive && !pickerTop && layout === "custom" && (
        <FloatingBack offsetLeft={20} offsetTop={20} />
      )}
      {!playerActive && !pickerTop && layout === "custom" && (
        <div className="fixed end-3 top-3 z-[120]">
          <WindowControls />
        </div>
      )}
      {!playerActive && <WindowResizeEdges />}
      <HybridTitleBar suppressed={playerActive || immersive || chromeHidden} />
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${playerActive ? "invisible" : ""}`}
      >
        <div className={parkLayer(homeTop)}>
          <Home active={homeTop} onReady={onReady} />
        </div>
        {settingsAlive && (
          <div className={layer(settingsTop)}>
            <Suspense fallback={null}>
              <Settings />
            </Suspense>
          </div>
        )}
        {animeAlive && (
          <div className={layer(animeTop)}>
            <Suspense fallback={null}>
              <AnimeView active={animeTop} />
            </Suspense>
          </div>
        )}
        {discoverAlive && (
          <div className={parkLayer(discoverTop)}>
            <Suspense fallback={null}>
              <Discover active={discoverTop} />
            </Suspense>
          </div>
        )}
        {catalogsAlive && (
          <div className={layer(catalogsTop)}>
            <Suspense fallback={null}>
              <Catalogs active={catalogsTop} />
            </Suspense>
          </div>
        )}
        {addonsAlive && (
          <div className={layer(addonsTop)}>
            <Suspense fallback={null}>
              <AddonsView />
            </Suspense>
          </div>
        )}
        {calendarAlive && (
          <div className={layer(calendarTop)}>
            <Suspense fallback={null}>
              <CalendarView />
            </Suspense>
          </div>
        )}
        {wrappedAlive && (
          <div className={layer(wrappedTop)}>
            <Suspense fallback={null}>
              <WrappedView active={wrappedTop} />
            </Suspense>
          </div>
        )}
        {moviesAlive && (
          <div className={layer(moviesTop)}>
            <Suspense fallback={null}>
              <Movies active={moviesTop} />
            </Suspense>
          </div>
        )}
        {kidsAlive && (
          <div className={layer(kidsTop)}>
            <Suspense fallback={null}>
              <Kids active={kidsTop} />
            </Suspense>
          </div>
        )}
        {showsAlive && (
          <div className={layer(showsTop)}>
            <Suspense fallback={null}>
              <Shows active={showsTop} />
            </Suspense>
          </div>
        )}
        {libraryAlive && (
          <div className={layer(libraryTop)}>
            <Suspense fallback={null}>
              <LibraryView active={libraryTop} />
            </Suspense>
          </div>
        )}
        {collectionsHubAlive && (
          <div className={layer(collectionsHubTop)}>
            <Suspense fallback={null}>
              <CommunityCollectionsView active={collectionsHubTop} />
            </Suspense>
          </div>
        )}
        {liveAlive && (
          <div className={layer(liveTop)}>
            <Suspense fallback={null}>
              <LiveView active={liveTop} />
            </Suspense>
          </div>
        )}
        {vodAlive && (
          <div className={layer(vodTop)}>
            <Suspense fallback={null}>
              <PlaylistVodView active={vodTop} />
            </Suspense>
          </div>
        )}
        {downloadsAlive && (
          <div className={layer(downloadsTop)}>
            <Suspense fallback={null}>
              <DownloadsView active={downloadsTop} />
            </Suspense>
          </div>
        )}
        {mangaAlive && (
          <div className={layer(mangaTop)}>
            <Suspense fallback={null}>
              <MangaView />
            </Suspense>
          </div>
        )}
        {peopleAlive && (
          <div className={layer(peopleTop)}>
            <Suspense fallback={null}>
              <PeopleView init={peopleInit} />
            </Suspense>
          </div>
        )}
        {queueAlive && (
          <div className={layer(queueTop)}>
            <Suspense fallback={null}>
              <QueueView />
            </Suspense>
          </div>
        )}
        {serviceAlive && service && (
          <div className={layer(serviceTop)}>
            <Suspense fallback={null}>
              <ServiceView key={service} service={service} />
            </Suspense>
          </div>
        )}
        {detailAlive && meta && (
          <div className={layer(detailTop)}>
            <Suspense fallback={null}>
              {kid ? (
                <KidsDetailView
                  key={`kid-meta-${meta.id}`}
                  meta={meta}
                  episodeHint={metaEpisodeHint ?? undefined}
                />
              ) : (
                <DetailView
                  key={`meta-${meta.id}`}
                  meta={meta}
                  liveContext={metaLiveContext}
                  episodeHint={metaEpisodeHint ?? undefined}
                />
              )}
            </Suspense>
          </div>
        )}
        {personAlive && personId !== null && (
          <div className={layer(personTop)}>
            <Suspense fallback={null}>
              <PersonView key={`person-${personId}`} personId={personId} />
            </Suspense>
          </div>
        )}
        {profileAlive && profileHandle !== null && (
          <div className={layer(profileTop)}>
            <Suspense fallback={null}>
              <ProfileView
                key={`profile-${profileHandle}`}
                handle={profileHandle}
                onOpenProfile={requestOpenProfile}
                onOpenMeta={(id, kind, hint) => {
                  if (kind === "manga") {
                    openManga(id);
                    return;
                  }
                  const animeIsh = /^(kitsu|mal|anilist|anidb):/i.test(id);
                  const t: MetaType =
                    kind === "series" || kind === "tv" || kind === "anime" || animeIsh
                      ? "series"
                      : "movie";
                  openMeta({ id, type: t, name: hint?.name ?? "", poster: hint?.poster });
                }}
              />
            </Suspense>
          </div>
        )}
        {feedAlive && (
          <div className={layer(feedTop)}>
            <Suspense fallback={null}>
              <FeedView onOpenProfile={requestOpenProfile} />
            </Suspense>
          </div>
        )}
        {groupsAlive && (
          <div className={layer(groupsTop)}>
            <Suspense fallback={null}>
              <GroupsView />
            </Suspense>
          </div>
        )}
        {groupAlive && groupId !== null && (
          <div className={layer(groupTop)}>
            <Suspense fallback={null}>
              <GroupView key={`group-${groupId}`} id={groupId} onOpenProfile={requestOpenProfile} />
            </Suspense>
          </div>
        )}
        {listAlive && listHandle !== null && listId !== null && (
          <div className={layer(listTop)}>
            <Suspense fallback={null}>
              <SharedListView
                key={`list-${listHandle}-${listId}`}
                handle={listHandle}
                listId={listId}
                onOpenProfile={requestOpenProfile}
                onOpenMeta={(id, kind, hint) => {
                  if (kind === "manga") {
                    openManga(id);
                    return;
                  }
                  const animeIsh = /^(kitsu|mal|anilist|anidb):/i.test(id);
                  const t: MetaType =
                    kind === "series" || kind === "tv" || kind === "anime" || animeIsh
                      ? "series"
                      : "movie";
                  openMeta({ id, type: t, name: hint?.name ?? "", poster: hint?.poster });
                }}
              />
            </Suspense>
          </div>
        )}
        {collectionAlive && collectionId !== null && (
          <div className={layer(collectionTop)}>
            <Suspense fallback={null}>
              <CollectionView key={`collection-${collectionId}`} collectionId={collectionId} />
            </Suspense>
          </div>
        )}
        {addonCollectionAlive && addonCollectionMeta && (
          <div className={layer(addonCollectionTop)}>
            <Suspense fallback={null}>
              <AddonCollectionView
                key={`addon-collection-${addonCollectionMeta.id}`}
                meta={addonCollectionMeta}
              />
            </Suspense>
          </div>
        )}
        {episodeDetailAlive && episodeDetail && (
          <div className={layer(episodeDetailTop)}>
            <Suspense fallback={null}>
              <EpisodeDetailView
                key={`episode-${episodeDetail.seriesId}-${episodeDetail.season}-${episodeDetail.episode}`}
                seriesId={episodeDetail.seriesId}
                season={episodeDetail.season}
                episode={episodeDetail.episode}
                seriesMeta={episodeDetail.seriesMeta}
              />
            </Suspense>
          </div>
        )}
        {matchDetailAlive && matchDetailGame && (
          <div className={layer(matchDetailTop)}>
            <Suspense fallback={null}>
              <MatchDetailView key={`match-${matchDetailGame.id}`} game={matchDetailGame} />
            </Suspense>
          </div>
        )}
        {filterAlive && filter && (
          <div className={layer(filterTop)}>
            <Suspense fallback={null}>
              <FilterView key={filterReactKey(filter)} filter={filter} />
            </Suspense>
          </div>
        )}
        {gridAlive && grid && (
          <div className={layer(gridTop)}>
            <Suspense fallback={null}>
              <GridView key={`grid-${grid.title}`} grid={grid} />
            </Suspense>
          </div>
        )}
        {collectionsIndexAlive && (
          <div className={layer(collectionsIndexTop)}>
            <Suspense fallback={null}>
              <CollectionsView />
            </Suspense>
          </div>
        )}
        {awardAlive && awardType && (
          <div className={layer(awardTop)}>
            <Suspense fallback={null}>
              <AwardView key={`award-${awardType}`} awardType={awardType} />
            </Suspense>
          </div>
        )}
        {animeAwardAlive && animeAwardSource && (
          <div className={layer(animeAwardTop)}>
            <Suspense fallback={null}>
              <AnimeAwardView key={`anime-award-${animeAwardSource}`} sourceId={animeAwardSource} />
            </Suspense>
          </div>
        )}
        {pickerAlive && picker && (
          <div className={layer(pickerTop)}>
            <Suspense fallback={null}>
              <PlayPicker
                key={`picker-${picker.meta.id}-${picker.episode?.season ?? ""}-${picker.episode?.episode ?? ""}-${picker.attempt ?? 0}-${picker.intent ?? "play"}-${picker.seasonEpisodes?.length ?? 0}`}
                meta={picker.meta}
                episode={picker.episode}
                autoPlay={picker.intent === "download" ? false : picker.autoPlay}
                attempt={picker.attempt}
                intent={picker.intent}
                seasonEpisodes={picker.seasonEpisodes}
                resume={picker.resume}
                playerActive={playerActive}
              />
            </Suspense>
          </div>
        )}
        {pickerTop && !themeHasTopbar && (
          <div className="fixed end-3 top-3 z-[120]">
            <WindowControls />
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-24 bg-gradient-to-b from-canvas/85 via-canvas/40 to-transparent"
        />
        {!immersive &&
          (themeHasTopbar || (settingsTop && layout !== "minui" && layout !== "custom")) && (
            <Topbar />
          )}
        {!immersive && !playerActive && !pickerTop && layout === "custom" && (
          <div aria-hidden className="harbor-chrome-proxy fixed end-3 top-3 z-[40]">
            <TogetherButton />
          </div>
        )}
        {!immersive && layout === "rail" && !settingsTop && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-canvas/90 via-canvas/40 to-transparent"
          />
        )}
      </div>
      {player && (
        <Suspense fallback={null}>
          <PlayerView
            key={player.meta.id.startsWith("iptv:") ? "player-live" : `player-${player.meta.id}`}
            src={player}
          />
        </Suspense>
      )}
      <CustomCodeMount />
      <ThemeChromeBridge />
      <WebhookLoopMount />
      <MemoryHud />
      {!player && <OfflineBanner />}
    </div>
  );
}

export type { Frame };
