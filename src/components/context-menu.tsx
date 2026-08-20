import {
  ArrowDownToLine,
  Bookmark,
  BookmarkCheck,
  CheckCheck,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  Heart,
  Info,
  Link2,
  Magnet,
  Maximize,
  Navigation,
  RotateCcw,
  UserPlus,
  Wallpaper,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useActiveAddon } from "@/lib/active-addon";
import { copyText } from "@/components/player/copy-link-button";
import { magnetFromHash } from "@/lib/debrid/types";
import { openUrl } from "@/lib/window";
import { useContextMenu, type ViewSummonable } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
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

const MENU_WIDTH = 220;
const MENU_HEIGHT = 120;

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
    setView,
    openQueue,
    openPicker,
    openPerson,
    openService,
    openAddonDetail,
    openSettings,
    meta: currentMeta,
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
      if (topKind === "person") return;
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
        open(e, { kind: "view", view, label: VIEW_LABELS[view] });
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [open, currentMeta, menuMeta, topKind, activeAddon]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  if (!state) return null;

  const left = Math.min(state.pos.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(state.pos.y, window.innerHeight - MENU_HEIGHT - 8);

  const items: React.ReactNode[] = [];

  if (canGoToHost) {
    items.push(
      <Item
        key="go-to-host"
        icon={<Navigation size={14} strokeWidth={2} />}
        label="Go to host"
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
          label="View details"
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
        label={isWatchlisted ? "In watchlist" : "Add to watchlist"}
        onClick={handleWatchlist}
        accent={isWatchlisted}
      />,
    );
    items.push(
      <Item
        key="favorite"
        icon={<Heart size={14} strokeWidth={2} fill={isFav ? "currentColor" : "none"} />}
        label={isFav ? "Favorited" : "Favorite"}
        onClick={() => {
          toggleFavorite({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster });
          close();
        }}
        accent={isFav}
      />,
    );
    items.push(
      <MyListSubmenu
        key="local-list"
        item={{ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster }}
        onClose={close}
      />,
    );
    if (meta.type === "series" && !playerActions) {
      items.push(
        <Item
          key="auto-download"
          icon={<ArrowDownToLine size={14} strokeWidth={2} />}
          label={isAutoDl ? "Auto-downloading" : "Auto-download new episodes"}
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
              ? "Mark as unwatched"
              : meta.type === "series"
                ? "Mark all watched"
                : "Mark as watched"
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
    if (inSession && !playerActions) {
      items.push(
        <Item
          key="bring"
          icon={<UserPlus size={14} strokeWidth={2} />}
          label="Bring friends here"
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
          label="Full screen"
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
            label="Download Video"
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
          label={`Bring friends to ${label}`}
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
          label={`Bring friends to ${label}`}
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
        label="Set as a backdrop"
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
          label="Reset to original"
          onClick={() => {
            clearTitleBackdrop(metaId);
            close();
          }}
        />,
      );
    }
  } else if (state.target.kind === "subtitle") {
    const { download } = state.target;
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
        const text = await navigator.clipboard.readText();
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
        label="Copy"
        onClick={handleCopy}
        disabled={!canCopy}
      />,
      <Item
        key="paste"
        icon={<ClipboardPaste size={14} strokeWidth={2} />}
        label="Paste"
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
        style={{ left, top, width: MENU_WIDTH }}
        className="fixed z-[145] flex flex-col rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
      >
        {items}
      </div>
    </>
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
