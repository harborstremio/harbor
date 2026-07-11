import { useT } from "@/lib/i18n";
import { franchiseTags, type FranchiseEntry } from "@/lib/providers/anime-detail";
import { useView } from "@/lib/view";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { UpcomingBadge } from "../badges";

export function AnimeSeasonPicker({ franchise, currentId }: { franchise: FranchiseEntry[]; currentId: string }) {
  const t = useT();
  const { openMeta } = useView();
  const [menu, setMenu] = useState<{ right: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menu != null;
  const matchIdx = franchise.findIndex((f) => f.meta.id === currentId);
  const currentIdx = matchIdx >= 0 ? matchIdx : franchise.findIndex((f) => f.isCurrent);
  const current = franchise[currentIdx];

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 16;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    const up = below < 260 && above > below;
    const maxH = Math.max(160, Math.min(0.6 * window.innerHeight, up ? above : below));
    const right = Math.max(margin, window.innerWidth - r.right);
    setMenu(up ? { right, bottom: window.innerHeight - r.top + 8, maxH } : { right, top: r.bottom + 8, maxH });
  };

  if (!current) return null;
  const tags = franchiseTags(franchise);
  const positionLabel = tags[currentIdx]?.short ?? `S${currentIdx + 1}`;
  const seasonIdxs = tags.map((tg, i) => (tg?.kind === "season" ? i : -1)).filter((i) => i >= 0);
  const extraIdxs = tags.map((tg, i) => (tg?.kind !== "season" ? i : -1)).filter((i) => i >= 0);
  const renderEntry = (i: number) => {
    const f = franchise[i];
    const isActive = i === currentIdx;
    return (
      <button
        key={f.meta.id}
        onClick={() => {
          if (!isActive) openMeta(f.meta);
          setMenu(null);
        }}
        className={`flex w-full items-start gap-3 px-4 py-3 text-start transition-colors ${
          isActive ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
        }`}
      >
        <span className="mt-0.5 font-mono text-[11px] text-ink-subtle">{tags[i]?.short ?? `S${i + 1}`}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[13.5px] font-medium">
            <span className="truncate">{f.meta.name}</span>
            {f.isUpcoming && <UpcomingBadge />}
          </span>
          <span className="text-[11.5px] text-ink-subtle">
            {f.episodeCount
              ? f.episodeCount === 1
                ? t("{n} ep", { n: f.episodeCount })
                : t("{n} eps", { n: f.episodeCount })
              : ""}
            {f.episodeCount && f.startDate ? "  ·  " : ""}
            {f.startDate ? f.startDate.slice(0, 4) : f.isUpcoming ? "TBA" : ""}
          </span>
        </div>
      </button>
    );
  };

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => (menu ? setMenu(null) : openMenu())}
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-elevated/70 ps-4 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-elevated"
      >
        <span className="font-mono text-[11.5px] text-ink-subtle">{positionLabel}</span>
        <span className="max-w-[280px] truncate">{current.meta.name}</span>
        {current.isUpcoming && <UpcomingBadge />}
        <ChevronDown
          size={15}
          className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
            className="animate-fade-in fixed z-[200] w-[360px] max-w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl"
          >
            <div className="overflow-y-auto" style={{ maxHeight: menu.maxH }}>
              {seasonIdxs.map(renderEntry)}
              {extraIdxs.length > 0 && (
                <div className="mt-1 border-t border-edge-soft/60 px-4 pb-1.5 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("Movies & Specials")}
                </div>
              )}
              {extraIdxs.map(renderEntry)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
