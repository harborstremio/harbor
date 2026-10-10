import { ArrowDownUp, Check, CheckCheck, ChevronDown, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

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
        aria-label={sort === "newest" ? t("Newest") : t("Oldest")}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-white/[0.10] xl:gap-2 xl:ps-3.5 xl:pe-3"
      >
        <ArrowDownUp size={14} className="text-ink-muted" />
        <span className="hidden xl:inline">{sort === "newest" ? t("Newest") : t("Oldest")}</span>
        <ChevronDown
          size={14}
          className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="animate-fade-in absolute end-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-lg border border-edge bg-elevated py-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.6)]">
          {(["oldest", "newest"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                onSort(s);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-start text-[13px] transition-colors ${
                sort === s ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
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

function OptionsMenu({
  allWatched,
  onMarkSeason,
}: {
  allWatched: boolean;
  onMarkSeason: (watched: boolean) => void;
}) {
  const t = useT();
  const label = allWatched ? t("Mark season as unwatched") : t("Mark season as watched");
  return (
    <button
      aria-label={label}
      title={label}
      onClick={() => onMarkSeason(!allWatched)}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/[0.10] ${
        allWatched ? "text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      {allWatched ? <EyeOff size={16} /> : <CheckCheck size={16} strokeWidth={2.2} />}
    </button>
  );
}
