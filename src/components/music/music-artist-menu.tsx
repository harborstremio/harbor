import { useRef, useState } from "react";
import { AnchoredMenu } from "@/components/anchored-menu";
import {
  ArtistPlaybackOff,
  ArtistPlaybackOn,
  ArtistSimilar,
  ArtistSongsHidden,
  ArtistSongsVisible,
  MoreHorizontal,
} from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { toggleArtistBlock, useArtistBlock } from "@/lib/music/artist-blocks";
import type { MusicArtistRef, MusicTrack } from "@/lib/music/types";
import "./music-artist-menu.css";

export function MusicArtistMenu({
  artist,
  seed,
  onRadio,
}: {
  artist: MusicArtistRef;
  seed?: MusicTrack;
  onRadio: (track: MusicTrack) => void;
}) {
  const t = useT();
  const anchor = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const noPlay = useArtistBlock(artist, "play");
  const hidden = useArtistBlock(artist, "show");
  const items = [
    {
      key: "radio",
      label: t("music.artist.moreLike"),
      icon: <ArtistSimilar size={18} aria-hidden />,
      disabled: !seed,
      run: () => seed && onRadio(seed),
    },
    {
      key: "play",
      label: t(noPlay ? "music.artist.doPlay" : "music.artist.dontPlay"),
      icon: noPlay ? (
        <ArtistPlaybackOn size={18} aria-hidden />
      ) : (
        <ArtistPlaybackOff size={18} aria-hidden />
      ),
      disabled: false,
      run: () => toggleArtistBlock(artist, "play"),
    },
    {
      key: "show",
      label: t(hidden ? "music.artist.showSongs" : "music.artist.hideSongs"),
      icon: hidden ? (
        <ArtistSongsVisible size={18} aria-hidden />
      ) : (
        <ArtistSongsHidden size={18} aria-hidden />
      ),
      disabled: false,
      run: () => toggleArtistBlock(artist, "show"),
    },
  ];
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="music-collection-extra"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("music.card.moreActions", { title: artist.name })}
        title={t("music.card.moreActions", { title: artist.name })}
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal size={24} aria-hidden />
      </button>
      <AnchoredMenu anchorRef={anchor} open={open} onClose={() => setOpen(false)} width={276}>
        <div role="menu" className="music-artist-menu animate-menu-in">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </AnchoredMenu>
    </>
  );
}
