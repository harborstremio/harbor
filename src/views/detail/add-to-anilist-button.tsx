import anilistLogo from "@/assets/anilist.png";
import { AnchoredMenu } from "@/components/anchored-menu";
import { deleteListEntry, fetchListEntry, saveListEntry } from "@/lib/anilist/mutations";
import { useAnilist } from "@/lib/anilist/provider";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import type { MediaListStatus } from "@/lib/anilist/types";
import { useT } from "@/lib/i18n";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STATUS_LABELS: Record<MediaListStatus, string> = {
  CURRENT: "Watching",
  PLANNING: "Plan to Watch",
  COMPLETED: "Completed",
  REPEATING: "Rewatching",
  PAUSED: "On Hold",
  DROPPED: "Dropped",
};

const STATUS_ORDER: MediaListStatus[] = ["CURRENT", "PLANNING", "COMPLETED", "REPEATING", "PAUSED", "DROPPED"];

export function AddToAnilistButton({ harborId, title }: { harborId: string; title: string }) {
  const t = useT();
  const { isConnected } = useAnilist();
  const [mediaId, setMediaId] = useState<number | null>(null);
  const [entryId, setEntryId] = useState<number | null>(null);
  const [status, setStatus] = useState<MediaListStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      const id = await resolveAnilistMediaId(harborId);
      if (cancelled) return;
      if (id == null) {
        setMediaId(null);
        setReady(true);
        return;
      }
      setMediaId(id);
      const info = await fetchListEntry(id).catch(() => null);
      if (cancelled) return;
      setEntryId(info?.entry?.id ?? null);
      setStatus(info?.entry?.status ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected]);

  if (!isConnected || !ready || mediaId == null) return null;

  const setTo = async (next: MediaListStatus) => {
    setBusy(true);
    const prev = status;
    setStatus(next);
    setMenuOpen(false);
    try {
      const saved = await saveListEntry({ mediaId, status: next });
      setEntryId(saved.id);
      setStatus(saved.status);
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (entryId == null) return;
    setBusy(true);
    const prevStatus = status;
    const prevEntry = entryId;
    setStatus(null);
    setEntryId(null);
    setMenuOpen(false);
    try {
      await deleteListEntry(prevEntry);
    } catch {
      setStatus(prevStatus);
      setEntryId(prevEntry);
    } finally {
      setBusy(false);
    }
  };

  if (status == null) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void setTo("PLANNING")}
        title={t("Add {title} to AniList", { title })}
        className="flex h-12 items-center gap-2.5 rounded-full border border-edge bg-canvas/80 px-6 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,background-color,border-color] duration-200 hover:border-ink-subtle hover:bg-canvas/95 active:scale-[0.98] disabled:opacity-60"
      >
        <img src={anilistLogo} alt="" className="h-[18px] w-[18px] rounded-[3px] object-contain" />
        <Plus size={16} strokeWidth={2.2} className="-ms-1" />
        {t("Add to AniList")}
      </button>
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
        <img src={anilistLogo} alt="" className="h-[18px] w-[18px] rounded-[3px] object-contain" />
        {t(STATUS_LABELS[status])}
        <ChevronDown size={16} className={`text-ink-muted transition-transform ${menuOpen ? "rotate-180" : ""}`} />
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
