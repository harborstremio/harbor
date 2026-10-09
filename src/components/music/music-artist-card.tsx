import { useState, type MouseEvent } from "react";
import { Play, UserRound } from "@/components/icons/music-icons";
import { MusicPlaylistCover } from "@/components/music/music-playlist-cover";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { MusicArtistRef } from "@/lib/music/types";

export function artistMonogram(name: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return "";
  const first = Array.from(trimmed)[0] ?? "";
  if (!first || first === " ") return "";
  const upper = first.toLocaleUpperCase();
  return Array.from(upper)[0] ?? first;
}

export function MusicArtistCard({
  artist,
  albumArtwork = [],
  subtitle,
  onPlay,
  onOpen,
  onMenu,
  className = "",
}: {
  artist: MusicArtistRef;
  albumArtwork?: readonly (string | null | undefined)[];
  subtitle?: string;
  onPlay?: () => void;
  onOpen?: () => void;
  onMenu?: (event: MouseEvent<HTMLElement>) => void;
  className?: string;
}) {
  const t = useT();
  const [deadArtwork, setDeadArtwork] = useState<string | null>(null);
  const name = artist.name?.trim() ?? "";
  const caption = subtitle ?? artist.subtitle ?? "";
  const seed = `artist:${artist.connectorId}:${artist.id}`;
  const artwork = typeof artist.artwork === "string" ? artist.artwork.trim() : "";
  const covers = albumArtwork.filter(
    (url): url is string => typeof url === "string" && url.trim().length > 0,
  );
  const mosaic = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1);
  const showArtwork = artwork.length > 0 && deadArtwork !== artwork;
  const mono = artistMonogram(name);
  const activate = onPlay ?? onOpen;
  const label = onPlay
    ? t("music.card.playItem", { title: name })
    : t("music.card.openItem", { title: name });

  return (
    <button
      type="button"
      onClick={activate}
      onContextMenu={onMenu}
      aria-label={label}
      className={`group flex w-full min-w-0 flex-col text-start ${className}`}
    >
      <span className="relative block w-full overflow-hidden rounded-full ring-1 ring-edge-soft">
        {showArtwork ? (
          <Poster
            src={artwork}
            seed={seed}
            ratio="square"
            className="w-full rounded-full"
            onError={() => setDeadArtwork(artwork)}
          />
        ) : mosaic.length > 0 ? (
          <MusicPlaylistCover
            artwork={mosaic}
            seed={seed}
            className="rounded-full"
            glyphSize={22}
          />
        ) : (
          <span className="relative block w-full bg-elevated">
            <span aria-hidden="true" className="block" style={{ paddingTop: "100%" }} />
            <span className="absolute inset-0 grid place-items-center font-semibold text-[32px] leading-none text-ink-muted">
              {mono || <UserRound size={30} aria-hidden="true" />}
            </span>
          </span>
        )}
        {onPlay && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-canvas/45 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <span className="grid size-11 place-items-center rounded-full bg-ink text-canvas shadow-lg">
              <Play size={16} fill="currentColor" />
            </span>
          </span>
        )}
      </span>
      <span className="mt-[10px] flex min-w-0 items-center justify-center gap-[5px]">
        <span className="truncate text-[13px] font-semibold text-ink" title={name}>
          {name}
        </span>
      </span>
      {caption && (
        <span className="mt-px truncate text-center text-[13px] text-ink-subtle" title={caption}>
          {caption}
        </span>
      )}
    </button>
  );
}
