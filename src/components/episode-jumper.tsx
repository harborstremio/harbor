import { Hash } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { scrollToDataEp } from "@/lib/episode-scroll";
import { useT } from "@/lib/i18n";

const CHUNK_SIZE = 50;

export function EpisodeJumper({
  scrollRef,
  totalEpisodes,
  onReveal,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  totalEpisodes: number;
  onReveal?: (n: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const ranges = useMemo(() => {
    if (totalEpisodes <= CHUNK_SIZE) return [] as Array<[number, number]>;
    const out: Array<[number, number]> = [];
    for (let start = 1; start <= totalEpisodes; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, totalEpisodes);
      out.push([start, end]);
    }
    return out;
  }, [totalEpisodes]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
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

  if (totalEpisodes < 12) return null;

  const jumpToEpisode = (n: number) => {
    onReveal?.(n);
    setOpen(false);
    setDraft("");
    scrollToDataEp(scrollRef.current, n);
  };

  const submit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalEpisodes) jumpToEpisode(n);
  };

  return createPortal(
    <div ref={popoverRef} className="fixed bottom-16 end-5 z-40">
      {open && (
        <div className="absolute bottom-full end-0 mb-2 flex w-[280px] flex-col gap-2.5 rounded-xl border border-edge-soft/60 bg-canvas/95 p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md animate-popover-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={totalEpisodes}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`1 – ${totalEpisodes}`}
              className="h-9 flex-1 rounded-lg border border-edge-soft bg-canvas px-3 text-[13px] text-ink outline-none transition-colors focus:border-ink-subtle"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-9 rounded-lg bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t("Jump")}
            </button>
          </form>
          {ranges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ranges.map(([start, end]) => (
                <button
                  key={start}
                  onClick={() => jumpToEpisode(start)}
                  className="rounded-md border border-edge-soft/70 bg-elevated/60 px-2 py-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:bg-elevated hover:text-ink"
                >
                  {start}–{end}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("Jump to episode")}
        className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/90 px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <Hash size={12} strokeWidth={2.2} />
        <span>{t("Jump")}</span>
      </button>
    </div>,
    document.body,
  );
}
