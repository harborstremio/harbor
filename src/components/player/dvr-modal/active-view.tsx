import { CircleStop, FolderOpen } from "lucide-react";
import type { DvrSession } from "@/lib/dvr/types";
import { useT } from "@/lib/i18n";
import { Footer } from "./shared";
import { formatBytes, formatRemaining } from "./utils";

export function ActiveView({
  session,
  onStop,
  onReveal,
}: {
  session: DvrSession;
  onStop: () => void;
  onReveal: () => void;
}) {
  const t = useT();
  const ratio =
    session.plannedDurationSec > 0
      ? Math.min(1, session.elapsedSec / session.plannedDurationSec)
      : 0;
  const remaining = Math.max(0, session.plannedDurationSec - session.elapsedSec);
  const isDone = session.state === "done";
  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/55 px-4 py-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${isDone ? "bg-emerald-400" : "bg-danger animate-pulse"}`}
          />
          <div className="flex flex-1 flex-col">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
              {isDone ? t("Recording finished") : t("Recording now")}
            </span>
            <span className="truncate text-[14.5px] font-semibold text-ink">
              {session.programTitle ?? session.channelName}
            </span>
          </div>
          {!isDone && (
            <span className="font-mono text-[12.5px] tabular-nums text-ink-muted">
              {formatRemaining(remaining)}
            </span>
          )}
        </div>
        {!isDone && (
          <div className="relative h-1.5 overflow-hidden rounded-full bg-canvas/55">
            <div
              className="absolute inset-y-0 start-0 rounded-full bg-danger transition-[width] duration-500"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        )}
        <div className="flex flex-col gap-1 text-[12.5px] text-ink-muted">
          <Row label={t("Size")} value={formatBytes(session.bytesWritten)} />
          <Row label={t("File")} value={session.outputPath} mono />
        </div>
      </div>
      <Footer>
        <button
          onClick={onReveal}
          className="flex h-10 items-center gap-2 rounded-lg bg-raised px-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-raised/70"
        >
          <FolderOpen size={15} strokeWidth={2} />
          {t("Show in folder")}
        </button>
        {!isDone && (
          <button
            onClick={onStop}
            className="flex h-10 items-center gap-2 rounded-lg bg-danger px-4 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <CircleStop size={15} strokeWidth={2} />
            {t("Stop recording")}
          </button>
        )}
      </Footer>
    </>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-12 shrink-0 text-ink-subtle">{label}</span>
      <span className={`min-w-0 truncate ${mono ? "font-mono" : ""} text-ink-muted`}>{value}</span>
    </div>
  );
}
