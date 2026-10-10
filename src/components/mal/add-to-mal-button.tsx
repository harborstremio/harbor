import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import malLogo from "@/assets/mal.png";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import {
  deleteListEntry,
  fetchListEntry,
  resolveMalMediaId,
  saveListEntry,
} from "@/lib/mal/mutations";
import { useMal } from "@/lib/mal/provider";
import type { MalListStatus } from "@/lib/mal/types";
import { useT } from "@/lib/i18n";

const STATUS_LABELS: Record<MalListStatus, string> = {
  watching: "Watching",
  plan_to_watch: "Plan to Watch",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
};

const STATUS_ORDER: MalListStatus[] = [
  "watching",
  "plan_to_watch",
  "completed",
  "on_hold",
  "dropped",
];

export function AddToMalButton({ harborId, title }: { harborId: string; title: string }) {
  const t = useT();
  const { isConnected } = useMal();
  const [malId, setMalId] = useState<number | null>(null);
  const [status, setStatus] = useState<MalListStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAttempt(0);
  }, [harborId]);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      const id = await resolveMalMediaId(harborId).catch(() => null);
      if (cancelled) return;
      if (id == null) {
        if (attempt < 2) timer = window.setTimeout(() => setAttempt((a) => a + 1), 15000);
        return;
      }
      setMalId(id);
      const info = await fetchListEntry(id).catch(() => null);
      if (cancelled) return;
      setStatus(info?.entry?.status ?? null);
    })();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [harborId, isConnected, attempt]);

  if (!isConnected || malId == null) return null;

  const setTo = async (next: MalListStatus) => {
    setBusy(true);
    const prev = status;
    setStatus(next);
    setMenuOpen(false);
    try {
      const saved = await saveListEntry({ malId, status: next });
      setStatus(saved.status);
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    const prevStatus = status;
    setStatus(null);
    setMenuOpen(false);
    try {
      await deleteListEntry(malId);
    } catch {
      setStatus(prevStatus);
    } finally {
      setBusy(false);
    }
  };

  if (status == null) {
    return (
      <HoverTooltip label={t("Add {title} to MyAnimeList", { title })} align="center" className="shrink-0">
        <button
          type="button"
          disabled={busy}
          onClick={() => void setTo("plan_to_watch")}
          className="flex h-12 items-center gap-2.5 rounded-full border border-edge bg-canvas/80 px-6 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,background-color,border-color] duration-200 hover:border-ink-subtle hover:bg-canvas/95 active:scale-[0.98] disabled:opacity-60"
        >
          <img src={malLogo} alt="" className="h-[18px] w-[18px] rounded-[4px] object-contain" />
          <Plus size={16} strokeWidth={2.2} className="-ms-1" />
          {t("Add to MAL")}
        </button>
      </HoverTooltip>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-12 items-center gap-2.5 rounded-full border border-ink bg-ink/10 px-6 text-[15px] font-medium text-ink transition-[transform,background-color,border-color] duration-200 hover:bg-ink/20 active:scale-[0.98] disabled:opacity-60"
      >
        <img src={malLogo} alt="" className="h-[18px] w-[18px] rounded-[4px] object-contain" />
        {t(STATUS_LABELS[status])}
        <ChevronDown
          size={16}
          className={`text-ink-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>
      <AnchoredMenu anchorRef={btnRef} open={menuOpen} onClose={() => setMenuOpen(false)} width={224}>
        <div className="overflow-hidden rounded-2xl border border-edge bg-raised py-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)]">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void setTo(s)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[13.5px] transition-colors ${
                s === status ? "text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {t(STATUS_LABELS[s])}
              {s === status && <Check size={15} className="text-ink" />}
            </button>
          ))}
          <div className="my-1 h-px bg-edge-soft" />
          <button
            type="button"
            onClick={() => void remove()}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13.5px] text-ink-muted transition-colors hover:bg-danger/15 hover:text-danger"
          >
            <Trash2 size={14} />
            {t("Remove from list")}
          </button>
        </div>
      </AnchoredMenu>
    </>
  );
}
