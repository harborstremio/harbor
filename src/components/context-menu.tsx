import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  EyeOff,
  Heart,
  Info,
  Navigation,
  Pencil,
  RotateCcw,
  Share2,
  UserPlus,
  Wallpaper,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useActiveAddon } from "@/lib/active-addon";
import { copyText } from "@/components/player/copy-link-button";
import { emitListToast } from "@/components/lists/list-toast";
import { shareDeepLink } from "@/lib/deep-link";
import { useAuth } from "@/lib/auth";
import {
  useContextMenu,
  registeredContextTarget,
  type SubtitleContextDetails,
  type ViewSummonable,
} from "@/lib/context-menu";
import { t as translate, useT } from "@/lib/i18n";
import { currentPlayerActions, usePlayerActions } from "@/lib/player-actions";
import { capturePlaybackActor, isPlaybackActorCurrent } from "@/lib/playback-history";
import { useTogether } from "@/lib/together/provider";
import type { ParticipantLocation } from "@/lib/together/protocol";
import { useView } from "@/lib/view";
import { useInWatchlist } from "@/lib/watchlist";
import {
  setContextFavorite,
  setContextWatchlist,
  setContextWatched,
  requireMediaActionSuccess,
} from "@/lib/media-context-actions";
import { useContextWatchedState } from "@/lib/context-watched-state";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useIsFavorite } from "@/lib/media-favorites";
import { clearTitleBackdrop, getTitleBackdrop, setTitleBackdrop } from "@/lib/title-backdrop";
import { MyListSubmenu } from "./context-menu/my-list-submenu";
import { useSettings } from "@/lib/settings";
import {
  NAV_ITEMS,
  effectiveNavOrder,
  moveNavItem,
  resetNavCustomization,
  toggleNavHidden,
} from "@/chrome/nav-items";
import { setNavEditMode, useNavEditMode } from "@/chrome/nav-edit-mode";
import { useIsMangaFavorite, useMangaFavorites } from "@/lib/manga-favorites";
import {
  recordMangaChapterRead,
  removeMangaChapterRead,
  removeMangaProgressEntry,
  useMangaProgressEntry,
  useReadMangaChapterIds,
} from "@/lib/manga-progress";
import { addMangaBookmark, removeMangaBookmark, useMangaBookmarks } from "@/lib/manga-bookmarks";
import { downloadChapter } from "@/lib/manga-downloads";
import { requestMangaChapterRead, setMangaReadIntent } from "@/lib/manga/read-intent";
import { mangaLists } from "@/lib/manga-lists";
import { mangaChapters } from "@/lib/manga/api";
import { resolveReaderChapters } from "@/lib/manga/chapter-identity";
import {
  clickedContent,
  contextPointerPoint,
  dispatchKeyboardContextMenu,
  editingTarget,
} from "@/lib/context-content";
import { useProfiles } from "@/lib/profiles";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { MenuSurface, menuItemClass, useMenuExecution } from "./context-menu/menu-surface";
import { ActionItems, QuickActions, MenuIcon } from "./context-menu/action-items";
import { findAction, type ActionSource } from "@/lib/context-actions";
import {
  contextNavigationFooter,
  omitContextActions,
  partitionContextActions,
} from "@/lib/context-quick-actions";
import { contentActions } from "./context-menu/content-actions";
import { ContextImageViewer } from "./context-image-viewer";
import type { ContextImage } from "@/lib/context-image";
import { parseExternalLink } from "@/lib/social/external-link-policy";
import { usePageContextTarget } from "@/chrome/context-page-navigation";
import { isPageContextBackground } from "@/lib/context-page-background";
import { useManualDownload } from "./context-menu/use-manual-download";
import { LastPlaybackCommand } from "./context-menu/last-playback-command";
import { MenuBrandFooter } from "./context-menu/menu-brand-footer";
import { playerContextSources } from "./context-menu/player-actions";

const MENU_WIDTH = 220;
const SUBTITLE_MENU_WIDTH = 360;
const UNSAFE_MEDIA_PROVIDER_POLICY = "block" as const;

async function readClipboardText(): Promise<string> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      return await readText();
    } catch {}
  }
  return navigator.clipboard.readText();
}

const VIEW_LABELS: Record<ViewSummonable, string> = {
  home: "Home",
  discover: "Discover",
  anime: "Anime",
  queue: "My Library",
  addons: "Addons",
};

export function ContextMenu() {
  const { state, close: closeCurrent, completeClose, open } = useContextMenu();
  const close = useCallback(
    (restoreFocus = true) => closeCurrent(restoreFocus, state?.session),
    [closeCurrent, state?.session],
  );
  const {
    openMeta,
    openManga,
    setView,
    openQueue,
    openPicker,
    openPerson,
    openService,
    openAddonDetail,
    openSettings,
    meta: currentMeta,
    topKind,
    topPath,
    player,
  } = useView();
  const { snapshot, sendSummon, hostLocation, clientId } = useTogether();
  const availablePlayerActions = usePlayerActions();
  const playerActions =
    state?.target.kind === "meta" && state.target.player ? availablePlayerActions : null;
  const t = useT();
  const activeAddon = useActiveAddon();
  const { activeProfile } = useProfiles();
  const { user: stremioUser } = useAuth();
  const authorId = useSyncExternalStore(
    subscribeAuthor,
    () => currentAuthor()?.id ?? null,
    () => null,
  );
  const pageContext = usePageContextTarget({ includePlayer: true });
  const playerMenu = useRef({ session: state?.session, src: playerActions?.src });
  if (playerMenu.current.session !== state?.session)
    playerMenu.current = { session: state?.session, src: playerActions?.src };
  const playerSource = playerMenu.current.src;
  const readMenuPlayer = () => {
    const current = currentPlayerActions();
    return playerSource && current?.src === playerSource && state?.target.isValid?.() !== false
      ? current
      : null;
  };
  const { beginManualDownload, manualDownloadDialog } = useManualDownload({
    actorKey: `${activeProfile?.id ?? ""}:${authorId ?? ""}:${stremioUser?._id ?? ""}`,
  });
  const [viewedImage, setViewedImage] = useState<{
    image: ContextImage;
    origin: HTMLElement | null;
  } | null>(null);
  const viewImage = (image: ContextImage) =>
    setViewedImage({ image, origin: state?.origin ?? null });
  useEffect(() => {
    closeCurrent(false);
    setViewedImage(null);
  }, [topPath, activeProfile?.id, authorId, stremioUser?._id, closeCurrent]);
  const { openAt } = useContextMenu();
  useEffect(() => {
    const keyboardContext = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))
      )
        return;
      const origin = document.activeElement;
      if (
        !(origin instanceof HTMLElement) ||
        editingTarget(origin) ||
        origin.closest("[data-harbor-context-layer],[data-bp-root]")
      )
        return;
      event.preventDefault();
      dispatchKeyboardContextMenu(origin);
    };
    document.addEventListener("keydown", keyboardContext);
    return () => document.removeEventListener("keydown", keyboardContext);
  }, []);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    let requestEpoch = 0;
    const invalidateRequest = () => {
      requestEpoch++;
    };
    // A delayed frame acknowledgement must not replace a newer menu or undo
    // an Escape/click that the user made while the native request was pending.
    document.addEventListener("contextmenu", invalidateRequest, true);
    document.addEventListener("pointerdown", invalidateRequest, true);
    document.addEventListener("keydown", invalidateRequest, true);
    let unsubscribe: (() => void) | undefined;
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        unsubscribe = await listen<{
          requestId: number;
          clientX: number;
          clientY: number;
          imageSrc?: string;
          linkUrl?: string;
          selection?: string;
        }>("harbor:frame-context-menu", async ({ payload }) => {
          const epoch = ++requestEpoch;
          if (
            cancelled ||
            !Number.isFinite(payload.requestId) ||
            !Number.isFinite(payload.clientX) ||
            !Number.isFinite(payload.clientY)
          )
            return;
          const imageSrc =
            typeof payload.imageSrc === "string" &&
            /^(https?:|data:image\/)/i.test(payload.imageSrc)
              ? payload.imageSrc
              : undefined;
          const link =
            typeof payload.linkUrl === "string" && parseExternalLink(payload.linkUrl).ok
              ? payload.linkUrl
              : undefined;
          const selection =
            typeof payload.selection === "string" ? payload.selection.slice(0, 100_000) : undefined;
          if (!imageSrc && !link && !selection) return;
          const { invoke } = await import("@tauri-apps/api/core");
          const accepted = await invoke<boolean>("harbor_ack_frame_context", {
            requestId: payload.requestId,
            handled: true,
          }).catch(() => false);
          if (!accepted || cancelled || epoch !== requestEpoch) return;
          openAt(
            { x: payload.clientX, y: payload.clientY },
            {
              kind: "content",
              navigation: false,
              link,
              selection,
              image: imageSrc ? { src: imageSrc } : undefined,
            },
          );
        });
        if (cancelled) unsubscribe();
      })
      .catch(() => {
        /* Native frame menus retain their fallback if the bridge is unavailable. */
      });
    return () => {
      cancelled = true;
      document.removeEventListener("contextmenu", invalidateRequest, true);
      document.removeEventListener("pointerdown", invalidateRequest, true);
      document.removeEventListener("keydown", invalidateRequest, true);
      unsubscribe?.();
    };
  }, [topPath, activeProfile?.id, authorId, openAt]);

  const inSession = snapshot.state === "joined";
  const isHost = inSession && snapshot.hostClientId === clientId;
  const canGoToHost = inSession && !isHost && hostLocation != null;
  const targetMetaId = state?.target.kind === "meta" ? state.target.meta.id : undefined;
  const targetType = state?.target.kind === "meta" ? state.target.meta.type : undefined;
  const targetEpisode = state?.target.kind === "meta" ? state.target.episode : undefined;
  const episodeMetaId = targetEpisode?.sourceMetaId || targetMetaId;
  const resolvedEpisodeImdb = useTmdbImdbId(episodeMetaId);
  const episodeImdb = targetEpisode?.imdbId ?? resolvedEpisodeImdb;
  const targetImdb = useTmdbImdbId(targetMetaId);
  const episodeScope =
    state?.target.kind === "meta" && (state.target.watchScope === "episode" || !!targetEpisode);
  const watchedState = useContextWatchedState(
    state?.target.kind === "meta" &&
      !playerActions &&
      (targetType === "movie" || targetType === "series" || targetType === "anime") &&
      (!episodeScope || targetEpisode)
      ? {
          meta: state.target.meta,
          imdbId: episodeScope ? episodeImdb : targetImdb,
          episode: targetEpisode,
          episodeScope,
        }
      : null,
    state?.session,
  );
  const [watchedError, setWatchedError] = useState<{ session: number; message: string } | null>(
    null,
  );
  const isWatchlisted = useInWatchlist(targetMetaId, [targetImdb]);
  const isFav = useIsFavorite(targetMetaId);
  const { settings: appSettings, update: updateSettings } = useSettings();
  const navEditing = useNavEditMode();
  const commitNav = (next: typeof appSettings.navCustomization) =>
    updateSettings({ navCustomization: next });

  const mangaCard = state?.target.kind === "manga" ? state.target : null;
  const mangaContinue = state?.target.kind === "manga-continue" ? state.target : null;
  const mangaChapter = state?.target.kind === "manga-chapter" ? state.target : null;
  const menuMangaId = mangaCard?.id ?? mangaContinue?.entry.id ?? mangaChapter?.mangaId;
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const { toggle: toggleMangaFav } = useMangaFavorites();
  const isMangaFav = useIsMangaFavorite(menuMangaId ?? "");
  const cardProgress = useMangaProgressEntry(menuMangaId);
  const chapterBookmarks = useMangaBookmarks(mangaChapter?.mangaId);
  const readChapterIds = useReadMangaChapterIds(mangaChapter?.mangaId);

  const shareLink = (type: string, id: string) => {
    void copyText(shareDeepLink(type, id)).then((ok) => {
      if (ok) emitListToast(t("Link copied"));
    });
    close();
  };

  const goToHost = () => {
    if (!hostLocation) return;
    navigateToLocation(hostLocation, {
      openMeta,
      openPicker,
      openPerson,
      openService,
      openAddonDetail,
      openSettings,
      setView,
      openQueue,
    });
    close();
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (editingTarget(e.target)) {
        closeCurrent(false);
        return;
      }
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("[data-harbor-context-layer]")) return;
      const registered = registeredContextTarget(el);
      if (registered) {
        open(e, registered);
        return;
      }
      const content = clickedContent(e.target, contextPointerPoint(e));
      if (content.selection || content.link || content.image) {
        open(e, { kind: "content", ...content });
        return;
      }
      if (
        pageContext &&
        isPageContextBackground(el) &&
        !el?.closest("[role='dialog'],[data-ebook-page],[data-bp-focusable]")
      ) {
        open(e, pageContext);
        return;
      }
      const backdropEl =
        e.target instanceof HTMLElement ? e.target.closest("[data-title-backdrop]") : null;
      if (backdropEl && currentMeta) {
        const backdropUrl = backdropEl.getAttribute("data-title-backdrop");
        if (backdropUrl) {
          e.preventDefault();
          open(e, { kind: "backdrop", metaId: currentMeta.id, url: backdropUrl });
          return;
        }
      }
      if (el?.closest("[data-harbor-player]") && player?.meta) {
        const source = currentPlayerActions()?.src;
        const actor = capturePlaybackActor();
        open(e, {
          kind: "meta",
          meta: player.meta,
          player: true,
          isValid: () =>
            !!source && currentPlayerActions()?.src === source && isPlaybackActorCurrent(actor),
        });
        return;
      }
      if (topKind === "addon-detail" && inSession && isPageContextBackground(el)) {
        if (activeAddon) {
          e.preventDefault();
          open(e, { kind: "addon", addonId: activeAddon.id, label: activeAddon.name });
        }
        return;
      }
      const view = topKindToView(topKind);
      if (view && inSession && isPageContextBackground(el)) {
        e.preventDefault();
        open(e, { kind: "view", view, label: translate(VIEW_LABELS[view]) });
      }
      // App surfaces without a useful target deliberately have no page menu.
      // Fields, selections and isolated frames have already retained their own handling.
      if (el?.closest("#root")) e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [open, closeCurrent, currentMeta, player?.meta, topKind, activeAddon, pageContext, inSession]);

  const viewer = viewedImage ? (
    <ContextImageViewer
      image={viewedImage.image}
      returnFocus={viewedImage.origin}
      onClose={() => setViewedImage(null)}
    />
  ) : null;
  if (!state)
    return (
      <>
        {viewer}
        {manualDownloadDialog}
      </>
    );

  const subtitleDetails = state.target.kind === "subtitle" ? (state.target.details ?? null) : null;
  const target = state.target;
  const artwork =
    target.image ??
    (target.kind === "meta" && target.meta.poster
      ? { src: target.meta.poster, publicUrl: target.meta.poster, label: target.meta.name }
      : undefined);
  const isPlayer = target.kind === "meta" && !!target.player;
  const allowQuick =
    target.navigation !== false &&
    target.kind !== "edit" &&
    target.kind !== "subtitle" &&
    target.kind !== "backdrop" &&
    !(target.kind === "meta" && target.player);
  const navigation = () =>
    (allowQuick || isPlayer) && pageContext?.kind === "actions" && pageContext.isValid?.() !== false
      ? pageContext.actions()
      : [];
  const playerSources = isPlayer
    ? playerContextSources(readMenuPlayer, () => findAction(navigation(), "page:go:settings"))
    : null;
  const availableActions = (source?: ActionSource) =>
    source?.isValid?.() === false ? [] : (source?.actions() ?? []);
  const makeParts = () => {
    const entity =
      target.kind === "actions"
        ? availableActions(target)
        : target.kind === "meta"
          ? [...availableActions(target.primary), ...availableActions(target.extra)]
          : [];
    const content = contentActions(
      { ...target, image: artwork },
      viewImage,
      target.kind === "content",
    );
    return allowQuick
      ? partitionContextActions(entity, content, navigation())
      : { quick: [], entity, content };
  };
  const parts = makeParts();
  const filteredSource = (source: ActionSource): ActionSource => ({
    ...source,
    actions: () =>
      omitContextActions(
        source.actions(),
        new Set([
          ...makeParts().quick.map((action) => action.id),
          ...contextNavigationFooter(navigation(), makeParts().quick).map((action) => action.id),
        ]),
      ),
  });
  const quickSource: ActionSource = playerSources?.quick ?? {
    actions: () => makeParts().quick,
    isValid: target.isValid,
  };
  const menuWidth = subtitleDetails
    ? SUBTITLE_MENU_WIDTH
    : allowQuick || isPlayer
      ? 264
      : MENU_WIDTH;

  const items: React.ReactNode[] = [];
  let membershipMenu: {
    index: number;
    props: React.ComponentProps<typeof MyListSubmenu>;
  } | null = null;
  if (state.target.kind === "meta" && state.target.primary)
    items.push(
      <ActionItems key="primary" source={filteredSource(state.target.primary)} onClose={close} />,
      <Separator key="primary-separator" />,
    );

  if (
    canGoToHost &&
    (state.target.kind === "view" || (state.target.kind === "meta" && state.target.player))
  ) {
    items.push(
      <Item
        key="go-to-host"
        icon={<Navigation size={14} strokeWidth={2} />}
        label={t("Go to host")}
        onClick={goToHost}
        accent
      />,
      <Separator key="go-to-host-sep" />,
    );
  }

  if (state.target.kind === "meta") {
    const meta = state.target.meta;
    const organizedMedia = meta.type === "movie" || meta.type === "series" || meta.type === "anime";
    const handleDetails = () => {
      if (meta.type === "manga") openManga(meta.id);
      else openMeta(meta, targetEpisode ? { episodeHint: targetEpisode } : undefined);
      close();
    };
    const handleWatchlist = async () => {
      requireMediaActionSuccess(
        await setContextWatchlist(
          {
            id: meta.id,
            type: meta.type,
            name: meta.name,
            poster: meta.poster,
            imdbId: targetImdb,
            addonOrigin: meta.addonOrigin,
            videos: meta.videos,
          },
          !isWatchlisted,
          UNSAFE_MEDIA_PROVIDER_POLICY,
        ),
      );
      close();
    };
    const handleBring = () => {
      sendSummon({
        mediaId: meta.id,
        mediaType: meta.type === "series" ? "series" : "movie",
        mediaTitle: meta.name,
        posterUrl: meta.poster,
        backgroundUrl: meta.background,
        releaseInfo: meta.releaseInfo,
      });
      openMeta(meta);
      close();
    };
    if (!playerActions) {
      items.push(
        <Item
          key="details"
          icon={<Info size={14} strokeWidth={2} />}
          label={t("View details")}
          onClick={handleDetails}
        />,
      );
    }
    if (!state.target.player && (meta.type === "movie" || meta.type === "series")) {
      items.push(
        <Item
          key="download"
          icon={<Download size={14} strokeWidth={2} />}
          label={t("Download")}
          onClick={() => {
            beginManualDownload(meta, targetEpisode, state.origin);
            close(false);
          }}
        />,
      );
    }
    if (organizedMedia)
      items.push(
        <Item
          key="watchlist"
          icon={
            isWatchlisted ? (
              <BookmarkCheck size={14} strokeWidth={2} />
            ) : (
              <Bookmark size={14} strokeWidth={2} />
            )
          }
          label={isWatchlisted ? t("Remove from watchlist") : t("Add to watchlist")}
          onClick={handleWatchlist}
          accent={isWatchlisted}
        />,
      );
    if (organizedMedia)
      items.push(
        <Item
          key="favorite"
          icon={<Heart size={14} strokeWidth={2} fill={isFav ? "currentColor" : "none"} />}
          label={isFav ? t("Remove from favorites") : t("Add to favorites")}
          onClick={async () => {
            requireMediaActionSuccess(
              await setContextFavorite(
                {
                  id: meta.id,
                  type: meta.type,
                  name: meta.name,
                  poster: meta.poster,
                  addonOrigin: meta.addonOrigin,
                  videos: meta.videos,
                },
                !isFav,
              ),
            );
            close();
          }}
          accent={isFav}
        />,
      );
    if (organizedMedia || state.target.membership)
      membershipMenu = {
        index: items.length,
        props: {
          item: {
            id: meta.id,
            type: meta.type,
            name: meta.name,
            poster: meta.poster,
            addonOrigin: meta.addonOrigin,
            videos: meta.videos,
          },
          onClose: close,
          membership: state.target.membership,
          membershipOnly: !organizedMedia,
        },
      };
    if (organizedMedia && !playerActions && (!episodeScope || targetEpisode)) {
      items.push(<Separator key="title-state-separator" />);
      const summary = watchedState.summary;
      const status = watchedState.loading
        ? t("Checking watched status…")
        : summary?.status === "unknown"
          ? t("Watched status unavailable")
          : summary?.status === "partial"
            ? t("{watched} of {total} released episodes known watched", {
                watched: summary.watched,
                total: summary.total,
              })
            : null;
      if (status)
        items.push(
          <p key="watched-status" role="status" className="px-3 py-1.5 text-[12px] text-ink-subtle">
            {status}
          </p>,
        );
      if (summary?.unavailable.length)
        items.push(
          <p key="watched-unavailable" className="px-3 py-1.5 text-[12px] text-ink-subtle">
            {t("Could not check watched status: {providers}", {
              providers: summary.unavailable.map((provider) => t(provider)).join(", "),
            })}
          </p>,
        );
      const choices = watchedState.loading
        ? []
        : summary?.status === "watched"
          ? [false]
          : summary?.status === "unwatched"
            ? [true]
            : [true, false];
      choices.forEach((on, index) =>
        items.push(
          <Item
            key={index === 0 ? "watched" : "watched-alternate"}
            icon={
              on ? <CheckCheck size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />
            }
            label={
              episodeScope
                ? on
                  ? t("Mark episode as watched")
                  : t("Mark episode as unwatched")
                : on
                  ? meta.type !== "movie"
                    ? t("Mark released episodes as watched")
                    : t("Mark as watched")
                  : meta.type !== "movie"
                    ? t("Mark released episodes as unwatched")
                    : t("Mark as unwatched")
            }
            onClick={async () => {
              setWatchedError(null);
              try {
                if (targetEpisode)
                  requireMediaActionSuccess(
                    await setContextWatched({ ...meta, id: episodeMetaId! }, on, {
                      imdbId: episodeImdb,
                      episode: { season: targetEpisode.season, episode: targetEpisode.episode },
                      ...(episodeImdb &&
                      (targetEpisode.imdbSeason != null || targetEpisode.imdbEpisode != null)
                        ? {
                            providerEpisode: {
                              season: targetEpisode.imdbSeason ?? targetEpisode.season,
                              episode: targetEpisode.imdbEpisode ?? targetEpisode.episode,
                            },
                          }
                        : {}),
                    }),
                  );
                else
                  requireMediaActionSuccess(
                    await setContextWatched(meta, on, {
                      imdbId: targetImdb,
                      onUnsafeProvider: UNSAFE_MEDIA_PROVIDER_POLICY,
                    }),
                  );
                close();
              } catch (cause) {
                setWatchedError({
                  session: state.session,
                  message:
                    cause instanceof Error
                      ? t(cause.message)
                      : t("The action could not be completed."),
                });
                watchedState.refresh();
              }
            }}
            accent={!on}
          />,
        ),
      );
      if (watchedError?.session === state.session)
        items.push(
          <p key="watched-error" role="alert" className="px-3 py-2 text-[12px] text-danger">
            {watchedError.message}
          </p>,
        );
    }
    items.push(
      <Item
        key="share-link"
        icon={<Share2 size={14} strokeWidth={2} />}
        label={t("Share as link")}
        onClick={() => shareLink(meta.type, meta.id)}
      />,
    );
    if (organizedMedia && inSession && !playerActions) {
      items.push(
        <Item
          key="bring"
          icon={<UserPlus size={14} strokeWidth={2} />}
          label={t("Bring friends here")}
          onClick={handleBring}
        />,
      );
    }
    if (playerSources) {
      items.push(
        <Separator key="player-sep" />,
        <ActionItems key="player-tools" source={playerSources.rows} onClose={close} />,
      );
    }
  } else if (state.target.kind === "view") {
    const { view, label } = state.target;
    if (inSession) {
      const handleBringPage = () => {
        sendSummon({ view, label });
        if (view === "queue") openQueue();
        else setView(view);
        close();
      };
      items.push(
        <Item
          key="bring-page"
          icon={<UserPlus size={14} strokeWidth={2} />}
          label={t("Bring friends to {label}", { label })}
          onClick={handleBringPage}
        />,
      );
    }
  } else if (state.target.kind === "addon") {
    const { addonId, label } = state.target;
    if (inSession) {
      const handleBringAddon = () => {
        sendSummon({ addonId, label });
        close();
      };
      items.push(
        <Item
          key="bring-addon"
          icon={<UserPlus size={14} strokeWidth={2} />}
          label={t("Bring friends to {label}", { label })}
          onClick={handleBringAddon}
        />,
      );
    }
  } else if (state.target.kind === "backdrop") {
    const { metaId, url } = state.target;
    const isCurrent = getTitleBackdrop(metaId) === url;
    items.push(
      <Item
        key="set-title-backdrop"
        icon={<Wallpaper size={14} strokeWidth={2} />}
        label={t("Set as a backdrop")}
        onClick={() => {
          setTitleBackdrop(metaId, url);
          close();
        }}
        accent={isCurrent}
      />,
    );
    if (getTitleBackdrop(metaId)) {
      items.push(
        <Item
          key="reset-title-backdrop"
          icon={<RotateCcw size={14} strokeWidth={2} />}
          label={t("Reset to original")}
          onClick={() => {
            clearTitleBackdrop(metaId);
            close();
          }}
        />,
      );
    }
  } else if (state.target.kind === "subtitle") {
    const { download, details } = state.target;
    if (details) {
      items.push(
        <SubtitleDetailsCard key="subtitle-details" details={details} onBack={close} t={t} />,
      );
      items.push(<Separator key="subtitle-details-separator" />);
    }
    items.push(
      <Item
        key="download-subtitle"
        icon={<Download size={14} strokeWidth={2} />}
        label={t("Download this subtitle")}
        onClick={() => {
          if (download) void download();
          close();
        }}
        disabled={!download}
      />,
    );
  } else if (state.target.kind === "person") {
    const target = state.target;
    items.push(
      <Item
        key="share-person"
        icon={<Share2 size={14} strokeWidth={2} />}
        label={t("Share as link")}
        onClick={() => shareLink("person", String(target.id))}
      />,
    );
  } else if (state.target.kind === "manga") {
    const target = state.target;
    const resumeEntry = cardProgress && cardProgress.id === target.id ? cardProgress : null;
    if (resumeEntry) {
      const resumeLabel = resumeEntry.chapterNumber
        ? t("Resume Ch. {n}", { n: resumeEntry.chapterNumber })
        : t("Resume reading");
      items.push(
        <Item
          key="manga-resume"
          icon={<RotateCcw size={14} strokeWidth={2} />}
          label={resumeLabel}
          onClick={() => {
            setMangaReadIntent(resumeEntry);
            openManga(resumeEntry.id);
            close();
          }}
          accent
        />,
      );
    } else {
      items.push(
        <Item
          key="manga-start"
          icon={<BookOpen size={14} strokeWidth={2} />}
          label={t("Start reading")}
          onClick={() => {
            close();
            void (async () => {
              try {
                const chs = await mangaChapters(target.id);
                const first = resolveReaderChapters(chs)[0] ?? chs[0];
                if (first) requestMangaChapterRead(target.id, first.id);
              } catch {}
              openManga(target.id);
            })();
          }}
          accent
        />,
      );
    }
    items.push(
      <Item
        key="manga-details"
        icon={<Info size={14} strokeWidth={2} />}
        label={t("View details")}
        onClick={() => {
          openManga(target.id);
          close();
        }}
      />,
    );
    items.push(
      <Item
        key="manga-favorite"
        icon={<Heart size={14} strokeWidth={2} fill={isMangaFav ? "currentColor" : "none"} />}
        label={isMangaFav ? t("Favorited") : t("Favorite")}
        onClick={() => {
          toggleMangaFav({ id: target.id, title: target.title, cover: target.cover });
          close();
        }}
        accent={isMangaFav}
      />,
      <MyListSubmenu
        key="manga-list"
        item={{ id: target.id, type: "manga", name: target.title, poster: target.cover }}
        store={mangaLists}
        onClose={close}
      />,
      <Item
        key="share-manga"
        icon={<Share2 size={14} strokeWidth={2} />}
        label={t("Share as link")}
        onClick={() => shareLink("manga", target.id)}
      />,
    );
  } else if (state.target.kind === "nav") {
    const target = state.target;
    const navItem = target.itemId ? NAV_ITEMS.find((it) => it.id === target.itemId) : undefined;
    if (navItem && target.itemId) {
      const order = effectiveNavOrder(appSettings.navCustomization);
      const at = order.indexOf(target.itemId);
      const prevId = at > 0 ? order[at - 1] : null;
      const nextId = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
      items.push(
        <Item
          key="nav-open"
          icon={<Info size={14} strokeWidth={2} />}
          label={t("Open")}
          disabled={!target.onOpen}
          onClick={() => {
            target.onOpen?.();
            close();
          }}
        />,
        <Item
          key="nav-hide"
          icon={<EyeOff size={14} strokeWidth={2} />}
          label={t("Hide this tab")}
          onClick={() => {
            commitNav(toggleNavHidden(appSettings.navCustomization, target.itemId!));
            close();
          }}
        />,
      );
      if (prevId) {
        items.push(
          <Item
            key="nav-up"
            icon={<ArrowUp size={14} strokeWidth={2} />}
            label={t("Move up")}
            onClick={() => {
              commitNav(
                moveNavItem(appSettings.navCustomization, target.itemId!, prevId, "before"),
              );
              close();
            }}
          />,
        );
      }
      if (nextId) {
        items.push(
          <Item
            key="nav-down"
            icon={<ArrowDown size={14} strokeWidth={2} />}
            label={t("Move down")}
            onClick={() => {
              commitNav(moveNavItem(appSettings.navCustomization, target.itemId!, nextId, "after"));
              close();
            }}
          />,
        );
      }
    }
    items.push(
      <Item
        key="nav-edit"
        icon={<Pencil size={14} strokeWidth={2} />}
        label={navEditing ? t("Done editing") : t("Edit sidebar")}
        onClick={() => {
          setNavEditMode(!navEditing);
          close();
        }}
        accent={navEditing}
      />,
      <Item
        key="nav-show-all"
        icon={<Eye size={14} strokeWidth={2} />}
        label={t("Show all tabs")}
        onClick={() => {
          commitNav({ ...appSettings.navCustomization, hidden: [] });
          close();
        }}
      />,
      <Item
        key="nav-reset"
        icon={<RotateCcw size={14} strokeWidth={2} />}
        label={t("Reset layout")}
        onClick={() => {
          commitNav(resetNavCustomization());
          close();
        }}
      />,
    );
  } else if (state.target.kind === "manga-continue") {
    const entry = state.target.entry;
    const resumeLabel = entry.chapterNumber
      ? t("Resume Ch. {n}", { n: entry.chapterNumber })
      : t("Resume reading");
    items.push(
      <Item
        key="continue-resume"
        icon={<RotateCcw size={14} strokeWidth={2} />}
        label={resumeLabel}
        onClick={() => {
          setMangaReadIntent(entry);
          openManga(entry.id);
          close();
        }}
        accent
      />,
      <Item
        key="continue-details"
        icon={<Info size={14} strokeWidth={2} />}
        label={t("View details")}
        onClick={() => {
          openManga(entry.id);
          close();
        }}
      />,
      <Item
        key="continue-remove"
        icon={<X size={14} strokeWidth={2} />}
        label={t("Remove from continue reading")}
        onClick={() => {
          removeMangaProgressEntry(pid, entry.id);
          close();
        }}
      />,
      <Item
        key="share-continue"
        icon={<Share2 size={14} strokeWidth={2} />}
        label={t("Share as link")}
        onClick={() => shareLink("manga", entry.id)}
      />,
    );
  } else if (state.target.kind === "manga-chapter") {
    const target = state.target;
    const chapter = target.chapter;
    const chapterLabel =
      chapter.chapter == null ? t("Oneshot") : t("Chapter {n}", { n: chapter.chapter });
    const existingBookmark = chapterBookmarks.find((bm) => bm.chapterId === chapter.id);
    const isRead = chapter.serverRead === true || readChapterIds.has(chapter.id);
    items.push(
      <Item
        key="chapter-read"
        icon={<BookOpen size={14} strokeWidth={2} />}
        label={t("Read {label}", { label: chapterLabel })}
        onClick={() => {
          requestMangaChapterRead(target.mangaId, chapter.id);
          openManga(target.mangaId);
          close();
        }}
        accent
      />,
      <Item
        key="chapter-bookmark"
        icon={
          existingBookmark ? (
            <BookmarkCheck size={14} strokeWidth={2} />
          ) : (
            <Bookmark size={14} strokeWidth={2} />
          )
        }
        label={existingBookmark ? t("Bookmarked") : t("Bookmark")}
        onClick={() => {
          if (existingBookmark) removeMangaBookmark(pid, existingBookmark.id);
          else
            addMangaBookmark(pid, {
              mangaId: target.mangaId,
              title: target.mangaTitle ?? "",
              cover: target.mangaCover,
              chapterId: chapter.id,
              chapterNumber: chapter.chapter,
              chapterLabel,
              page: 1,
              totalPages: 1,
            });
          close();
        }}
        accent={!!existingBookmark}
      />,
      <Item
        key="chapter-download"
        icon={<Download size={14} strokeWidth={2} />}
        label={t("Download chapter")}
        onClick={() => {
          void downloadChapter(target.mangaId, chapter.id, {
            title: target.mangaTitle,
            cover: target.mangaCover,
            chapter: chapter.chapter,
          });
          close();
        }}
      />,
      <Item
        key="chapter-read-flag"
        icon={isRead ? <EyeOff size={14} strokeWidth={2} /> : <Check size={14} strokeWidth={2} />}
        label={isRead ? t("Mark as unread") : t("Mark as read")}
        onClick={() => {
          if (isRead) removeMangaChapterRead(pid, target.mangaId, chapter.id);
          else recordMangaChapterRead(pid, target.mangaId, chapter.id);
          close();
        }}
        accent={isRead}
      />,
    );
  } else if (state.target.kind === "ebook") {
    const target = state.target;
    items.push(
      <Item
        key="share-ebook"
        icon={<Share2 size={14} strokeWidth={2} />}
        label={t("Share as link")}
        onClick={() => shareLink("ebook", target.id)}
      />,
    );
  } else if (state.target.kind === "edit") {
    const { element, selection } = state.target;
    const canCopy = selection.length > 0;
    const canPaste = element != null;
    const handleCopy = async () => {
      if (!canCopy) return;
      try {
        await navigator.clipboard.writeText(selection);
      } catch {}
      close();
    };
    const handlePaste = async () => {
      if (!canPaste || !element) return;
      try {
        const text = await readClipboardText();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const start = element.selectionStart ?? element.value.length;
          const end = element.selectionEnd ?? element.value.length;
          const next = element.value.slice(0, start) + text + element.value.slice(end);
          setNativeInputValue(element, next);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          element.focus();
          const cursor = start + text.length;
          element.setSelectionRange(cursor, cursor);
        } else if (element.isContentEditable) {
          element.focus();
          document.execCommand("insertText", false, text);
        }
      } catch {}
      close();
    };
    items.push(
      <Item
        key="copy"
        icon={<Copy size={14} strokeWidth={2} />}
        label={t("Copy")}
        onClick={handleCopy}
        disabled={!canCopy}
      />,
      <Item
        key="paste"
        icon={<ClipboardPaste size={14} strokeWidth={2} />}
        label={t("Paste")}
        onClick={handlePaste}
        disabled={!canPaste}
      />,
    );
  }

  if (state.target.kind === "actions" && filteredSource(state.target).actions().length)
    items.push(<ActionItems key="actions" source={filteredSource(state.target)} onClose={close} />);
  if (state.target.kind === "actions" && state.target.manga) {
    const manga = state.target.manga;
    items.push(
      <MyListSubmenu
        key="manga-list"
        item={{ id: manga.id, type: "manga", name: manga.title, poster: manga.cover }}
        store={mangaLists}
        onClose={close}
      />,
      <Item
        key="share-manga"
        icon={<Share2 size={14} />}
        label={t("Share as link")}
        onClick={() => shareLink("manga", manga.id)}
      />,
    );
  }
  if (state.target.kind === "meta" && state.target.extra)
    items.push(
      <ActionItems key="extra" source={filteredSource(state.target.extra)} onClose={close} />,
    );
  if (parts.content.some((action) => action.id === "selection:copy")) {
    items.unshift(
      <ActionItems
        key="selection"
        source={{ actions: () => contentActions({ selection: target.selection }, viewImage, true) }}
        onClose={close}
      />,
      <Separator key="selection-separator" />,
    );
    if (membershipMenu) membershipMenu.index += 2;
  }
  const tools = parts.content.filter((action) => action.id !== "selection:copy");
  if (tools.length)
    items.push(
      <ActionItems
        key="content"
        source={{
          actions: () => makeParts().content.filter((action) => action.id !== "selection:copy"),
        }}
        onClose={close}
      />,
    );
  // The player reuses navigation policy for Settings only, never browsing rows.
  const navigationFooter = () =>
    isPlayer ? [] : contextNavigationFooter(navigation(), makeParts().quick);
  const footer = navigationFooter();
  if (items.length === 0 && parts.quick.length === 0 && footer.length === 0)
    return (
      <>
        {viewer}
        {manualDownloadDialog}
      </>
    );

  return (
    <>
      {viewer}
      {manualDownloadDialog}
      <LastPlaybackCommand key={state.session} enabled={allowQuick} onClose={close}>
        {(last) => (
          <MenuSurface
            key={state.session}
            point={state.pos}
            onClose={close}
            phase={state.phase}
            onExitComplete={() => completeClose(state.session)}
            quickActions={
              quickSource.actions().length ? (
                <QuickActions source={quickSource} onClose={close} />
              ) : undefined
            }
            isValid={state.target.isValid}
            width={menuWidth}
            label={
              subtitleDetails
                ? t("Subtitle details")
                : state.target.kind === "meta"
                  ? state.target.meta.name
                  : "label" in state.target
                    ? state.target.label
                    : t("Actions")
            }
          >
            {last && (
              <>
                <ActionItems source={{ actions: () => [last] }} onClose={close} />
                {(items.length > 0 || footer.length > 0) && <Separator />}
              </>
            )}
            {membershipMenu ? (
              <>
                {items.slice(0, membershipMenu.index)}
                <MyListSubmenu {...membershipMenu.props}>
                  {items.slice(membershipMenu.index)}
                </MyListSubmenu>
              </>
            ) : (
              items
            )}
            {footer.length > 0 && (
              <>
                {items.length > 0 && <Separator />}
                <ActionItems
                  source={{
                    actions: navigationFooter,
                    isValid: pageContext?.isValid,
                  }}
                  onClose={close}
                />
              </>
            )}
            <MenuBrandFooter />
          </MenuSurface>
        )}
      </LastPlaybackCommand>
    </>
  );
}

function SubtitleDetailsCard({
  details,
  onBack,
  t,
}: {
  details: SubtitleContextDetails;
  onBack: () => void;
  t: ReturnType<typeof useT>;
}) {
  const rows: Array<[string, string]> = [
    [t("Language"), details.language],
    [t("Source"), details.source],
    [t("Provider"), details.provider ?? t("Not provided")],
    [t("Format"), details.format ?? t("Not provided")],
    [
      t("Frame rate"),
      details.fps != null
        ? `${details.fps.toFixed(3).replace(/\.0+$/, "")} fps`
        : t("Not provided"),
    ],
    [t("Quality"), details.quality ?? t("Not provided")],
    [t("Author"), details.author ?? t("Not provided")],
  ];
  if (details.downloads != null) rows.push([t("Downloads"), details.downloads.toLocaleString()]);
  if (details.compatibilityPercent != null) {
    rows.push([t("Match estimate"), `${details.compatibilityPercent}%`]);
  }

  return (
    <section role="presentation" className="px-3 pb-2 pt-2.5 text-ink">
      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Back")}
          className="-ms-1 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft aria-hidden size={14} className="dir-icon" />
          {t("Back")}
        </button>
        <Info size={15} className="ms-auto shrink-0 text-accent" />
        <h2 className="text-[13px] font-semibold">{t("Subtitle details")}</h2>
      </div>
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[11.5px] leading-5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-subtle">{label}</dt>
            <dd className="min-w-0 break-words text-ink-muted">{value}</dd>
          </div>
        ))}
      </dl>
      {details.release && (
        <div className="mt-2.5 border-t border-edge-soft/60 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
            {t("Release")}
          </p>
          <p className="mt-1 break-words text-[11.5px] leading-5 text-ink-muted">
            {details.release}
          </p>
        </div>
      )}
      {details.flags && details.flags.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-subtle">{details.flags.join(" · ")}</p>
      )}
      {details.matchReasons && details.matchReasons.length > 0 && (
        <div className="mt-2.5 border-t border-edge-soft/60 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
            {t("Match evidence")}
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] leading-4 text-ink-muted">
            {details.matchReasons.slice(0, 4).map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}
      {details.compatibilityPercent != null && (
        <p className="mt-2.5 text-[10.5px] leading-4 text-ink-subtle">
          {t("This is a metadata-based release estimate, not a measured timing score.")}
        </p>
      )}
    </section>
  );
}

function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
}

function topKindToView(topKind: string): ViewSummonable | null {
  if (topKind === "home" || topKind === "discover" || topKind === "anime" || topKind === "queue") {
    return topKind;
  }
  if (topKind === "addons" || topKind === "addon-detail") return "addons";
  return null;
}

type LocationNavigators = {
  openMeta: ReturnType<typeof useView>["openMeta"];
  openPicker: ReturnType<typeof useView>["openPicker"];
  openPerson: ReturnType<typeof useView>["openPerson"];
  openService: ReturnType<typeof useView>["openService"];
  openAddonDetail: ReturnType<typeof useView>["openAddonDetail"];
  openSettings: ReturnType<typeof useView>["openSettings"];
  setView: ReturnType<typeof useView>["setView"];
  openQueue: ReturnType<typeof useView>["openQueue"];
};

function navigateToLocation(loc: ParticipantLocation, nav: LocationNavigators) {
  switch (loc.kind) {
    case "home":
    case "discover":
    case "anime":
    case "addons":
      nav.setView(loc.kind);
      return;
    case "queue":
      nav.openQueue();
      return;
    case "settings":
      nav.openSettings();
      return;
    case "service":
      nav.openService(loc.service as Parameters<typeof nav.openService>[0]);
      return;
    case "addon-detail":
      nav.openAddonDetail(loc.addonId);
      return;
    case "person":
      nav.openPerson(loc.personId);
      return;
    case "meta":
      nav.openMeta(loc.meta);
      return;
    case "picker":
    case "player":
      nav.openPicker(loc.meta, loc.episode, { autoPlay: true });
      return;
  }
}

function Item({
  icon,
  label,
  onClick,
  accent,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
  accent?: boolean;
  disabled?: boolean;
}) {
  const pending = useRef(false);
  const execution = useMenuExecution();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        role="menuitem"
        onClick={async () => {
          if (disabled || busy || pending.current || (execution && !execution.acquire())) return;
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? translate(cause.message)
                : translate("The action could not be completed."),
            );
          } finally {
            pending.current = false;
            setBusy(false);
            execution?.release();
          }
        }}
        disabled={disabled}
        aria-disabled={disabled || busy || execution?.busy || undefined}
        aria-busy={busy || undefined}
        className={menuItemClass}
        data-active={accent || undefined}
      >
        <MenuIcon action={{ icon, active: accent }} />
        {label}
      </button>
      {error && (
        <p role="alert" className="px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}

function Separator() {
  return <div role="separator" className="context-menu-separator" />;
}
