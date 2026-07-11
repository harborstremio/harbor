import { Flag } from "@/components/flag";
import { useT } from "@/lib/i18n";
import { modalOverlayClose, modalOverlayEmitState, modalOverlayOpen } from "@/lib/modal-overlay";
import type { TrackInfo } from "@/lib/player/bridge";
import { languageName } from "@/lib/subtitles/language";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Check, Languages, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useMenuSide } from "./menu-side";
import { Tooltip } from "./transport/tooltip";

type Props = {
  tracks: TrackInfo[];
  selectedId: string | null;
  delaySec: number;
  engine: "html5" | "mpv";
  onSelect: (id: string) => void;
  onDelay: (sec: number) => void;
  onOpenChange?: (open: boolean) => void;
  useOverlayPopup?: boolean;
};

function buildAudioOverlayState(props: Props) {
  return {
    tracks: props.tracks,
    selectedId: props.selectedId,
    delaySec: props.delaySec,
    engine: props.engine,
  };
}

export function AudioMenu(props: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [forceInline, setForceInline] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { side, measure } = useMenuSide(wrap, 360);
  const useOverlay = props.useOverlayPopup === true;
  const propsRef = useRef(props);
  propsRef.current = props;
  const onOpenChange = props.onOpenChange;
  useEffect(() => {
    onOpenChange?.(open && (forceInline || !useOverlay));
  }, [open, forceInline, useOverlay, onOpenChange]);

  useEffect(() => {
    if (useOverlay) return;
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open, useOverlay]);

  useEffect(() => {
    if (!useOverlay) return;
    const offs: Array<Promise<UnlistenFn>> = [];
    offs.push(
      listen<{ id: string }>("modal://audio/select", (e) => {
        propsRef.current.onSelect(e.payload.id);
      }),
    );
    offs.push(
      listen<{ sec: number }>("modal://audio/delay", (e) => {
        propsRef.current.onDelay(e.payload.sec);
      }),
    );
    offs.push(listen("modal://closed", () => setOpen(false)));
    return () => offs.forEach((p) => p.then((fn) => fn()).catch(() => {}));
  }, [useOverlay]);

  useEffect(() => {
    if (!useOverlay || !open) return;
    void modalOverlayEmitState("audio", buildAudioOverlayState(props));
  }, [useOverlay, open, props.tracks, props.selectedId, props.delaySec, props.engine]);

  useEffect(() => {
    return () => {
      if (useOverlay && open) void modalOverlayClose();
    };
  }, [useOverlay, open]);

  const handleClick = () => {
    if (!open) measure();
    if (!useOverlay) {
      setOpen((v) => !v);
      return;
    }
    if (open) {
      void modalOverlayClose();
      setOpen(false);
      setForceInline(false);
    } else {
      void modalOverlayOpen("audio", buildAudioOverlayState(propsRef.current))
        .then(() => {
          setOpen(true);
          setForceInline(false);
        })
        .catch(() => {
          setOpen(true);
          setForceInline(true);
        });
    }
  };

  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("Audio tracks")}>
        <button
          type="button"
          onClick={handleClick}
          aria-label={t("Audio")}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            open ? "bg-white/22 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Languages size={19} strokeWidth={2} />
        </button>
      </Tooltip>
      {open && (forceInline || !useOverlay) && (
        <div
          className={`absolute bottom-[calc(100%+10px)] ${side === "start" ? "start-0" : "end-0"} flex max-h-[400px] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl`}
        >
          <AudioMenuBody {...props} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function AudioMenuBody(props: Props & { onClose: () => void }) {
  return <MenuBody {...props} />;
}

function MenuBody(props: Props & { onClose: () => void }) {
  const t = useT();
  const { tracks, selectedId, onSelect, onClose, delaySec, onDelay, engine } = props;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-edge-soft px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[13.5px] font-semibold text-ink">{t("Audio")}</span>
          {tracks.length > 0 && <span className="text-[11.5px] tabular-nums text-ink-subtle">{tracks.length}</span>}
        </div>
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        <TrackSection
          tracks={tracks}
          selectedId={selectedId}
          engine={engine}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
        />
      </div>

      <DelayRow delay={delaySec} onDelay={onDelay} disabled={engine === "html5"} />
    </div>
  );
}

function TrackSection({
  tracks,
  selectedId,
  engine,
  onSelect,
}: {
  tracks: TrackInfo[];
  selectedId: string | null;
  engine: "html5" | "mpv";
  onSelect: (id: string) => void;
}) {
  const tr = useT();
  if (tracks.length === 0) {
    return (
      <div className="px-3 py-4 text-[12.5px] leading-relaxed text-ink-muted">
        {engine === "mpv"
          ? tr("This file has one audio track.")
          : tr("Track switching isn't supported on the current engine. The file's default audio is playing.")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {tracks.map((t) => {
        const isSel = t.id === selectedId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors ${
              isSel ? "bg-elevated ring-1 ring-edge" : "hover:bg-canvas/55"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                isSel ? "bg-accent text-canvas" : "bg-raised text-ink-subtle"
              }`}
              aria-hidden
            >
              {isSel ? <Check size={9} strokeWidth={3} /> : null}
            </span>
            {t.lang && (
              <span className="mt-0.5 shrink-0">
                <Flag language={languageName(t.lang)} size="sm" showLabel={false} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[12.5px] font-medium leading-snug text-ink">{trackTitle(t, tr)}</span>
              <span className="truncate text-[10.5px] uppercase tracking-[0.1em] text-ink-subtle">
                {trackSubtitle(t, tr)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function trackTitle(t: TrackInfo, tr: (key: string) => string): string {
  if (t.title && t.title.trim() && t.title !== t.lang) return t.title;
  if (t.lang) return languageName(t.lang);
  return t.label || tr("Track");
}

function trackSubtitle(t: TrackInfo, tr: (key: string) => string): string {
  const parts: string[] = [];
  if (t.lang) parts.push(languageName(t.lang));
  if (t.codec) parts.push(t.codec);
  if (t.channels) parts.push(t.channels);
  if (t.default) parts.push(tr("Default"));
  return parts.filter(Boolean).join(" · ");
}

function DelayRow({ delay, onDelay, disabled }: { delay: number; onDelay: (sec: number) => void; disabled: boolean }) {
  const tr = useT();
  const round = (v: number) => Math.round(v * 100) / 100;
  return (
    <div
      className={`flex flex-col gap-2.5 px-4 py-3 border-t border-edge-soft bg-canvas/30 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink">{tr("Sync Offset")}</span>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[13px] font-bold tabular-nums ${delay !== 0 ? "text-accent" : "text-ink-muted"}`}
          >
            {delay > 0 ? "+" : ""}
            {delay.toFixed(2)}s
          </span>
          {delay !== 0 && !disabled && (
            <button
              onClick={() => onDelay(0)}
              aria-label={tr("Reset sync")}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-raised text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            >
              <RotateCcw size={12} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-stretch overflow-hidden rounded-lg bg-raised">
        <button
          disabled={disabled}
          onClick={() => onDelay(round(delay - 0.1))}
          className="flex-1 px-2 py-1.5 text-[12px] font-semibold tabular-nums text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 disabled:cursor-not-allowed"
        >
          −0.1s
        </button>
        <div className="w-px bg-edge-soft/50" />
        <button
          disabled={disabled}
          onClick={() => onDelay(round(delay + 0.1))}
          className="flex-1 px-2 py-1.5 text-[12px] font-semibold tabular-nums text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 disabled:cursor-not-allowed"
        >
          +0.1s
        </button>
      </div>
    </div>
  );
}
