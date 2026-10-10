import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, Plus, RotateCcw, X } from "lucide-react";
import { TvModalClose } from "@/components/tv-modal-close";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import {
  NAV_ITEMS,
  effectiveNavOrder,
  moveNavItem,
  resetNavCustomization,
  toggleNavHidden,
  type NavItemId,
} from "./nav-items";
import { setNavEditMode, useNavEditMode } from "./nav-edit-mode";

function useNavCfg() {
  const { settings, update } = useSettings();
  return {
    cfg: settings.navCustomization,
    commit: (next: typeof settings.navCustomization) => update({ navCustomization: next }),
  };
}

export function NavHideBadge({ itemId }: { itemId: NavItemId }) {
  const t = useT();
  const { cfg, commit } = useNavCfg();
  return (
    <button
      type="button"
      aria-label={t("Hide this tab")}
      title={t("Hide this tab")}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        commit(toggleNavHidden(cfg, itemId));
      }}
      className="absolute -end-1.5 -top-1.5 z-[200] grid h-6 w-6 place-items-center rounded-full bg-danger text-white shadow ring-1 ring-edge-soft motion-safe:transition-transform motion-safe:active:scale-[0.96]"
    >
      <X size={12} strokeWidth={2.8} />
    </button>
  );
}

export function NavEditableItem({ itemId, children }: { itemId?: NavItemId; children: ReactNode }) {
  const editing = useNavEditMode();
  if (!editing || !itemId) return children;
  return (
    <div data-nav-edit-wrapper className="relative grid">
      {children}
      <NavHideBadge itemId={itemId} />
    </div>
  );
}

type ActiveDrag = {
  fromId: string;
  target: string | null;
  pos: "before" | "after";
  moved: boolean;
  startX: number;
  startY: number;
  pointerId: number;
  w: number;
  h: number;
  ghost: HTMLElement | null;
  reducedMotion: boolean;
};

let activeDrag: ActiveDrag | null = null;
let draggedEl: HTMLElement | null = null;
let cancelActiveDrag: (() => void) | null = null;
const overListeners = new Set<() => void>();

function emitOver(): void {
  for (const l of overListeners) l();
}

function clearInline(el: HTMLElement | null): void {
  if (!el) return;
  el.style.transform = "";
  el.style.zIndex = "";
  el.style.transition = "";
  el.style.boxShadow = "";
  el.style.pointerEvents = "";
  el.style.visibility = "";
  el.style.opacity = "";
}

let shiftedKids: HTMLElement[] = [];

function clearShifts(): void {
  for (const el of shiftedKids) {
    el.style.transform = "";
    el.style.transition = "";
  }
  shiftedKids = [];
}

export function useNavDrag(
  itemId: NavItemId | undefined,
  orientation: "vertical" | "horizontal" = "vertical",
) {
  const { cfg, commit } = useNavCfg();
  const editing = useNavEditMode();
  const cfgRef = useRef(cfg);
  const cleanupDrag = useRef<(() => void) | null>(null);
  cfgRef.current = cfg;
  const [, force] = useState(0);
  useEffect(() => {
    const tick = () => force((n) => n + 1);
    overListeners.add(tick);
    return () => {
      overListeners.delete(tick);
      cleanupDrag.current?.();
    };
  }, []);
  useEffect(() => {
    if (!editing) cleanupDrag.current?.();
  }, [editing]);

  const finish = (commitMove: boolean) => {
    const drag = activeDrag;
    activeDrag = null;
    cancelActiveDrag = null;
    cleanupDrag.current = null;
    drag?.ghost?.remove();
    if (draggedEl) {
      draggedEl.style.display = "";
      const wrapper = draggedEl.closest<HTMLElement>("[data-nav-edit-wrapper]");
      if (wrapper) wrapper.style.display = "";
    }
    clearInline(draggedEl);
    draggedEl = null;
    clearShifts();
    document.body.style.userSelect = "";
    emitOver();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
    if (commitMove && drag && drag.moved && drag.target && drag.target !== drag.fromId) {
      commit(moveNavItem(cfgRef.current, drag.fromId, drag.target, drag.pos));
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        window.removeEventListener("click", swallow, true);
      };
      window.addEventListener("click", swallow, true);
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 50);
    }
  };
  const onMove = (e: PointerEvent) => {
    const drag = activeDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      document.body.style.userSelect = "none";
      if (draggedEl) {
        const scope = draggedEl.closest("nav") ?? draggedEl.parentElement ?? document.body;
        const before = new Map<HTMLElement, number>();
        for (const k of scope.querySelectorAll<HTMLElement>("[data-nav-drop-id]")) {
          const rect = k.getBoundingClientRect();
          before.set(k, orientation === "vertical" ? rect.top : rect.left);
        }
        const r = draggedEl.getBoundingClientRect();
        drag.w = r.width;
        drag.h = r.height;
        const g = draggedEl.cloneNode(true) as HTMLElement;
        g.removeAttribute("id");
        g.setAttribute("aria-hidden", "true");
        g.inert = true;
        g.style.position = "fixed";
        g.style.left = `${r.left}px`;
        g.style.top = `${r.top}px`;
        g.style.width = `${r.width}px`;
        g.style.height = `${r.height}px`;
        g.style.margin = "0";
        g.style.pointerEvents = "none";
        g.style.zIndex = "60";
        g.style.transition = "none";
        document.body.appendChild(g);
        drag.ghost = g;
        draggedEl.style.display = "none";
        const wrapper = draggedEl.closest<HTMLElement>("[data-nav-edit-wrapper]");
        if (wrapper) wrapper.style.display = "none";
        draggedEl.style.pointerEvents = "none";
        for (const k of scope.querySelectorAll<HTMLElement>("[data-nav-drop-id]")) {
          if (k === draggedEl) continue;
          const rect = k.getBoundingClientRect();
          const offset = (before.get(k) ?? 0) - (orientation === "vertical" ? rect.top : rect.left);
          const axis = orientation === "vertical" ? "Y" : "X";
          if (!drag.reducedMotion && Math.abs(offset) > 1) {
            k.animate(
              [
                { transform: `translate${axis}(${offset}px)` },
                { transform: `translate${axis}(0)` },
              ],
              {
                duration: 180,
                easing: "ease-out",
              },
            );
          }
        }
      }
    }
    if (drag.ghost) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      drag.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(${drag.reducedMotion ? 1 : 1.06})`;
      drag.ghost.style.boxShadow = "0 14px 30px -10px rgba(0,0,0,0.55)";
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest?.("[data-nav-drop-id]") as HTMLElement | null;
    const vertical = orientation === "vertical";
    let container: HTMLElement | null =
      cell?.closest("nav") ?? (draggedEl?.parentElement as HTMLElement | null) ?? null;
    const relevant = (scope: HTMLElement | null) =>
      scope
        ? [...scope.querySelectorAll<HTMLElement>("[data-nav-drop-id]")].filter(
            (k) => k !== draggedEl && !k.closest('[aria-hidden="true"]'),
          )
        : [];
    for (let d = 0; d < 5 && container && relevant(container).length < 1; d++) {
      container = container.parentElement;
    }
    const kids = relevant(container);
    const direction =
      !vertical && container && getComputedStyle(container).direction === "rtl" ? -1 : 1;
    const cursor = (vertical ? e.clientY : e.clientX) * direction;
    let idx = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      const mid = (vertical ? r.top + r.height / 2 : r.left + r.width / 2) * direction;
      if (cursor < mid) {
        idx = i;
        break;
      }
    }
    const extent = (vertical ? drag.h : drag.w) + 6;
    const nextShifted: HTMLElement[] = [];
    kids.forEach((k, j) => {
      if (j < idx) {
        if (shiftedKids.includes(k)) {
          k.style.transform = "";
        }
        return;
      }
      k.style.transition = drag.reducedMotion ? "none" : "transform 160ms ease-out";
      k.style.transform = vertical
        ? `translateY(${extent}px)`
        : `translateX(${extent * direction}px)`;
      nextShifted.push(k);
    });
    for (const k of shiftedKids) {
      if (!nextShifted.includes(k)) {
        k.style.transform = "";
      }
    }
    shiftedKids = nextShifted;
    if (idx >= kids.length) {
      const lastKid = kids[kids.length - 1];
      const newTarget = lastKid?.dataset.navDropId ?? null;
      if (drag.target !== newTarget || drag.pos !== "after") {
        drag.target = newTarget;
        drag.pos = "after";
        emitOver();
      }
    } else {
      const newTarget = kids[idx].dataset.navDropId ?? null;
      if (drag.target !== newTarget || drag.pos !== "before") {
        drag.target = newTarget;
        drag.pos = "before";
        emitOver();
      }
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
    finish(true);
  };
  const onCancel = () => finish(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  };

  return {
    over: null as "before" | "after" | null,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (itemId == null || !(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.bottom,
        }),
      );
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (!editing || itemId == null) return;
      if (e.button !== 0) return;
      cancelActiveDrag?.();
      activeDrag = {
        fromId: itemId,
        target: null,
        pos: "before",
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        w: 0,
        h: 0,
        ghost: null,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
      cleanupDrag.current = () => finish(false);
      cancelActiveDrag = cleanupDrag.current;
      draggedEl = e.currentTarget as HTMLElement;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
    },
  };
}

export function navNeighbors(
  cfg: { order: string[] },
  itemId: string,
): { prev: string | null; next: string | null } {
  const order = effectiveNavOrder({ order: cfg.order, hidden: [], renamed: {} });
  const i = order.indexOf(itemId as NavItemId);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? order[i - 1] : null, next: i < order.length - 1 ? order[i + 1] : null };
}

export function NavEditClose() {
  const t = useT();
  const closeEditing = () => {
    if (cancelActiveDrag) cancelActiveDrag();
    else setNavEditMode(false);
  };
  return <TvModalClose onClose={closeEditing} label={t("Done editing")} />;
}

export function NavHiddenTray({
  orientation = "vertical",
  compact = false,
}: {
  orientation?: "vertical" | "horizontal";
  compact?: boolean;
}) {
  const t = useT();
  const editing = useNavEditMode();
  const { cfg, commit } = useNavCfg();
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavEditMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);
  if (!editing) return null;
  const byId = new Map(NAV_ITEMS.map((it) => [it.id, it]));
  const hidden = cfg.hidden.map((id) => byId.get(id as NavItemId)).filter((it) => it != null);
  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge-soft bg-canvas/40 p-1.5">
        <NavEditClose />
        {hidden.map((it) => (
          <button
            key={it!.id}
            type="button"
            onClick={() => commit(toggleNavHidden(cfg, it!.id))}
            title={`${t(it!.label)} — ${t("Show this tab")}`}
            aria-label={`${t(it!.label)} — ${t("Show this tab")}`}
            className="relative grid h-9 w-9 place-items-center rounded-full text-ink ring-1 ring-edge-soft transition-colors hover:bg-elevated"
          >
            <span className="[&_svg]:h-[18px] [&_svg]:w-[18px]">{it!.render(false)}</span>
            <Plus
              size={11}
              strokeWidth={3}
              className="absolute -bottom-0.5 -end-0.5 rounded-full bg-accent text-canvas"
            />
          </button>
        ))}
        {hidden.length > 0 && (
          <button
            type="button"
            onClick={() => commit({ ...cfg, hidden: [] })}
            title={t("Show all")}
            aria-label={t("Show all")}
            className="grid h-9 w-9 place-items-center rounded-full text-accent ring-1 ring-edge-soft transition-colors hover:bg-elevated"
          >
            <Eye size={15} strokeWidth={2.2} />
          </button>
        )}
        <button
          type="button"
          onClick={() => commit(resetNavCustomization())}
          title={t("Reset layout")}
          aria-label={t("Reset layout")}
          className="grid h-9 w-9 place-items-center rounded-full text-ink-subtle ring-1 ring-edge-soft transition-colors hover:bg-elevated hover:text-ink"
        >
          <RotateCcw size={15} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => setNavEditMode(false)}
          className="rounded-lg px-2 py-1.5 text-[12px] text-ink hover:bg-elevated"
        >
          {t("Done editing")}
        </button>
      </div>
    );
  }
  return (
    <div
      className={
        orientation === "vertical"
          ? "flex flex-col gap-1 rounded-xl border border-edge-soft bg-surface p-2 shadow-lg"
          : "flex flex-wrap items-center gap-1.5 rounded-xl border border-edge-soft bg-surface px-2.5 py-2 shadow-lg"
      }
    >
      <NavEditClose />
      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {t("Hidden")}
      </span>
      {hidden.length === 0 && (
        <span className="px-1 text-[12px] text-ink-muted">{t("Nothing hidden.")}</span>
      )}
      {hidden.map((it) => (
        <button
          key={it!.id}
          type="button"
          onClick={() => commit(toggleNavHidden(cfg, it!.id))}
          title={t("Show this tab")}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] text-ink transition-colors hover:bg-elevated ${
            orientation === "vertical" ? "w-full" : ""
          }`}
        >
          <Plus size={14} strokeWidth={2.4} className="shrink-0 text-accent" />
          <span className="truncate">{t(it!.label)}</span>
        </button>
      ))}
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => commit({ ...cfg, hidden: [] })}
          className="flex items-center gap-2 px-2 py-1 text-start text-[12px] font-medium text-accent hover:underline"
        >
          <Eye size={13} strokeWidth={2.2} />
          {t("Show all")}
        </button>
      )}
      <button
        type="button"
        onClick={() => commit(resetNavCustomization())}
        className="flex items-center gap-2 px-2 py-1 text-start text-[12px] font-medium text-ink-muted hover:text-ink hover:underline"
      >
        <RotateCcw size={13} strokeWidth={2.2} />
        {t("Reset layout")}
      </button>
      <button
        type="button"
        onClick={() => setNavEditMode(false)}
        className="rounded-lg px-2 py-1.5 text-start text-[12px] text-ink hover:bg-elevated"
      >
        {t("Done editing")}
      </button>
    </div>
  );
}
