import { useT } from "@/lib/i18n";
import type { TvdbSeasonTypeOption } from "@/lib/providers/tvdb";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PickerItem } from "./season-arc-picker";

type MenuPos = { right: number; top?: number; bottom?: number; maxH: number };

function fmtMonth(d?: string): string {
  if (!d) return "";
  const date = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function isOngoing(to?: string): boolean {
  if (!to) return false;
  const d = new Date(to.length <= 10 ? `${to}T00:00:00` : to);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() >= now.getMonth())
  );
}

function dateSub(item: PickerItem, ongoing: boolean, current: string): string {
  if (item.from && item.to) {
    const from = fmtMonth(item.from);
    const to = fmtMonth(item.to);
    if (from && to) {
      if (ongoing) return `${from} - ${current}`;
      return from === to ? from : `${from} - ${to}`;
    }
  }
  return item.year ?? "";
}

export function TvdbOrderPanel({
  items,
  activeKey,
  onSelect,
  orderTypes,
  activeType,
  onSelectType,
}: {
  items: PickerItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  orderTypes: TvdbSeasonTypeOption[];
  activeType: string;
  onSelectType: (v: TvdbSeasonTypeOption["value"]) => void;
}) {
  const t = useT();
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menu != null;
  const current = items.find((i) => i.key === activeKey) ?? items[0];

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
    const up = below < 300 && above > below;
    const maxH = Math.min(0.6 * window.innerHeight, up ? above : below);
    const right = Math.max(margin, window.innerWidth - r.right);
    setMenu(up ? { right, bottom: window.innerHeight - r.top + 8, maxH } : { right, top: r.bottom + 8, maxH });
  };

  const pick = (key: string) => {
    onSelect(key);
    setMenu(null);
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
            className="animate-fade-in fixed z-[200] w-[340px] overflow-hidden rounded-2xl border border-edge-soft bg-canvas shadow-2xl"
          >
            {orderTypes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 border-b border-edge-soft/60 p-2">
                {orderTypes.map((o) => {
                  const on = o.value === activeType || (activeType === "official" && o.value === "aired");
                  return (
                    <button
                      key={o.value}
                      onClick={() => onSelectType(o.value)}
                      className={`h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                        on ? "bg-ink text-canvas" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              <span>{t("Season")}</span>
              <span>{t("Episodes")}</span>
            </div>
            <div className="overflow-y-auto pb-1.5" style={{ maxHeight: menu.maxH }}>
              {items.map((item) => {
                const ongoing = isOngoing(item.to);
                return (
                  <OrderRow
                    key={item.key}
                    name={item.name}
                    sub={dateSub(item, ongoing, t("Current"))}
                    count={item.count}
                    active={item.key === activeKey}
                    ongoing={ongoing}
                    ongoingLabel={t("Ongoing")}
                    onClick={() => pick(item.key)}
                  />
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function OrderRow({
  name,
  sub,
  count,
  active,
  ongoing,
  ongoingLabel,
  onClick,
}: {
  name: string;
  sub: string;
  count: number;
  active: boolean;
  ongoing?: boolean;
  ongoingLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2.5 text-start transition-colors ${
        active ? "bg-ink/10 text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium">{name}</span>
          {ongoing && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {ongoingLabel}
            </span>
          )}
        </span>
        {sub && <span className="text-[11.5px] text-ink-subtle">{sub}</span>}
      </span>
      <span className="tabular-nums text-[12.5px] text-ink-subtle">{count}</span>
    </button>
  );
}
