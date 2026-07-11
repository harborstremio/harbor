import { useT } from "@/lib/i18n";
import type { Season } from "@/lib/providers/tmdb";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { NewBadge } from "../badges";
import { isNewSeason } from "../helpers";

type MenuPos = { right: number; top?: number; bottom?: number; maxH: number };

export function SeasonPicker({
  seasons,
  active,
  onChange,
  lastEpisodeAir,
}: {
  seasons: Season[];
  active: number;
  onChange: (n: number) => void;
  lastEpisodeAir?: { seasonNumber: number; airDate: string | null };
}) {
  const t = useT();
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = seasons.find((s) => s.seasonNumber === active);
  const isNew = (s: Season) => isNewSeason(s, lastEpisodeAir);
  const open = menu != null;
  const hasUnseenNew = !open && seasons.some((s) => isNew(s) && s.seasonNumber !== active);

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
    const up = below < 240 && above > below;
    const maxH = Math.max(160, Math.min(0.6 * window.innerHeight, up ? above : below));
    const right = Math.max(margin, window.innerWidth - r.right);
    setMenu(up ? { right, bottom: window.innerHeight - r.top + 8, maxH } : { right, top: r.bottom + 8, maxH });
  };

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => (menu ? setMenu(null) : openMenu())}
        className="relative flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 ps-4 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-canvas/100"
      >
        <span className="max-w-[200px] truncate">{current?.name ?? t("Season {n}", { n: active })}</span>
        {current && isNew(current) && <NewBadge />}
        <ChevronDown
          size={15}
          className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        {hasUnseenNew && (
          <span className="pointer-events-none absolute -end-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-canvas" />
          </span>
        )}
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
            className="animate-fade-in fixed z-[200] w-64 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl"
          >
            <div className="overflow-y-auto" style={{ maxHeight: menu.maxH }}>
              {seasons.map((s) => {
                const isActive = s.seasonNumber === active;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onChange(s.seasonNumber);
                      setMenu(null);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors ${
                      isActive ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 text-[13.5px] font-medium">
                        <span className="truncate">{s.name}</span>
                        {isNew(s) && <NewBadge />}
                      </span>
                      <span className="text-[11.5px] text-ink-subtle">
                        {s.episodeCount === 1
                          ? t("{n} episode", { n: s.episodeCount })
                          : t("{n} episodes", { n: s.episodeCount })}
                        {s.airDate && ` · ${s.airDate.slice(0, 4)}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
