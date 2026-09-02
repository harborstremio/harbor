import { Check, ChevronDown, Loader2, RotateCcw, ThumbsDown, ThumbsUp, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { openSyncBar } from "@/lib/player/sub-sync";
import { useAsrModelProgress } from "@/lib/subtitles/autosync/asr-model-progress";
import type { AutoSyncHandle } from "@/views/player/hooks/use-auto-sync";
import type { PipelineOutcome } from "@/lib/subtitles/autosync/pipeline";
import type { SyncTransform } from "@/lib/subtitles/autosync/fp-gate";

type Phase = "analyzing" | "synced" | "offer" | "wrong" | "declined" | "error";
type Thumb = "up" | "down";
type Acting = "offer" | "retry" | null;

function phaseOf(h: AutoSyncHandle): Phase | null {
  switch (h.status) {
    case "analyzing":
      return "analyzing";
    case "synced":
    case "best-effort":
      return "synced";
    case "offer":
      return h.offer?.subSwap ? "wrong" : "offer";
    case "declined":
      return "declined";
    case "error":
      return "error";
    default:
      return null;
  }
}

function affineOf(t: SyncTransform | null | undefined): { offsetSec: number; ratio: number } | null {
  if (!t) return null;
  if (t.kind === "affine") return { offsetSec: t.offsetSec, ratio: t.ratio };
  const s = t.segments[0];
  return s ? { offsetSec: s.offsetSec, ratio: s.ratio } : null;
}

function formatShift(offsetSec: number): string {
  const rounded = Math.round(offsetSec * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "";
  return `${rounded >= 0 ? "+" : ""}${rounded}s`;
}

function correctionOf(o: PipelineOutcome | null): string {
  const a = affineOf(o?.candidate);
  return a ? formatShift(a.offsetSec) : "";
}

function dwellFor(phase: Phase, thumb: Thumb | null): number | null {
  if (phase === "synced") return thumb === "down" ? null : thumb === "up" ? 1600 : 6000;
  if (phase === "offer" || phase === "wrong") return 12000;
  if (phase === "declined" || phase === "error") return 7000;
  return null;
}

export function AutosyncPopover({ handle }: { handle: AutoSyncHandle }) {
  const t = useT();
  const phase = phaseOf(handle);
  const modelDl = useAsrModelProgress();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [acting, setActing] = useState<Acting>(null);
  const [held, setHeld] = useState(false);
  const correctionRef = useRef("");

  useEffect(() => {
    setDismissed(false);
    setThumb(null);
    setActing(null);
    setOpen(phase === "synced" || phase === "offer" || phase === "wrong");
  }, [phase]);

  useEffect(() => {
    if (phase === "analyzing" || phase === null) {
      correctionRef.current = "";
      return;
    }
    const c = correctionOf(handle.offer);
    if (c) correctionRef.current = c;
  }, [phase, handle.offer]);

  useEffect(() => {
    if (phase === null) return;
    const ms = dwellFor(phase, thumb);
    if (ms == null || held) return;
    const id = window.setTimeout(() => setDismissed(true), ms);
    return () => window.clearTimeout(id);
  }, [phase, thumb, held]);

  if (phase === null || dismissed) return null;

  const correction = correctionRef.current;
  const hasPanel = phase !== "analyzing";

  const applyOffer = () => {
    setActing("offer");
    handle.applyOffer();
  };
  const retry = () => {
    setActing("retry");
    handle.retry();
  };
  const onThumb = (v: Thumb) => {
    setThumb(v);
    handle.feedback(v === "up");
  };
  const syncManually = () => {
    setDismissed(true);
    openSyncBar();
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-6 pt-[68px]">
      <div
        className="pointer-events-auto relative flex flex-col items-center"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocusCapture={() => setHeld(true)}
        onBlurCapture={() => setHeld(false)}
      >
        <button
          type="button"
          onClick={hasPanel ? () => setOpen((v) => !v) : undefined}
          aria-expanded={hasPanel ? open : undefined}
          className="flex h-9 items-center gap-2 rounded-full border border-edge bg-elevated/95 pe-2.5 ps-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-colors hover:bg-elevated aria-disabled:cursor-default motion-reduce:transition-none"
        >
          <Lead phase={phase} />
          <span role="status" aria-live="polite" className="whitespace-nowrap text-[13px] font-semibold text-ink">
            {phase === "analyzing" && modelDl.active
              ? modelDl.total > 0
                ? t("Downloading speech model {pct}%", {
                    pct: Math.round((modelDl.received / modelDl.total) * 100),
                  })
                : t("Downloading speech model")
              : chipLabel(t, phase)}
          </span>
          {hasPanel && (
            <ChevronDown
              size={15}
              strokeWidth={2.2}
              className={`text-ink-subtle transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {open && hasPanel && (
          <div className="absolute top-full mt-2 w-[min(88vw,360px)] rounded-md bg-elevated p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
            <span className="absolute -top-1.5 start-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-s border-t border-edge bg-elevated" />
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t("Dismiss")}
              className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-subtle transition-colors hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
            <Body
              t={t}
              phase={phase}
              correction={correction}
              thumb={thumb}
              acting={acting}
              onThumb={onThumb}
              onApplyOffer={applyOffer}
              onRetry={retry}
              onManual={syncManually}
              onRevert={handle.revert}
              onKeep={() => setDismissed(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function chipLabel(t: (s: string) => string, phase: Phase): string {
  switch (phase) {
    case "analyzing":
      return t("Checking sources and audio");
    case "synced":
      return t("Subtitles synced");
    case "offer":
      return t("Subtitles may be off");
    case "wrong":
      return t("Different subtitle version");
    case "declined":
      return t("Couldn't auto-sync");
    case "error":
      return t("Sync unavailable");
  }
}

function Lead({ phase }: { phase: Phase }) {
  if (phase === "analyzing") {
    return <Loader2 size={15} strokeWidth={2.4} className="shrink-0 animate-spin text-ink-muted motion-reduce:animate-none" />;
  }
  if (phase === "synced") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 animate-in zoom-in duration-200 motion-reduce:animate-none">
        <Check size={14} strokeWidth={2.6} className="text-success" />
      </span>
    );
  }
  if (phase === "wrong" || phase === "error") {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />;
  }
  if (phase === "offer") {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />;
  }
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-subtle" />;
}

function Body(props: {
  t: (s: string) => string;
  phase: Phase;
  correction: string;
  thumb: Thumb | null;
  acting: Acting;
  onThumb: (v: Thumb) => void;
  onApplyOffer: () => void;
  onRetry: () => void;
  onManual: () => void;
  onRevert: () => void;
  onKeep: () => void;
}) {
  const { t, phase, correction, thumb, acting } = props;

  if (phase === "synced") {
    if (thumb === "up") {
      return <Ack label={t("Thanks")} />;
    }
    if (thumb === "down") {
      return (
        <div className="flex flex-col gap-2 pe-6">
          <p className="text-[13px] font-semibold text-ink">{t("Not right?")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <PrimaryBtn icon={<Wand2 size={14} strokeWidth={2.2} />} label={t("Try again")} onClick={props.onRetry} busy={acting === "retry"} />
            <GhostBtn label={t("Sync manually")} onClick={props.onManual} />
            <GhostBtn label={t("Undo")} icon={<RotateCcw size={13} strokeWidth={2.2} />} onClick={props.onRevert} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-3 pe-6">
        <p className="text-[13px] text-ink-muted">
          {correction ? t("Adjusted timing by") + " " : t("Timing looks aligned")}
          {correction && <span className="font-semibold text-ink tabular-nums">{correction}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn label={t("Looks right")} onClick={() => props.onThumb("up")}>
            <ThumbsUp size={15} strokeWidth={2.2} />
          </IconBtn>
          <IconBtn label={t("Still off")} danger onClick={() => props.onThumb("down")}>
            <ThumbsDown size={15} strokeWidth={2.2} />
          </IconBtn>
        </div>
      </div>
    );
  }

  if (phase === "wrong") {
    return (
      <div className="flex flex-col gap-2 pe-6">
        <p className="text-[13px] leading-snug text-ink-muted">
          {t("This subtitle looks like a different version of the video.")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <PrimaryBtn icon={<Wand2 size={14} strokeWidth={2.2} />} label={t("Use a better match")} onClick={props.onApplyOffer} busy={acting === "offer"} />
          <GhostBtn label={t("Keep anyway")} onClick={props.onKeep} />
        </div>
      </div>
    );
  }

  if (phase === "offer") {
    return (
      <div className="flex flex-col gap-2 pe-6">
        <p className="text-[13px] leading-snug text-ink-muted">
          {correction ? t("Best guess") + " " : ""}
          {correction && <span className="font-semibold text-ink tabular-nums">{correction}</span>}
          {correction ? ". " : ""}
          {t("Apply it, then nudge if it's off.")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <PrimaryBtn icon={<Wand2 size={14} strokeWidth={2.2} />} label={t("Sync")} onClick={props.onApplyOffer} busy={acting === "offer"} />
          <GhostBtn label={t("Sync manually")} onClick={props.onManual} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pe-6">
      <p className="text-[13px] leading-snug text-ink-muted">
        {phase === "error" ? t("Sync is unavailable right now.") : t("Couldn't line up these subtitles automatically.")}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PrimaryBtn icon={<Wand2 size={14} strokeWidth={2.2} />} label={t("Try again")} onClick={props.onRetry} busy={acting === "retry"} />
        <GhostBtn label={t("Sync manually")} onClick={props.onManual} />
      </div>
    </div>
  );
}

function Ack({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 pe-6 text-[13px] font-medium text-ink-muted">
      <Check size={14} strokeWidth={2.4} className="text-success" />
      {label}
    </span>
  );
}

function PrimaryBtn({ icon, label, onClick, busy }: { icon: ReactNode; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent px-3 text-[13px] font-semibold text-canvas transition-all hover:brightness-110 active:scale-95 disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {busy ? <Loader2 size={14} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" /> : icon}
      {label}
    </button>
  );
}

function GhostBtn({ icon, label, onClick }: { icon?: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-raised px-3 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-raised active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${danger ? "hover:text-danger" : "hover:text-success"}`}
    >
      {children}
    </button>
  );
}
