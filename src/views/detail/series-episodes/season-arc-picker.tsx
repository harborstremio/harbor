import { useT } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { NewBadge } from "../badges";

export type PickerItem = {
  key: string;
  name: string;
  count: number;
  year?: string;
  from?: string;
  to?: string;
  isNew?: boolean;
  extra?: boolean;
};

type MenuPos = { right: number; top?: number; bottom?: number; maxH: number };

export function SeasonArcPicker({
  items,
  activeKey,
  onSelect,
  mode,
  onModeChange,
}: {
  items: PickerItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  mode?: "seasons" | "arcs";
  onModeChange?: (m: "seasons" | "arcs") => void;
}) {
  const t = useT();
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.key === activeKey) ?? items[0];
  const open = menu != null;
  const hasUnseenNew = !open && items.some((i) => i.isNew && i.key !== activeKey);
  const mainItems = items.filter((i) => !i.extra);
  const extraItems = items.filter((i) => i.extra);

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
    const maxH = Math.min(0.6 * window.innerHeight, up ? above : below);
    const right = Math.max(margin, window.innerWidth - r.right);
    setMenu(up ? { right, bottom: window.innerHeight - r.top + 8, maxH } : { right, top: r.bottom + 8, maxH });
  };

  const renderRow = (item: PickerItem) => {
    const isActive = item.key === activeKey;
    return (
      <button
        key={item.key}
        onClick={() => {
          onSelect(item.key);
          setMenu(null);
        }}
        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors ${
          isActive ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
        }`}
      >
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 text-[13.5px] font-medium">
            <span className="truncate">{item.name}</span>
            {item.isNew && <NewBadge />}
          </span>
          <span className="text-[11.5px] text-ink-subtle">
            {item.count === 1 ? t("{n} episode", { n: item.count }) : t("{n} episodes", { n: item.count })}
            {item.year && ` · ${item.year}`}
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
        className="relative flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 ps-4 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-canvas/100"
      >
        <span className="max-w-[220px] truncate">{current?.name ?? t("Seasons")}</span>
        {current?.isNew && <NewBadge />}
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
            className="animate-fade-in fixed z-[200] w-72 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl"
          >
            {mode && onModeChange && (
              <div className="flex items-center gap-1 border-b border-edge-soft/60 px-2 pb-2 pt-1">
                {(["seasons", "arcs"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onModeChange(m)}
                    className={`h-8 flex-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
                      mode === m ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {m === "seasons" ? t("Seasons") : t("Arcs")}
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-y-auto" style={{ maxHeight: menu.maxH }}>
              {mainItems.map(renderRow)}
              {extraItems.length > 0 && (
                <div className="mt-1 border-t border-edge-soft/60 px-4 pb-1.5 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("Movies & Specials")}
                </div>
              )}
              {extraItems.map(renderRow)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
