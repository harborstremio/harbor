import { mvGeometry, mvVisibility } from "@/lib/multiview/bridge";
import { screenRectForEl } from "@/lib/multiview/geom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, type RefObject } from "react";

type Cells = Map<number, HTMLElement>;

const BURST_MS = 500;

export function useGeomSync(cellsRef: RefObject<Cells>, activeSlots: number[], enabled: boolean) {
  const key = activeSlots.join(",");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const last = new Map<number, string>();

    const tick = async () => {
      const cells = cellsRef.current;
      if (!cells) return;
      for (const slot of activeSlots) {
        const el = cells.get(slot);
        if (!el) continue;
        const r = await screenRectForEl(el);
        if (cancelled || !r) continue;
        const sig = `${r.cssLeft},${r.cssTop},${r.cssWidth},${r.cssHeight},${r.cssViewW},${r.cssViewH}`;
        if (last.get(slot) === sig) continue;
        last.set(slot, sig);
        mvGeometry({ slot, ...r }).catch(() => {});
      }
    };

    const tickSync = () => {
      const cells = cellsRef.current;
      if (!cells) return;
      for (const slot of activeSlots) {
        const el = cells.get(slot);
        if (!el) continue;
        const r = screenRectForEl(el);
        if (!r) continue;
        const sig = `${r.cssLeft},${r.cssTop},${r.cssWidth},${r.cssHeight},${r.cssViewW},${r.cssViewH}`;
        if (last.get(slot) === sig) continue;
        last.set(slot, sig);
        mvGeometry({ slot, ...r }).catch(() => {});
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 250);

    let burstUntil = 0;
    let rafId = 0;
    const burst = () => {
      const now = performance.now();
      burstUntil = now + BURST_MS;
      if (rafId) return;
      const loop = () => {
        if (cancelled) {
          rafId = 0;
          return;
        }
        tickSync();
        if (performance.now() < burstUntil) {
          rafId = requestAnimationFrame(loop);
        } else {
          rafId = 0;
        }
      };
      rafId = requestAnimationFrame(loop);
    };

    const kick = () => {
      last.clear();
      burst();
    };

    let hiddenForDrag = false;
    let restoreTimer = 0;
    const hideForDrag = () => {
      if (hiddenForDrag) return;
      hiddenForDrag = true;
      void mvVisibility(false).catch(() => {});
      window.clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(() => restoreAfterDrag(), 3000);
    };
    const restoreAfterDrag = () => {
      window.clearTimeout(restoreTimer);
      if (!hiddenForDrag) return;
      hiddenForDrag = false;
      last.clear();
      tickSync();
      void mvVisibility(true).catch(() => {});
      burst();
    };
    const onMouseDownNative = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest("[data-tauri-drag-region]")) hideForDrag();
    };

    window.addEventListener("resize", kick);
    window.addEventListener("harbor:mpv-refresh-geom", kick);
    window.addEventListener("pointerdown", kick);
    window.addEventListener("pointerup", restoreAfterDrag);
    document.addEventListener("mousedown", onMouseDownNative, true);

    let unlistenResized: (() => void) | null = null;
    let unlistenMoved: (() => void) | null = null;
    const win = getCurrentWindow();
    void win
      .onResized(() => {
        restoreAfterDrag();
        kick();
      })
      .then((u) => {
        if (cancelled) u();
        else unlistenResized = u;
      });
    void win
      .onMoved(() => {
        restoreAfterDrag();
        kick();
      })
      .then((u) => {
        if (cancelled) u();
        else unlistenMoved = u;
      });

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => burst()) : null;
    if (ro) {
      const cells = cellsRef.current;
      if (cells) {
        for (const el of cells.values()) ro.observe(el);
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(restoreTimer);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", kick);
      window.removeEventListener("harbor:mpv-refresh-geom", kick);
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("pointerup", restoreAfterDrag);
      document.removeEventListener("mousedown", onMouseDownNative, true);
      unlistenResized?.();
      unlistenMoved?.();
      ro?.disconnect();
    };
  }, [enabled, key, cellsRef, activeSlots]);
}
