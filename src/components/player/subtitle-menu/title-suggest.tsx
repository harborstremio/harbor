import { Film, Loader2, Minus, Plus, Tv } from "lucide-react";
import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import type { TitleCandidate } from "@/lib/subtitles/title-search";

export function TitleSuggestDropdown({
  anchorRef,
  items,
  loading,
  onPick,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  items: TitleCandidate[];
  loading: boolean;
  onPick: (c: TitleCandidate) => void;
}) {
  const t = useT();
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 6, left: r.left, width: r.width });
  }, [anchorRef]);

  if (!loading && items.length === 0) return null;
  if (!rect) return null;

  return createPortal(
    <div
      data-title-suggest-dropdown=""
      className="fixed z-[2000] overflow-hidden rounded-md bg-elevated shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
      style={{ top: rect.top, left: rect.left, width: rect.width }}
    >
      <div className="max-h-[300px] overflow-y-auto p-1.5">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-ink-muted">
            <Loader2 size={13} className="animate-spin" /> {t("Searching titles…")}
          </div>
        ) : (
          items.map((c) => (
            <button
              key={c.imdbId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(c);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-raised"
            >
              <span className="flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-raised">
                {c.poster ? (
                  <img src={c.poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : c.type === "series" ? (
                  <Tv size={14} className="text-ink-subtle" />
                ) : (
                  <Film size={14} className="text-ink-subtle" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium text-ink">{c.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                  {c.type === "series" ? <Tv size={11} /> : <Film size={11} />}
                  <span>{c.type === "series" ? t("Series") : t("Movie")}</span>
                  {c.year && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{c.year}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

export function TargetBar({
  type,
  season,
  episode,
  onSeason,
  onEpisode,
}: {
  type: "movie" | "series";
  season?: number;
  episode?: number;
  onSeason: (n: number) => void;
  onEpisode: (n: number) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-2.5">
      {type === "series" && (
        <div className="flex items-center gap-1.5">
          <NumStepper label={t("Season")} value={season ?? 1} onChange={onSeason} />
          <NumStepper label={t("Ep")} value={episode ?? 1} onChange={onEpisode} />
        </div>
      )}
    </div>
  );
}

function NumStepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-raised px-1 py-0.5">
      <span className="ps-1 pe-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label={`${label} -1`}
        className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <Minus size={12} strokeWidth={2.4} />
      </button>
      <span className="min-w-[20px] text-center text-[12.5px] font-semibold tabular-nums text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`${label} +1`}
        className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <Plus size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}
