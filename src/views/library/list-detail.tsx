import { ArrowLeft, Layers, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import {
  MAX_ITEMS,
  removeFromList,
  reorderListItems,
  useList,
  type ListItem,
} from "@/lib/custom-lists";
import { relativeTime } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { PickCard } from "@/components/pick-card";
import { AddTitleSearch } from "./list-detail/add-title-search";
import { ListSettingsMenu } from "./list-detail/list-settings-menu";
import { Grid } from "./shared";

function itemToMeta(it: ListItem): Meta {
  return {
    id: it.id,
    type: it.type,
    name: it.name,
    poster: it.poster,
    addonOrigin: it.addonOrigin,
    videos: it.videos,
  };
}

export function ListDetail({ listId, onBack }: { listId: string; onBack: () => void }) {
  const t = useT();
  const list = useList(listId);
  const itemElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => dragCleanupRef.current?.(), []);
  const [order, setOrder] = useState<string[]>(() => list?.items.map((it) => it.id) ?? []);

  const itemIds = list?.items.map((it) => it.id).join(",") ?? "";
  useEffect(() => {
    if (dragCleanupRef.current) return;
    setOrder(itemIds ? itemIds.split(",") : []);
  }, [itemIds]);

  const orderedItems = useMemo(() => {
    const source = list?.items ?? [];
    const byId = new Map(source.map((it) => [it.id, it] as const));
    const seq = order.length ? order : source.map((it) => it.id);
    const out = seq.map((oid) => byId.get(oid)).filter((x): x is ListItem => !!x);
    for (const it of source) if (!out.some((existing) => existing.id === it.id)) out.push(it);
    return out;
  }, [list, order]);

  const startItemDrag = (e: React.PointerEvent<HTMLDivElement>, itemId: string, index: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button[aria-label="Remove from list"]')) return;
    const ids = orderedItems.map((it) => it.id);
    if (ids.length < 2) return;
    const els = ids.map((iid) => itemElsRef.current.get(iid));
    if (els.some((el) => !el)) return;
    const slots = els.map((el) => {
      const r = el!.getBoundingClientRect();
      return {
        x: r.left,
        y: r.top,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        h: r.height,
      };
    });
    const startX = e.clientX;
    const startY = e.clientY;
    const dragged = itemElsRef.current.get(itemId)!;
    let curOrder = ids;
    let moved = false;

    const applyShift = (next: string[]) => {
      for (let oi = 0; oi < ids.length; oi++) {
        const iid = ids[oi];
        if (iid === itemId) continue;
        const el = itemElsRef.current.get(iid);
        if (!el) continue;
        const ni = next.indexOf(iid);
        const tx = slots[ni].x - slots[oi].x;
        const ty = slots[ni].y - slots[oi].y;
        el.style.transition = "transform 190ms cubic-bezier(0.2,0.9,0.2,1)";
        el.style.transform = tx || ty ? `translate(${tx}px,${ty}px)` : "";
      }
    };

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < 4) return;
        moved = true;
        document.body.style.userSelect = "none";
        dragged.style.zIndex = "50";
        dragged.style.willChange = "transform";
        dragged.style.boxShadow = "0 22px 45px -14px rgba(0,0,0,0.65)";
      }
      dragged.style.transition = "none";
      dragged.style.transform = `translate(${dx}px,${dy}px) scale(1.05)`;
      const cx = slots[index].cx + dx;
      const cy = slots[index].cy + dy;
      let toIndex = 0;
      for (let i = 0; i < slots.length; i++) {
        if (i === index) continue;
        const s = slots[i];
        const tol = s.h * 0.5;
        if (s.cy < cy - tol || (Math.abs(s.cy - cy) <= tol && s.cx < cx)) toIndex++;
      }
      const next = ids.filter((x) => x !== itemId);
      next.splice(toIndex, 0, itemId);
      if (next.join("\u0001") !== curOrder.join("\u0001")) {
        curOrder = next;
        applyShift(next);
      }
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      dragCleanupRef.current = null;
    }

    function onUp() {
      cleanup();
      const changed = moved && curOrder.join("\u0001") !== ids.join("\u0001");
      suppressClick.current = changed;
      flushSync(() => {
        if (changed) setOrder(curOrder);
      });
      for (const iid of ids) {
        const el = itemElsRef.current.get(iid);
        if (!el) continue;
        el.style.transition = "";
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.boxShadow = "";
        el.style.willChange = "";
      }
      if (changed && list) {
        reorderListItems(list.id, curOrder);
      }
    }

    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  if (!list) return null;

  return (
    <section className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} strokeWidth={2.2} />
        {t("Back to lists")}
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] font-medium leading-[1.05] text-ink">
            {list.name}
          </h1>
          <p className="text-[12.5px] text-ink-muted">
            {t("{n} / {max} items", { n: list.items.length, max: MAX_ITEMS })}
            {list.updatedAt > 0 &&
              ` · ${t("Updated {when}", { when: relativeTime(list.updatedAt) })}`}
          </p>
        </div>
        <ListSettingsMenu list={list} onDeleted={onBack} />
      </div>

      <AddTitleSearch list={list} />

      {orderedItems.length === 0 ? (
        <EmptyList />
      ) : (
        <Grid>
          {orderedItems.map((it, index) => (
            <div
              key={it.id}
              ref={(el) => {
                if (el) itemElsRef.current.set(it.id, el);
                else itemElsRef.current.delete(it.id);
              }}
              onPointerDown={(e) => startItemDrag(e, it.id, index)}
              onClickCapture={(e) => {
                if (suppressClick.current) {
                  e.stopPropagation();
                  e.preventDefault();
                  suppressClick.current = false;
                }
              }}
              className={`group/item relative touch-none rounded-lg transition-[opacity,box-shadow] ${
                dragCleanupRef.current ? "opacity-40 cursor-grabbing" : "cursor-grab"
              }`}
            >
              <PickCard meta={itemToMeta(it)} />
              <button
                type="button"
                aria-label={t("Remove from list")}
                onClick={() => removeFromList(list.id, it.id)}
                className="absolute end-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/85 text-ink opacity-0 ring-1 ring-edge-soft/70 backdrop-blur-sm transition-opacity hover:bg-canvas hover:text-danger group-hover/item:opacity-100 focus:opacity-100"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </Grid>
      )}
    </section>
  );
}

function EmptyList() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <Layers size={26} strokeWidth={1.6} className="text-ink-subtle" />
      <h2 className="text-[15px] font-semibold text-ink">{t("Nothing here yet")}</h2>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
        {t('Add titles with the search above, or hit "Add to list" on any movie or show\'s page.')}
      </p>
    </div>
  );
}
