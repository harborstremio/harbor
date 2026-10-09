import { useRef, useState } from "react";
import { MusicActionGlyph } from "./music-action-feedback";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { downloadMusic, musicDownloadFor, useMusicDownloads } from "@/lib/music/downloads";
import { useMusicAudioSettings } from "@/lib/music/audio-settings";
import type { MusicTrack } from "@/lib/music/types";

export function MusicDownloadButton({
  track,
  className = "music-dock-icon",
  withTooltip = false,
}: {
  track: MusicTrack;
  className?: string;
  withTooltip?: boolean;
}) {
  const t = useT();
  useMusicDownloads();
  const audio = useMusicAudioSettings();
  const anchor = useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = useState(false);
  const entry = musicDownloadFor(track);
  const busy = entry?.status === "downloading" || entry?.status === "queued",
    done = entry?.status === "done";
  const filtered =
    Math.abs(audio.settings.speed - 1) > 0.001 ||
    Math.abs(audio.settings.pitch) > 0.001 ||
    Math.abs(audio.settings.reverb) > 0.001;

  if (track.connectorId === "local") return null;
  const label = t(
    done
      ? "music.download.done"
      : busy
        ? "music.download.busy"
        : entry?.status === "error"
          ? "music.download.retry"
          : "music.download.action",
  );
  const start = (withFilters: boolean) => {
    setAsking(false);
    void downloadMusic(track, withFilters).catch(() => {});
  };

  const tooltipLabel = track.connectorId === "spotify" ? t("music.download.unsupported") : label;
  const button = (
    <button
      ref={anchor}
      type="button"
      className={`${className} music-action-button`}
      data-music-action-state={done ? "done" : busy ? "busy" : "idle"}
      aria-busy={busy}
      disabled={busy || done || track.connectorId === "spotify"}
      title={withTooltip ? undefined : tooltipLabel}
      aria-label={label}
      aria-haspopup={filtered ? "menu" : undefined}
      onClick={() => (filtered ? setAsking((open) => !open) : start(false))}
    >
      <MusicActionGlyph
        state={done ? "done" : busy ? "busy" : entry?.status === "error" ? "error" : "idle"}
        identity={`${track.connectorId}:${track.id}`}
        idle={entry?.status === "error"
          ? <MusicGlyph name="retry" size={18} />
          : <MusicGlyph name="download" size={18} viewBox="-1 -1 26 26" />}
      />
      <span className="sr-only">{label}</span>
      {!withTooltip && busy && entry.progress > 0 && <small>{Math.round(entry.progress * 100)}%</small>}
    </button>
  );

  return (
    <>
      {withTooltip ? (
        <HoverTooltip label={tooltipLabel} side="top" align="center">{button}</HoverTooltip>
      ) : button}
      <AnchoredMenu anchorRef={anchor} open={asking} onClose={() => setAsking(false)} width={244}>
        <div role="menu" className="music-download-ask">
          <p>{t("music.download.askTitle")}</p>
          <button type="button" role="menuitem" onClick={() => start(true)}>
            <strong>{t("music.download.withFilters")}</strong>
            <small>{t("music.download.withFiltersHint")}</small>
          </button>
          <button type="button" role="menuitem" onClick={() => start(false)}>
            <strong>{t("music.download.original")}</strong>
            <small>{t("music.download.originalHint")}</small>
          </button>
          <p className="mt-1 border-t border-edge-soft">{t("music.legal.savingShort")}</p>
        </div>
      </AnchoredMenu>
    </>
  );
}
