import { Radio, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import type { TorrentListItem } from "@/lib/torrent/local-engine";
import { ActiveTorrentRow } from "./active-torrent-row";
import { useActiveTorrents } from "./use-active-torrents";

export function StreamingNowButton({ active }: { active: boolean }) {
  const t = useT();
  const { items, refresh } = useActiveTorrents(active);
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-edge-soft bg-elevated/50 px-3 text-[12.5px] font-medium text-ink-muted transition duration-150 hover:border-edge hover:text-ink active:scale-[0.97]"
      >
        <Radio size={14} strokeWidth={2.1} className="shrink-0 text-accent" />
        {t("Streaming")}
        <span className="rounded-full bg-accent/15 px-1.5 py-px text-[11px] font-semibold tabular-nums text-accent">
          {items.length}
        </span>
      </button>
      {open && (
        <StreamingNowModal
          items={items}
          onRun={(p) => void p.then(refresh)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function StreamingNowModal({
  items,
  onRun,
  onClose,
}: {
  items: TorrentListItem[];
  onRun: (p: Promise<void>) => void;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-center justify-center bg-canvas/80 px-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Streaming now")}
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex max-h-[min(80vh,640px)] w-[min(92vw,540px)] flex-col overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
              {t("Streaming now")}
            </h2>
            <p className="text-[13px] leading-snug text-ink-muted">
              {t("Sources cached in the background for the streams you are watching")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition duration-150 hover:bg-ink/10 hover:text-ink active:scale-90"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>
        <ul className="flex min-h-[96px] flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-5 pt-4">
          {items.map((it) => (
            <ActiveTorrentRow key={it.infoHash} item={it} onRun={onRun} />
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
