import type { JSX } from "react";
import { Captions, CaptionsOff, Loader2, Maximize, Minimize, Wallpaper } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { setMusicAppearance, useMusicAppearance } from "@/lib/music/appearance";
import { lyricIndexAt, type LyricLine } from "@/lib/music/lyrics";
import "./music-video-surface.css";

export type MusicVideoControlsProps = {
  lyrics: LyricLine[] | null;
  lyricsState: "off" | "loading" | "on" | "unavailable";
  onToggleLyrics: () => void;
  currentTime: number;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  expanded?: boolean;
};

export type MusicVideoLyricLine = { index: number; text: string };

export function musicVideoLyricLine(
  lines: LyricLine[] | null,
  currentTime: number,
): MusicVideoLyricLine | null {
  if (!lines || lines.length === 0) return null;
  const index = lyricIndexAt(lines, currentTime);
  if (index < 0) return null;
  const text = lines[index].text.trim();
  if (!text) return null;
  return { index, text };
}

export function MusicVideoControls({
  lyrics,
  lyricsState,
  onToggleLyrics,
  currentTime,
  fullscreen,
  onToggleFullscreen,
  expanded,
}: MusicVideoControlsProps): JSX.Element {
  const t = useT();
  const appearance = useMusicAppearance();
  const unavailable = lyricsState === "unavailable";
  const loading = lyricsState === "loading";
  const line = lyricsState === "on" ? musicVideoLyricLine(lyrics, currentTime) : null;
  const lyricsLabel = unavailable
    ? t("No lyrics for this track")
    : loading
      ? t("Finding lyrics")
      : lyricsState === "on"
        ? t("Hide lyrics")
        : t("Lyrics");
  const fullscreenLabel = fullscreen ? t("Exit fullscreen") : t("Fullscreen");
  return (
    <>
      {line && (
        <div className="music-video-subtitle" aria-hidden="true">
          <span key={line.index}>{line.text}</span>
        </div>
      )}
      <div className="music-video-controls">
        <button
          type="button"
          className="music-video-chrome-button"
          data-state={lyricsState}
          aria-disabled={unavailable || undefined}
          aria-pressed={unavailable ? undefined : lyricsState === "on"}
          aria-label={lyricsLabel}
          title={lyricsLabel}
          onClick={unavailable ? undefined : onToggleLyrics}
        >
          {loading ? (
            <Loader2 size={19} className="animate-spin" aria-hidden />
          ) : unavailable ? (
            <CaptionsOff size={19} aria-hidden />
          ) : (
            <Captions size={19} aria-hidden />
          )}
        </button>
        {expanded && !fullscreen && (
          <button
            type="button"
            className="music-video-chrome-button"
            aria-pressed={appearance.immersive}
            aria-label={t("Immersive")}
            title={t("Immersive")}
            onClick={() => setMusicAppearance({ immersive: !appearance.immersive })}
          >
            <Wallpaper size={19} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className="music-video-chrome-button music-video-fullscreen-toggle"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize size={19} aria-hidden /> : <Maximize size={19} aria-hidden />}
        </button>
      </div>
    </>
  );
}
