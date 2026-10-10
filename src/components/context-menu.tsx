import {
  ArrowDown,
  ArrowDownToLine,
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
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Info,
  Link2,
  Magnet,
  Maximize,
  Navigation,
  Pencil,
  RotateCcw,
  Share2,
  UserPlus,
  Wallpaper,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useActiveAddon } from "@/lib/active-addon";
import { copyText } from "@/components/player/copy-link-button";
import { emitListToast } from "@/components/lists/list-toast";
import { TvModalClose } from "@/components/tv-modal-close";
import { shareDeepLink } from "@/lib/deep-link";
import { magnetFromHash } from "@/lib/debrid/types";
import { openUrl } from "@/lib/window";
import {
  useContextMenu,
  type SubtitleContextDetails,
  type ViewSummonable,
} from "@/lib/context-menu";
import { t as translate, useT } from "@/lib/i18n";
import { usePlayerActions } from "@/lib/player-actions";
import { useTogether } from "@/lib/together/provider";
import type { ParticipantLocation } from "@/lib/together/protocol";
import { useView } from "@/lib/view";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { markMetaWatched, unmarkMetaWatched } from "@/lib/mark-watched";
import { useMetaWatched } from "@/lib/watched-flag";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useIsFavorite, useMediaFavorites } from "@/lib/media-favorites";
import { toggleAutoDownload, useIsAutoDownloaded } from "@/lib/auto-download";
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
import { useProfiles } from "@/lib/profiles";
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

const MENU_WIDTH = 220;
const SUBTITLE_MENU_WIDTH = 360;

async function readClipboardText(): Promise<string> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      return await readText();
    } catch {}
  }
  return navigator.clipboard.readText();
}

function isEditableTarget(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el.isContentEditable) return true;
  return false;
}

const VIEW_LABELS: Record<ViewSummonable, string> = {
  home: "Home",
  discover: "Discover",
  anime: "Anime",
  queue: "My Library",
  addons: "Addons",
};

export function ContextMenu() {
  const { state, close, open } = useContextMenu();
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
    personId,
    mangaId,
    ebookId,
    topKind,
    player,
  } = useView();
  const { snapshot, sendSummon, hostLocation, clientId } = useTogether();
  const playerActions = usePlayerActions();
  const menuMeta = currentMeta ?? player?.meta ?? null;
  const t = useT();
  const activeAddon = useActiveAddon();
  const ref = useRef<HTMLDivElement>(null);

  const inSession = snapshot.state === "joined";
  const isHost = inSession && snapshot.hostClientId === clientId;
  const canGoToHost = inSession && !isHost && hostLocation != null;
  const targetMetaId = state?.target.kind === "meta" ? state.target.meta.id : undefined;
  const targetType = state?.target.kind === "meta" ? state.target.meta.type : undefined;
  const targetImdb = useTmdbImdbId(targetMetaId);
  const isWatched = useMetaWatched(targetMetaId, targetType, targetImdb);
  const isWatchlisted = useInWatchlist(targetMetaId, [targetImdb]);
  const { toggle: toggleFavorite } = useMediaFavorites();
  const isFav = useIsFavorite(targetMetaId);
  const isAutoDl = useIsAutoDownloaded(targetMetaId ?? "");
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
      if (topKind === "settings") {
        const el = isEditableTarget(e.target) ? e.target : null;
        if (!el) return;
        e.preventDefault();
        const selection = window.getSelection()?.toString() ?? "";
        open(e, { kind: "edit", element: el, selection });
        return;
      }
      if (topKind === "person") {
        if (personId == null) return;
        e.preventDefault();
        open(e, { kind: "person", id: personId });
        return;
      }
      if (topKind === "manga") {
        e.preventDefault();
        if (mangaId) open(e, { kind: "manga", id: mangaId });
        return;
      }
      if (topKind === "ebook" && ebookId) {
        e.preventDefault();
        open(e, { kind: "ebook", id: ebookId });
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest("[data-person-card]")) return;
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
      if (menuMeta) {
        e.preventDefault();
        open(e, { kind: "meta", meta: menuMeta });
        return;
      }
      if (topKind === "addon-detail") {
        if (activeAddon) {
          e.preventDefault();
          open(e, { kind: "addon", addonId: activeAddon.id, label: activeAddon.name });
        }
        return;
      }
      const view = topKindToView(topKind);
      if (view) {
        e.preventDefault();
        open(e, { kind: "view", view, label: translate(VIEW_LABELS[view]) });
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [open, currentMeta, menuMeta, topKind, activeAddon, personId, mangaId, ebookId]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  const [flipUp, setFlipUp] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !state) {
      setFlipUp(0);
      return;
    }
    const measure = () => {
      const estimatedHeight = state.target.kind === "subtitle" && state.target.details ? 460 : 120;
      const anchorTop = Math.max(
        8,
        Math.min(state.pos.y, window.innerHeight - estimatedHeight - 8),
      );
      // Use layout height, not the opening animation's scaled rectangle.
      const overflow = anchorTop + el.offsetHeight - (window.innerHeight - 8);
      setFlipUp(Math.min(Math.max(0, overflow), anchorTop - 8));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [state]);

  useLayoutEffect(() => {
    if (state?.target.kind !== "nav") return;
    const trigger = document.activeElement;
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]:not(:disabled)',
    );
    buttons?.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
    });
    // Let the opening pointer event finish before moving focus into the menu.
    const focusFrame = requestAnimationFrame(() => buttons?.[0]?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(focusFrame);
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, [state]);

  if (!state) return null;

  const subtitleDetails = state.target.kind === "subtitle" ? (state.target.details ?? null) : null;
  const menuWidth = subtitleDetails ? SUBTITLE_MENU_WIDTH : MENU_WIDTH;
  const estimatedHeight = subtitleDetails ? 460 : 120;
  const left = Math.max(8, Math.min(state.pos.x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(state.pos.y, window.innerHeight - estimatedHeight - 8));

  const items: React.ReactNode[] = [];

  if (canGoToHost) {
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
    const handleDetails = () => {
      openMeta(meta);
      close();
    };
    const handleWatchlist = () => {
      toggleWatchlist({
        id: meta.id,
        type: meta.type,
        name: meta.name,
        poster: meta.poster,
        imdbId: targetImdb,
        addonOrigin: meta.addonOrigin,
        videos: meta.videos,
      });
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
        label={isWatchlisted ? t("In watchlist") : t("Add to watchlist")}
        onClick={handleWatchlist}
        accent={isWatchlisted}
      />,
    );
    items.push(
      <Item
        key="favorite"
        icon={<Heart size={14} strokeWidth={2} fill={isFav ? "currentColor" : "none"} />}
        label={isFav ? t("Favorited") : t("Favorite")}
        onClick={() => {
          toggleFavorite({
            id: meta.id,
            type: meta.type,
            name: meta.name,
            poster: meta.poster,
            addonOrigin: meta.addonOrigin,
            videos: meta.videos,
          });
          close();
        }}
        accent={isFav}
      />,
    );
    items.push(
      <MyListSubmenu
        key="local-list"
        item={{
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          addonOrigin: meta.addonOrigin,
          videos: meta.videos,
        }}
        onClose={close}
      />,
    );
    if (meta.type === "series" && !playerActions) {
      items.push(
        <Item
          key="auto-download"
          icon={<ArrowDownToLine size={14} strokeWidth={2} />}
          label={isAutoDl ? t("Auto-downloading") : t("Auto-download new episodes")}
          onClick={() => {
            toggleAutoDownload(meta);
            close();
          }}
          accent={isAutoDl}
        />,
      );
    }
    if (!playerActions) {
      items.push(
        <Item
          key="watched"
          icon={
            isWatched ? (
              <EyeOff size={14} strokeWidth={2} />
            ) : (
              <CheckCheck size={14} strokeWidth={2} />
            )
          }
          label={
            isWatched
              ? t("Mark as unwatched")
              : meta.type === "series"
                ? t("Mark all watched")
                : t("Mark as watched")
          }
          onClick={() => {
            if (isWatched) void unmarkMetaWatched(meta, targetImdb);
            else void markMetaWatched(meta, targetImdb);
            close();
          }}
          accent={isWatched}
        />,
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
    if (inSession && !playerActions) {
      items.push(
        <Item
          key="bring"
          icon={<UserPlus size={14} strokeWidth={2} />}
          label={t("Bring friends here")}
          onClick={handleBring}
        />,
      );
    }
    if (playerActions) {
      items.push(<Separator key="player-sep" />);
      items.push(
        <Item
          key="fullscreen"
          icon={<Maximize size={14} strokeWidth={2} />}
          label={t("Full screen")}
          onClick={() => {
            playerActions.toggleFullscreen();
            close();
          }}
        />,
      );
      if (playerActions.canDownload) {
        items.push(
          <Item
            key="download"
            icon={<Download size={14} strokeWidth={2} />}
            label={t("Download Video")}
            onClick={() => {
              playerActions.download();
              close();
            }}
          />,
        );
      }
      if (playerActions.canDownloadSubtitle) {
        items.push(
          <Item
            key="download-subtitle"
            icon={<Download size={14} strokeWidth={2} />}
            label={t("Download Subtitle")}
            onClick={() => {
              playerActions.downloadSubtitle();
              close();
            }}
          />,
        );
      }
      const streamUrl = playerActions.streamUrl;
      const httpUrl = streamUrl && /^https?:\/\//i.test(streamUrl) ? streamUrl : null;
      const magnet = playerActions.infoHash ? magnetFromHash(playerActions.infoHash) : null;
      if (httpUrl || magnet) {
        items.push(<Separator key="stream-sep" />);
        if (httpUrl) {
          items.push(
            <Item
              key="copy-stream"
              icon={<Link2 size={14} strokeWidth={2} />}
              label={t("Copy stream link")}
              onClick={() => {
                void copyText(httpUrl);
                close();
              }}
            />,
          );
          items.push(
            <Item
              key="open-browser"
              icon={<ExternalLink size={14} strokeWidth={2} />}
              label={t("Open in browser")}
              onClick={() => {
                openUrl(httpUrl);
                close();
              }}
            />,
          );
        }
        if (magnet) {
          items.push(
            <Item
              key="copy-magnet"
              icon={<Magnet size={14} strokeWidth={2} />}
              label={t("Copy magnet link")}
              onClick={() => {
                void copyText(magnet);
                close();
              }}
            />,
          );
        }
      }
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
  } else {
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

  if (items.length === 0) return null;

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[144]"
        // In fullscreen, some WebViews dispatch the secondary click after the
        // contextmenu event. Dismiss on a new primary press instead so that
        // event cannot immediately close the menu it just opened.
        onMouseDown={(e) => {
          if (e.button === 0) close();
        }}
        onWheel={close}
      />
      <div
        ref={ref}
        role="menu"
        data-tv-focus-scope={state.target.kind === "nav" || undefined}
        onKeyDown={(e) => {
          if (state.target.kind !== "nav") return;
          if (e.key === "Escape" || e.key === "Tab") {
            if (e.key === "Escape") e.preventDefault();
            e.stopPropagation();
            close();
            return;
          }
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          e.stopPropagation();
          const buttons = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button[role="menuitem"]:not(:disabled)',
            ),
          );
          if (!buttons.length) return;
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons.forEach((button, i) => {
            button.tabIndex = i === next ? 0 : -1;
          });
          buttons[next].focus({ preventScroll: true });
        }}
        aria-label={subtitleDetails ? t("Subtitle details") : undefined}
        style={{ left, top: top - flipUp, width: menuWidth, maxHeight: "calc(100vh - 16px)" }}
        className={`fixed z-[145] flex flex-col overflow-y-auto rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] ${state.target.kind === "nav" ? "" : "animate-popover-in"}`}
      >
        {state.target.kind === "nav" && <TvModalClose onClose={close} label={t("Close")} />}
        {items}
      </div>
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
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] transition-colors ${
        disabled
          ? "cursor-not-allowed text-ink-subtle/55"
          : accent
            ? "text-accent hover:bg-raised"
            : "text-ink hover:bg-raised"
      }`}
    >
      <span className={disabled ? "text-ink-subtle/40" : accent ? "text-accent" : "text-ink-muted"}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function Separator() {
  return <span aria-hidden className="my-1 h-px bg-edge-soft/60" />;
}
