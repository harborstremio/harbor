import { MusicPinnedCover } from "./music-pinned-cover";
import { MusicPlaylistCover } from "./music-playlist-cover";
import { useMusicPlaylistCover } from "./music-playlist-cover-edit";
import { useT } from "@/lib/i18n";
import type { MusicCollectionEntry } from "@/lib/music/library-collections";
import "./music-collection-grid.css";
import type { ReactNode } from "react";
import { useMusicPlaybackOrigin } from "@/lib/music/playback-origin";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";
import { MusicNowPlayingMark } from "./music-now-playing-mark";


function EntryCover({ entry }: { entry: MusicCollectionEntry }) {
  const custom = useMusicPlaylistCover(entry.kind === "playlist" ? entry.id : "");
  if (entry.kind === "liked" || entry.kind === "recent")
    return <MusicPinnedCover kind={entry.kind} artwork={entry.artwork} />;
  if (custom)
    return (
      <span className="music-collection-art">
        <img src={custom} alt="" draggable={false} loading="lazy" />
      </span>
    );
  if (entry.kind === "album" || entry.kind === "artist")
    return entry.artwork[0] ? (
      <span className="music-collection-art">
        <img src={entry.artwork[0]} alt="" draggable={false} loading="lazy" />
      </span>
    ) : (
      <span className="music-collection-art" data-blank="" />
    );
  return (
    <MusicPlaylistCover artwork={entry.artwork} seed={entry.id} glyphSize={36} />
  );
}

export function MusicCollectionGrid({
  entries,
  emptyCopy,
  onOpen,
  emptyState,
}: {
  entries: MusicCollectionEntry[];
  emptyCopy: string;
  onOpen: (entry: MusicCollectionEntry) => void;
  emptyState?: ReactNode;
}) {
  const t = useT();
  const origin = useMusicPlaybackOrigin();
  const now = useMusicNowPlaying();
  if (entries.length === 0) return emptyState ?? <p className="music-library-empty">{emptyCopy}</p>;
  return (
    <div className="music-collection-grid">
      {entries.map((entry) => (
        <button
          type="button"
          key={entry.key}
          data-library-collection={entry.key}
          data-round={entry.round || undefined}
          className="music-collection-card"
          onClick={() => onOpen(entry)}
        >
          <span className="music-collection-cover-wrap">
            <EntryCover entry={entry} />
            {origin?.kind === "playlist" && entry.kind === "playlist" && origin.id === entry.id &&
              (now.phase === "playing" || now.phase === "resolving") && (
                <MusicNowPlayingMark loading={now.phase === "resolving"} />
              )}
          </span>
          <strong>{entry.name}</strong>
          <span>
            {entry.kind === "artist"
              ? entry.subtitle || t("music.search.artists")
              : entry.count > 0
                ? t("music.card.trackCount", { count: entry.count })
                : entry.subtitle}
          </span>
        </button>
      ))}
    </div>
  );
}
