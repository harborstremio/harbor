import { useDvr } from "@/lib/dvr/provider";
import type { DvrSession } from "@/lib/dvr/types";
import { useT } from "@/lib/i18n";
import { CircleStop, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function RecordingPill() {
  const { sessions, stop, reveal, dismiss } = useDvr();
  const t = useT();
  const active = sessions.filter((s) => s.state === "recording");
  const recent = sessions.filter((s) => s.state === "done" || s.state === "error");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (active.length === 0 && recent.length === 0) return null;

  const showRecording = active.length > 0;
  const primary = active[0];
  const ratio =
    primary && primary.plannedDurationSec > 0 ? Math.min(1, primary.elapsedSec / primary.plannedDurationSec) : 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("Recordings")}
        className={`relative flex h-11 items-center gap-2 rounded-xl px-3 transition-colors duration-150 ${
          showRecording
            ? "bg-elevated/85 text-ink hover:bg-elevated"
            : "bg-elevated/70 text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        <span className="relative h-2 w-2">
          <span className={`absolute inset-0 rounded-full ${showRecording ? "bg-danger" : "bg-emerald-400"}`} />
          {showRecording && <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-70" />}
        </span>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.22em]">
          {showRecording ? t("Rec") : t("Done")}
        </span>
        {active.length > 1 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-canvas/70 px-1 text-[10.5px] font-semibold text-ink">
            {active.length}
          </span>
        )}
        {primary && (
          <span className="ms-1 hidden font-mono text-[10.5px] tabular-nums text-ink-muted lg:inline">
            {Math.round(ratio * 100)}%
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+10px)] z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-edge bg-elevated/97 shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-edge-soft px-4 py-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
              {t("Recordings")}
            </span>
            <span className="text-[11px] text-ink-subtle">
              {active.length > 0 ? t("{n} active", { n: active.length }) : t("All complete")}
            </span>
          </div>
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-3 py-3">
            {active.map((s) => (
              <SessionRow key={s.id} session={s} onStop={() => stop(s.id)} onReveal={() => reveal(s.outputPath)} />
            ))}
            {recent.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onReveal={() => reveal(s.outputPath)}
                onDismiss={() => dismiss(s.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  onStop,
  onReveal,
  onDismiss,
}: {
  session: DvrSession;
  onStop?: () => void;
  onReveal: () => void;
  onDismiss?: () => void;
}) {
  const t = useT();
  const isActive = session.state === "recording";
  const isError = session.state === "error";
  const ratio = session.plannedDurationSec > 0 ? Math.min(1, session.elapsedSec / session.plannedDurationSec) : 0;
  const remaining = Math.max(0, session.plannedDurationSec - session.elapsedSec);
  const title = session.programTitle ?? session.channelName;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/55 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isError ? "bg-amber-400" : isActive ? "bg-danger animate-pulse" : "bg-emerald-400"
          }`}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold text-ink">{title}</span>
          <span className="truncate text-[11.5px] text-ink-muted">{session.channelName}</span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-subtle">
          {isActive ? formatRemaining(remaining) : formatBytes(session.bytesWritten)}
        </span>
      </div>
      {isActive && (
        <div className="relative h-[3px] overflow-hidden rounded-full bg-canvas/40">
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-danger transition-[width] duration-500"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
      {session.error && <p className="text-[11.5px] text-amber-300">{session.error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={onReveal}
          className="flex h-7 items-center gap-1 rounded-md bg-raised px-2 text-[11.5px] font-semibold text-ink-muted transition-colors hover:bg-raised/70 hover:text-ink"
        >
          <FolderOpen size={12} strokeWidth={2.2} />
          {t("Show")}
        </button>
        {isActive && onStop && (
          <button
            onClick={onStop}
            className="flex h-7 items-center gap-1 rounded-md bg-danger/85 px-2 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <CircleStop size={12} strokeWidth={2.2} />
            {t("Stop")}
          </button>
        )}
        {!isActive && onDismiss && (
          <button
            onClick={onDismiss}
            className="ms-auto text-[11px] font-semibold text-ink-subtle transition-colors hover:text-ink"
          >
            {t("Dismiss")}
          </button>
        )}
      </div>
    </div>
  );
}

function formatRemaining(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
