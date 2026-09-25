import { loadRecordingProfile } from "@/lib/music/recording-profile";
import { resolveDisplayCredits } from "@/lib/music/artist-credit";
import { requestMusicExplore } from "@/lib/music/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, TriangleAlert, Unplug } from "lucide-react";
import type { MusicCardBadge } from "@/components/music/music-cover-card";
import { useMusicNavigate } from "@/components/music/music-navigate";
import { useMusicPlaylistPicker } from "@/components/music/music-playlist-picker";
import { MusicTrackRow } from "@/components/music/music-track-row";
import { useT } from "@/lib/i18n";
import { enqueueMusic, musicSimilarTracks, useMusicPlayer } from "@/lib/music/player";
import type { MusicTrack } from "@/lib/music/types";

export type MusicSectionStatus = "loading" | "ready" | "error";

export type MusicSectionConnect = {
  name: string;
  body?: string;
  onConnect: () => void;
  connecting?: boolean;
};

export function MusicSectionHead({
  title,
  subtitle,
  onViewAll,
  viewAllLabel,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
}) {
  const t = useT();
  return (
    <div className="flex items-baseline justify-between gap-4 pe-1">
      <h3 className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[17px] font-medium tracking-tight text-ink">{title}</span>
        {subtitle && (
          <span className="truncate text-[12px] font-medium text-ink-subtle">{subtitle}</span>
        )}
      </h3>
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-subtle transition-colors duration-200 ease-out hover:text-ink"
        >
          {t(viewAllLabel ?? "music.row.viewAll")}
          <ChevronRight
            size={14}
            strokeWidth={2.2}
            className="dir-icon transition-transform duration-200 ease-out group-hover/va:translate-x-0.5"
          />
        </button>
      )}
    </div>
  );
}

function BandShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[168px] place-items-center rounded-xl border border-edge-soft bg-surface px-6 py-6 text-center">
      <div className="flex max-w-md flex-col items-center">{children}</div>
    </div>
  );
}

export function MusicSectionConnectCard({ connect }: { connect: MusicSectionConnect }) {
  const t = useT();
  return (
    <BandShell>
      <span className="grid size-11 place-items-center rounded-full bg-elevated text-ink-muted">
        <Unplug size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 text-[15px] font-medium text-ink">
        {t("music.connect.shelfTitle", { name: connect.name })}
      </p>
      <p className="mt-1.5 text-[13px] leading-5 text-ink-muted">
        {connect.body ?? t("music.connect.shelfBody")}
      </p>
      <button
        type="button"
        onClick={connect.onConnect}
        disabled={connect.connecting}
        className="mt-5 inline-flex h-11 min-w-28 items-center justify-center rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60"
      >
        {connect.connecting ? t("music.connect.connecting") : t("music.connect.action")}
      </button>
    </BandShell>
  );
}

export function MusicSectionError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <BandShell>
      <span className="grid size-11 place-items-center rounded-full bg-elevated text-danger">
        <TriangleAlert size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 text-[13px] leading-5 text-ink-muted">
        {message || t("music.error.load")}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-edge px-4 text-[11px] font-medium text-ink transition-colors duration-200 ease-out hover:bg-elevated"
        >
          {t("music.row.tryAgain")}
        </button>
      )}
    </BandShell>
  );
}

export function MusicSectionEmpty({ label }: { label?: string }) {
  const t = useT();
  return (
    <p className="flex min-h-[72px] items-center text-[13px] text-ink-subtle">
      {label || t("music.row.emptyRow")}
    </p>
  );
}

export function MusicTrackGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-[46px] gap-y-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex h-14 min-w-0 items-center">
          <div className="size-14 shrink-0 rounded-[4px] bg-elevated/40" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 ps-3">
            <div className="h-3 w-2/5 rounded bg-elevated/35" />
            <div className="h-3 w-1/4 rounded bg-elevated/25" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MusicTrackGrid({
  title,
  subtitle,
  tracks,
  status = "ready",
  error,
  onRetry,
  connect,
  numbered = false,
  startIndex = 1,
  count = 9,
  emptyLabel,
  badgeFor,
  leadingFor,
  onPlay,
  onAddToQueue,
  onAddToPlaylist,
  onGoToArtist,
  onGoToAlbum,
  onMoreLikeThis,
  onViewAll,
  viewAllLabel,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  tracks: readonly MusicTrack[];
  status?: MusicSectionStatus;
  error?: string;
  onRetry?: () => void;
  connect?: MusicSectionConnect | null;
  numbered?: boolean;
  startIndex?: number;
  count?: number;
  emptyLabel?: string;
  badgeFor?: (track: MusicTrack, index: number) => MusicCardBadge | null | undefined;
  leadingFor?: (track: MusicTrack, index: number) => ReactNode;
  onPlay: (track: MusicTrack, index: number) => void;
  onAddToQueue?: (track: MusicTrack, index: number) => void;
  onAddToPlaylist?: (track: MusicTrack, index: number) => void;
  onGoToArtist?: (track: MusicTrack, index: number) => void;
  onGoToAlbum?: (track: MusicTrack, index: number) => void;
  onMoreLikeThis?: (track: MusicTrack, index: number) => void;
  onViewAll?: () => void;
  viewAllLabel?: string;
  className?: string;
}) {
  const visible = tracks.slice(0, count);
  const radioRequest = useRef(0);
  const similarRequest = useRef(0);
  const [radioStatus, setRadioStatus] = useState<{
    op: "radio" | "similar";
    state: "loading" | "error";
  } | null>(null);
  const t = useT();
  useEffect(
    () => () => {
      radioRequest.current += 1;
    },
    [],
  );
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const { goToArtist, goToAlbum } = useMusicNavigate();
  const player = useMusicPlayer();
  const isCurrent = (track: MusicTrack) =>
    [player.current, player.current?.collectionOrigin].some(
      (identity) => identity?.id === track.id && identity.connectorId === track.connectorId,
    );
  // Queueing, saving and starting a radio mean the same thing wherever a track is listed,
  // so the grid supplies them and a caller only overrides for something view specific.
  const addToQueue = onAddToQueue ?? ((track: MusicTrack) => enqueueMusic(track));
  const addToPlaylist = onAddToPlaylist ?? ((track: MusicTrack) => openPlaylistPicker(track));
  const moreLikeThis =
    onMoreLikeThis ??
    (async (track: MusicTrack) => {
      const request = ++similarRequest.current;
      setRadioStatus({ op: "similar", state: "loading" });
      try {
        const mix = await musicSimilarTracks(track);
        if (request !== similarRequest.current) return;
        setRadioStatus(null);
        requestMusicExplore({ kind: "similar", track, queue: mix });
      } catch {
        if (request === similarRequest.current) setRadioStatus({ op: "similar", state: "error" });
      }
    });
  const toArtist = onGoToArtist ?? ((track: MusicTrack) => goToArtist(track.artist, track));
  const toAlbum =
    onGoToAlbum ??
    (async (track: MusicTrack) => {
      const request = ++radioRequest.current;
      setRadioStatus({ op: "radio", state: "loading" });
      try {
        const recording = await loadRecordingProfile(track).catch(() => null);
        if (request !== radioRequest.current) return;
        if (recording?.album) requestMusicExplore({ kind: "album", track, album: recording.album });
        else {
          const credits = await resolveDisplayCredits(track.artist);
          if (request === radioRequest.current)
            goToAlbum(track.album ?? "", credits[0]?.name ?? track.artist);
        }
      } finally {
        if (request === radioRequest.current) setRadioStatus(null);
      }
    });

  let body: ReactNode;
  if (connect) {
    body = <MusicSectionConnectCard connect={connect} />;
  } else if (status === "error") {
    body = <MusicSectionError message={error} onRetry={onRetry} />;
  } else if (status === "loading") {
    body = <MusicTrackGridSkeleton count={count} />;
  } else if (visible.length === 0) {
    body = <MusicSectionEmpty label={emptyLabel} />;
  } else {
    body = (
      <div className="grid grid-cols-1 gap-x-[46px] gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((track, index) => (
          <MusicTrackRow
            key={`${track.connectorId ?? ""}:${track.sourceId ?? track.id}:${index}`}
            track={track}
            nowPlaying={isCurrent(track)}
            paused={player.phase === "paused"}
            index={numbered ? startIndex + index : undefined}
            leading={leadingFor?.(track, index)}
            badge={badgeFor?.(track, index)}
            onPlay={() => {
              radioRequest.current += 1;
              setRadioStatus(null);
              onPlay(track, index);
            }}
            onAddToQueue={() => addToQueue(track, index)}
            onAddToPlaylist={() => addToPlaylist(track, index)}
            onGoToArtist={() => toArtist(track, index)}
            onGoToAlbum={() => toAlbum(track, index)}
            onMoreLikeThis={() => moreLikeThis(track, index)}
          />
        ))}
      </div>
    );
  }

  return (
    <section className={`flex min-w-0 flex-col gap-5 ps-[9px] ${className}`}>
      <MusicSectionHead
        title={title}
        subtitle={subtitle}
        onViewAll={onViewAll}
        viewAllLabel={viewAllLabel}
      />
      {radioStatus && (
        <p
          role={radioStatus.state === "error" ? "alert" : "status"}
          className="text-sm text-ink-muted"
        >
          {t(
            radioStatus.op === "similar"
              ? radioStatus.state === "error"
                ? "music.similar.error"
                : "music.similar.building"
              : radioStatus.state === "error"
                ? "music.radio.error"
                : "music.loading",
          )}
        </p>
      )}
      {body}
    </section>
  );
}
