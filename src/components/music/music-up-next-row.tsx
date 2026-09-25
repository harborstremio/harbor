import { Play } from "lucide-react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { enqueueMusic, playMusic } from "@/lib/music/player";
import type { MusicTrack } from "@/lib/music/types";
import { MusicMediaBadge } from "./music-media-badge";
import { MusicTrackLabels } from "./music-track-labels";
import { useMusicTrackContextMenu } from "./music-track-menu";

export function MusicUpNextRow({
  track,
  queue,
  onArtist,
  onAlbum,
  onAddToPlaylist,
  onMoreLikeThis,
}: {
  track: MusicTrack;
  queue: MusicTrack[];
  onArtist: () => void;
  onAlbum?: () => void;
  onAddToPlaylist?: () => void;
  onMoreLikeThis?: () => void;
}) {
  const t = useT();
  const play = () => void playMusic(track, queue).catch(() => {});
  const menu = useMusicTrackContextMenu(track, {
    onPlay: play,
    onAddToQueue: () => enqueueMusic(track),
    onAddToPlaylist,
    onGoToArtist: onArtist,
    onGoToAlbum: onAlbum,
    onMoreLikeThis,
  });

  return (
    <li onContextMenu={menu.onContextMenu} data-menu-open={menu.open || undefined}>
      <button
        type="button"
        className="music-now-next-art"
        onClick={play}
        aria-label={t("music.playTrack", { title: track.title, artist: track.artist })}
      >
        <Poster
          src={track.artwork}
          seed={track.id}
          ratio="square"
          className="w-full [--poster-radius:0px]"
          lazy
        />
      </button>
      <span className="music-now-next-title">
        <button type="button" onClick={play}>
          <strong>{track.title}</strong>
        </button>
        <span className="flex items-center gap-2">
          <button type="button" onClick={onArtist}>
            {track.artist}
          </button>
          <MusicMediaBadge kind={track.mediaKind} compact />
          <MusicTrackLabels track={track} />
        </span>
      </span>
      <span className="music-now-next-time">{track.durationLabel}</span>
      <Play size={15} aria-hidden="true" />
      {menu.menu}
    </li>
  );
}
