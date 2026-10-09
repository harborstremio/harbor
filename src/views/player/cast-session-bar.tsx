import { useEffect, useRef } from "react";
import { noteOverlayDismiss } from "@/lib/player/overlay-dismiss";
import type { CastDeviceInfo } from "@/lib/cast";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { CastIcon } from "@/components/player/cast-icon";
import { ArrowLeft, Loader2, Pause, Play, Square, X } from "lucide-react";
import type { VideoAudioCastState } from "@/lib/player/video-audio-cast";

export function SpeakerAudioBar({
  device,
  phase,
  error,
  onTogglePlay,
  onStop,
  onReturn,
  anchor,
  onClose,
}: {
  device: CastDeviceInfo;
  anchor: { right: number; bottom: number } | null;
  onClose: () => void;
  phase: VideoAudioCastState["phase"];
  error: string | null;
  onTogglePlay: () => Promise<void>;
  onStop: () => Promise<void>;
  onReturn: () => Promise<void>;
}) {
  const t = useT();
  const dir = isRtl(useUiLanguage()) ? "rtl" : "ltr";
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const dismiss = () => {
      noteOverlayDismiss();
      onClose();
    };
    const pointer = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) dismiss();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
      }
    };
    document.addEventListener("mousedown", pointer);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", pointer);
      document.removeEventListener("keydown", key, true);
      if (origin?.isConnected && panel.current?.contains(document.activeElement))
        origin.focus({ preventScroll: true });
    };
  }, [onClose]);
  const busy = phase === "connecting" || phase === "stopping";
  return (
    <section
      ref={panel}
      dir={dir}
      role="dialog"
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        right: Math.max(
          16,
          Math.min(window.innerWidth - 336, anchor ? window.innerWidth - anchor.right : 24),
        ),
        bottom: anchor ? window.innerHeight - anchor.bottom + 82 : 100,
      }}
      aria-label={t("video.cast.audioRoute")}
      className="video-speaker-bar pointer-events-auto fixed z-[140] w-80 max-w-[calc(100vw-32px)] rounded-md bg-elevated p-3 text-ink"
    >
      <div className="mb-2 flex items-center justify-between text-xs font-semibold">
        <span>{t("video.cast.audioRoute")}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex size-8 items-center justify-center rounded-md hover:bg-raised"
        >
          <X size={15} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
          <CastIcon device={device} size={36} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            {busy && <Loader2 size={14} className="shrink-0 animate-spin" />}
            <span className="truncate">{device.name}</span>
          </div>
          <p className="text-[12px] text-ink-muted" role="status">
            {t(
              phase === "connecting"
                ? "music.cast.loading"
                : phase === "stopping"
                  ? "video.cast.stopping"
                  : phase === "error"
                    ? "video.cast.retryReturn"
                    : "video.cast.localPicture",
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || phase === "error"}
          onClick={() => void onTogglePlay()}
          aria-label={phase === "playing" ? t("Pause") : t("Play")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-raised hover:bg-canvas disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {phase === "playing" ? <Pause size={17} /> : <Play size={17} />}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-subtle">
        {t("video.cast.speakerHelp")}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-amber-200">
          {t(error)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={phase === "stopping"}
          onClick={() => void onReturn()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-raised px-3 text-[12px] font-semibold hover:bg-canvas disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {t("video.cast.return")}
        </button>
        <button
          type="button"
          disabled={phase === "stopping"}
          onClick={() => void onStop().catch(() => {})}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-[12px] text-ink-muted hover:bg-raised disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Square size={12} />
          {t("music.cast.stop")}
        </button>
      </div>
    </section>
  );
}

export function CastSessionBar({
  device,
  playing,
  positionSec,
  durationSec,
  onTogglePlay,
  onStop,
  onSeek,
  transcoding,
}: {
  device: CastDeviceInfo;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  onTogglePlay: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onSeek: (sec: number) => void | Promise<void>;
  transcoding?: boolean;
}) {
  const t = useT();
  return (
    <div className="pointer-events-auto absolute left-1/2 top-6 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-edge bg-elevated/95 px-4 py-2.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
          <path d="M2 12a8 8 0 0 1 8 8" />
          <path d="M2 16a4 4 0 0 1 4 4" />
          <line x1="2" y1="20" x2="2" y2="20" />
        </svg>
      </span>
      <div className="flex flex-col">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {t("Casting to")}
        </span>
        <span className="text-[12.5px] font-semibold text-ink">{device.name}</span>
      </div>
      {transcoding && (
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-amber-200">
          {t("Transcoding")}
        </span>
      )}
      <div className="ms-2 flex items-center gap-1.5">
        <button
          onClick={() => void onTogglePlay()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas/60 text-ink transition-colors hover:bg-canvas/85"
          aria-label={playing ? t("Pause") : t("Play")}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5v14l12-7z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => void onSeek(Math.max(0, positionSec - 15))}
          className="rounded-full bg-canvas/60 px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-canvas/85"
        >
          {t("−15s")}
        </button>
        <button
          onClick={() =>
            void onSeek(Math.min(durationSec || Number.POSITIVE_INFINITY, positionSec + 15))
          }
          className="rounded-full bg-canvas/60 px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-canvas/85"
        >
          {t("+15s")}
        </button>
        <button
          onClick={() => void onStop()}
          className="rounded-full bg-rose-400/20 px-3 py-1 text-[11px] font-semibold text-rose-100 transition-colors hover:bg-rose-400/30"
        >
          {t("Stop")}
        </button>
      </div>
    </div>
  );
}
