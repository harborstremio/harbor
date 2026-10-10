import type { ReactNode } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { LoaderCircle, Pause, Play, Shuffle } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import type { MusicTrack } from "@/lib/music/types";
import { toggleMusicShuffle, useMusicTransport } from "./music-queue";
import { useCollectionPlayback } from "@/lib/music/use-collection-playback";
import "./music-collection-controls.css";
/** Collection controls retain the stored order; shuffle belongs to playback. */
export function MusicCollectionControls({
  tracks,
  onPlay,
  disabled = false,
  loading = false,
  extra,
}: {
  tracks: MusicTrack[];
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
  disabled?: boolean;
  loading?: boolean;
  extra?: ReactNode;
}) {
  const t = useT();
  const transport = useMusicTransport();
  const { playing, busy, play } = useCollectionPlayback(tracks, onPlay);

  return (
    <div className="music-collection-controls">
      <button
        type="button"
        className="music-collection-play"
        disabled={disabled || loading || !tracks.length || busy}
        aria-label={t(playing ? "music.pause" : "music.play")}
        title={t(playing ? "music.pause" : "music.play")}
        onClick={play}
      >
        {busy ? (
          <LoaderCircle size={24} className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : playing ? (
          <Pause size={24} fill="currentColor" aria-hidden />
        ) : (
          <Play size={24} fill="currentColor" aria-hidden />
        )}
      </button>
      {(tracks.length > 1 || loading) && (
        <HoverTooltip label={t("music.transport.shuffle")} side="top" align="center" disabled={disabled || loading}>
        <button
          type="button"
          className="music-collection-shuffle"
          disabled={disabled || loading}
          aria-pressed={transport.shuffle}
          aria-label={t("music.transport.shuffle")}
          onClick={toggleMusicShuffle}
        >
          <Shuffle size={26} aria-hidden />
        </button>
        </HoverTooltip>
      )}
      {extra}
    </div>
  );
}
