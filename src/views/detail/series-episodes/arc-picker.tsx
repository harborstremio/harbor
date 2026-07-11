import { useT } from "@/lib/i18n";
import type { StoryArc } from "@/lib/providers/tmdb";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuPos = { right: number; top?: number; bottom?: number; maxH: number };

export function ArcModeToggle({
  mode,
  onModeChange,
}: {
  mode: "seasons" | "arcs";
  onModeChange: (m: "seasons" | "arcs") => void;
}) {
  const t = useT();
  const opt = (value: "seasons" | "arcs", label: string) => (
    <button
      onClick={() => onModeChange(value)}
      className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
        mode === value ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex h-10 items-center gap-1 rounded-full border border-edge-soft bg-canvas/90 px-1">
      {opt("seasons", t("Seasons"))}
      {opt("arcs", t("Arcs"))}
    </div>
  );
}

export function ArcPicker({
  arcs,
  activeArcId,
  onArcChange,
}: {
  arcs: StoryArc[];
  activeArcId: string | null;
  onArcChange: (id: string) => void;
}) {
  const t = useT();
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = arcs.find((a) => a.id === activeArcId);
  const open = menu != null;

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
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 ps-4 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-canvas/100"
      >
        <span className="max-w-[220px] truncate">{current?.name ?? t("Arcs")}</span>
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
            className="animate-fade-in fixed z-[200] w-72 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl"
          >
            <div className="overflow-y-auto" style={{ maxHeight: menu.maxH }}>
              {arcs.map((a) => {
                const isActive = a.id === activeArcId;
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      onArcChange(a.id);
                      setMenu(null);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors ${
                      isActive ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                    }`}
                  >
                    <span className="min-w-0 truncate text-[13.5px] font-medium">{a.name}</span>
                    <span className="shrink-0 text-[11.5px] text-ink-subtle">
                      {a.episodes.length === 1
                        ? t("{n} episode", { n: a.episodes.length })
                        : t("{n} episodes", { n: a.episodes.length })}
                    </span>
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
