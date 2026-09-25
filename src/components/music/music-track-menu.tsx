import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Copy, Disc3, Download, ListPlus, Play, Plus, UserRound } from "lucide-react";
import { MoreLikeThisIcon } from "@/components/icons/more-like-this-icon";
import { AnchoredMenu } from "@/components/anchored-menu";
import { useT } from "@/lib/i18n";
import { downloadMusic } from "@/lib/music/downloads";
import { musicSimilarTracks } from "@/lib/music/player";
import { requestMusicExplore } from "@/lib/music/navigation";
import { useArtistCredits } from "./use-artist-credits";
import { useMusicNavigate } from "./music-navigate";
import type { MusicTrack } from "@/lib/music/types";

export type MusicTrackMenuItem = {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void | Promise<void>;
};

export type MusicTrackMenuHandlers = {
  onPlay?: () => void;
  onAddToQueue?: () => void;
  onAddToPlaylist?: () => void;
  onGoToArtist?: () => void;
  onGoToAlbum?: () => void;
  onMoreLikeThis?: () => void;
};

export function useMusicTrackMenuItems(
  track: MusicTrack | null | undefined,
  handlers: MusicTrackMenuHandlers,
): MusicTrackMenuItem[] {
  const t = useT();
  const { goToArtist, goToAlbum } = useMusicNavigate();
  const credits = useArtistCredits(track?.artist ?? "", track?.title ?? "");
  const { onPlay, onAddToQueue, onAddToPlaylist, onGoToArtist, onGoToAlbum, onMoreLikeThis } =
    handlers;

  const items: MusicTrackMenuItem[] = [];
  if (!track) return items;
  if (onPlay)
    items.push({ id: "play", label: t("music.play"), icon: <Play size={14} />, run: onPlay });
  if (!["local", "spotify"].includes(track.connectorId ?? "")) {
    items.push({
      id: "download",
      label: t("music.download.action"),
      icon: <Download size={14} />,
      run: () => {
        void downloadMusic(track).catch(() => {});
      },
    });
  }
  if (onAddToQueue) {
    items.push({
      id: "queue",
      label: t("music.card.addToQueue"),
      icon: <ListPlus size={14} />,
      run: onAddToQueue,
    });
  }
  if (onAddToPlaylist) {
    items.push({
      id: "playlist",
      label: t("music.card.addToPlaylist"),
      icon: <Plus size={14} />,
      run: onAddToPlaylist,
    });
  }
  if (onGoToArtist) {
    for (const credit of credits) {
      items.push({
        id: `artist:${credit.name}`,
        label:
          credits.length > 1
            ? `${t("music.card.goToArtist")} · ${credit.name}`
            : t("music.card.goToArtist"),
        icon: <UserRound size={14} />,
        run: credits.length > 1 ? () => goToArtist(credit.name, track) : onGoToArtist,
      });
    }
  }
  if (track.album) {
    const album = track.album;
    items.push({
      id: "album",
      label: t("music.card.goToAlbum"),
      icon: <Disc3 size={14} />,
      run: onGoToAlbum ?? (() => goToAlbum(album, track.artist)),
    });
  }
  items.push({
    id: "similar",
    label: t("music.card.moreLikeThis"),
    icon: <MoreLikeThisIcon size={14} />,
    run:
      onMoreLikeThis ??
      (async () => {
        const mix = await musicSimilarTracks(track);
        requestMusicExplore({ kind: "similar", track, queue: mix });
      }),
  });
  items.push({
    id: "copy",
    label: t("music.card.copyTitle"),
    icon: <Copy size={14} />,
    run: async () => {
      const text = `${track.title} - ${track.artist}`;
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
      } catch {
        const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
        await writeText(text);
      }
    },
  });
  return items;
}

export function MusicTrackMenu({
  anchorRef,
  open,
  onClose,
  items,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  items: MusicTrackMenuItem[];
}) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <AnchoredMenu anchorRef={anchorRef} open={open} onClose={onClose} width={220}>
      <div
        role="menu"
        ref={menuRef}
        onKeyDown={(event) => {
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
          ];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === "ArrowDown"
              ? (index + 1) % buttons.length
              : event.key === "ArrowUp"
                ? (index - 1 + buttons.length) % buttons.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : -1;
          if (next >= 0) {
            event.preventDefault();
            event.stopPropagation();
            buttons[next]?.focus();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            anchorRef.current?.focus();
          }
        }}
        className="harbor-float animate-menu-in overflow-hidden rounded-md bg-elevated p-1 ring-1 ring-edge-soft"
      >
        {actionFailed && (
          <p role="alert" className="p-2 text-xs text-ink-muted">
            {t("music.action.error")}
          </p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              setActionFailed(false);
              void Promise.resolve()
                .then(() => item.run())
                .catch(() => setActionFailed(true));
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-start text-[12.5px] font-medium text-ink-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-ink"
          >
            <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </AnchoredMenu>
  );
}

export function useMusicTrackContextMenu(
  track: MusicTrack | null | undefined,
  handlers: MusicTrackMenuHandlers,
) {
  const items = useMusicTrackMenuItems(track, handlers);
  const anchorRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!items.length) return;
    event.preventDefault();
    event.stopPropagation();
    anchorRef.current = event.currentTarget;
    setOpen(true);
  };
  const close = () => setOpen(false);
  return {
    open,
    onContextMenu,
    menu: <MusicTrackMenu anchorRef={anchorRef} open={open} onClose={close} items={items} />,
  };
}
