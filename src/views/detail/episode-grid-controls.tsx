import { useT } from "@/lib/i18n";
import { ArrowDownUp, Check, CheckCheck, ChevronDown, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Sort = "oldest" | "newest";

export function EpisodeGridControls({
  sort,
  onSort,
  allWatched,
  onMarkSeason,
}: {
  sort: Sort;
  onSort: (s: Sort) => void;
  allWatched: boolean;
  onMarkSeason: (watched: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <SortMenu sort={sort} onSort={onSort} />
      <OptionsMenu allWatched={allWatched} onMarkSeason={onMarkSeason} />
    </div>
  );
}

function SortMenu({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 ps-3.5 pe-3 text-[13px] font-medium text-ink transition-colors hover:bg-canvas"
      >
        <ArrowDownUp size={14} className="text-ink-muted" />
        <span>{sort === "newest" ? t("Newest") : t("Oldest")}</span>
        <ChevronDown
          size={14}
          className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="animate-fade-in absolute end-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl">
          {(["oldest", "newest"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                onSort(s);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-start text-[13px] transition-colors ${
                sort === s ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {s === "newest" ? t("Newest") : t("Oldest")}
              {sort === s && <Check size={14} strokeWidth={2.5} className="text-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionsMenu({ allWatched, onMarkSeason }: { allWatched: boolean; onMarkSeason: (watched: boolean) => void }) {
  const t = useT();
  const label = allWatched ? t("Mark season as unwatched") : t("Mark season as watched");
  return (
    <button
      aria-label={label}
      title={label}
      onClick={() => onMarkSeason(!allWatched)}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft bg-canvas/90 transition-colors hover:bg-canvas ${
        allWatched ? "text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      {allWatched ? <EyeOff size={16} /> : <CheckCheck size={16} strokeWidth={2.2} />}
    </button>
  );
}
