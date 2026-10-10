import { useRef, useState, type MouseEvent } from "react";
import { ChevronRight, ImageDown, Play, UserRound } from "@/components/icons/music-icons";
import { coverCardTitle } from "@/components/music/music-cover-card";
import { useMusicNavigate } from "@/components/music/music-navigate";
import { useMusicPlaylistPicker } from "@/components/music/music-playlist-picker";
import {
  MusicTrackMenu,
  useMusicTrackMenuItems,
  type MusicTrackMenuItem,
} from "@/components/music/music-track-menu";
import { useT } from "@/lib/i18n";
import { enqueueMusic } from "@/lib/music/player";
import { saveArtwork } from "@/lib/music/artwork-save";
import type { MusicCatalogItem } from "@/lib/music/types";

type Handlers = {
  onPlay?: (item: MusicCatalogItem, index: number) => void;
  onOpen?: (item: MusicCatalogItem, index: number) => void;
};

export function useMusicItemMenu(handlers: Handlers) {
  const t = useT();
  const { goToArtist } = useMusicNavigate();
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const anchor = useRef<HTMLElement | null>(null);
  const [target, setTarget] = useState<{ item: MusicCatalogItem; index: number } | null>(null);

  const item = target?.item ?? null;
  const index = target?.index ?? 0;
  const track = item?.kind === "track" ? item : null;
  const trackItems = useMusicTrackMenuItems(track, {
    onPlay: handlers.onPlay && track ? () => handlers.onPlay?.(track, index) : undefined,
    onAddToQueue: track ? () => enqueueMusic(track) : undefined,
    onAddToPlaylist: track ? () => openPlaylistPicker(track) : undefined,
    onGoToArtist: track ? () => goToArtist(track.artist, track) : undefined,
  });

  let items: MusicTrackMenuItem[] = [];
  if (track) {
    items = trackItems;
  } else if (item) {
    const built: MusicTrackMenuItem[] = [];
    if (handlers.onPlay) {
      built.push({
        id: "play",
        label: t("music.play"),
        icon: <Play size={14} />,
        run: () => handlers.onPlay?.(item, index),
      });
    }
    if (handlers.onOpen) {
      built.push({
        id: "open",
        label: t("music.card.openItem", { title: coverCardTitle(item) }),
        icon: <ChevronRight size={14} className="dir-icon" />,
        run: () => handlers.onOpen?.(item, index),
      });
    }
    if (item.kind === "album") {
      const artist = item.artist;
      built.push({
        id: "artist",
        label: t("music.card.goToArtist"),
        icon: <UserRound size={14} />,
        run: () => goToArtist(artist),
      });
    }
    if (item.artwork) {
      const art = Array.isArray(item.artwork) ? item.artwork[0] : item.artwork;
      const name = coverCardTitle(item);
      const by = "artist" in item ? (item.artist ?? "") : "";
      built.push({
        id: "artwork",
        label: t("music.artwork.save"),
        icon: <ImageDown size={14} />,
        run: async () => {
          await saveArtwork(art, name, by);
        },
      });
    }
    items = built;
  }

  const open = (item: MusicCatalogItem, index: number, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    anchor.current = event.currentTarget;
    setTarget({ item, index });
  };

  return {
    open,
    openFor: (item: MusicCatalogItem, index = 0) => (event: MouseEvent<HTMLElement>) =>
      open(item, index, event),
    isOpen: target !== null,
    menu: (
      <MusicTrackMenu
        anchorRef={anchor}
        open={target !== null && items.length > 0}
        onClose={() => setTarget(null)}
        items={items}
      />
    ),
  };
}
