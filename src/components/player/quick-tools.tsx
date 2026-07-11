import { useT } from "@/lib/i18n";
import type { AbLoopState } from "@/views/player/hooks/use-ab-loop";
import type { FrameGrabToast } from "@/views/player/hooks/use-frame-grab";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Camera, FolderOpen, Repeat, X } from "lucide-react";

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function QuickTools({
  visible,
  ab,
  toast,
  gifToast,
  clipToast,
}: {
  visible: boolean;
  ab: AbLoopState;
  toast: FrameGrabToast | null;
  gifToast?: FrameGrabToast | null;
  clipToast?: FrameGrabToast | null;
}) {
  return (
    <>
      {(ab.a != null || ab.b != null) && <AbLoopChip ab={ab} visible={visible} />}
      {toast && <FrameToast toast={toast} />}
      {gifToast && <FrameToast toast={gifToast} />}
      {clipToast && <FrameToast toast={clipToast} />}
    </>
  );
}

function AbLoopChip({ ab, visible }: { ab: AbLoopState; visible: boolean }) {
  const t = useT();
  return (
    <div
      className={`pointer-events-none absolute start-7 top-24 z-30 transition-all duration-200 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11.5px] font-medium text-white backdrop-blur-md">
        <Repeat size={12} strokeWidth={2.2} />
        <span className="tabular-nums text-white/90">
          {ab.a != null ? formatTime(ab.a) : "—"}
          <span className="mx-1 text-white/40">→</span>
          {ab.b != null ? formatTime(ab.b) : "—"}
        </span>
        {!ab.active && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/70">
            {ab.a == null ? "⇧ I" : "⇧ O"}
          </span>
        )}
        <button
          type="button"
          onClick={ab.clear}
          aria-label={t("Clear A-B loop")}
          className="flex h-5 w-5 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={11} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

function FrameToast({ toast }: { toast: FrameGrabToast }) {
  const t = useT();
  return (
    <div
      key={toast.id}
      className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 animate-[harbor-fade-in_200ms_ease-out]"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2.5 rounded-full border py-2 ps-4 pe-2 text-[12.5px] font-medium backdrop-blur-md ${
          toast.kind === "ok" ? "border-white/20 bg-black/80 text-white" : "border-danger/40 bg-danger/15 text-danger"
        }`}
      >
        <Camera size={13} strokeWidth={2.2} className="shrink-0" />
        <span className="whitespace-nowrap">{toast.text}</span>
        {toast.kind === "ok" && toast.path && (
          <button
            type="button"
            onClick={() => void revealItemInDir(toast.path as string)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-white/25"
          >
            <FolderOpen size={12} strokeWidth={2.2} />
            {t("Open folder")}
          </button>
        )}
      </div>
    </div>
  );
}
