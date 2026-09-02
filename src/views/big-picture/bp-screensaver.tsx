import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLiveGamepad } from "@/lib/gamepad/live";
import { useSettings } from "@/lib/settings";
import { useBpScreensaver } from "./use-bp-screensaver";

const AmbientOverlay = lazy(() =>
  import("@/components/screensaver/ambient-overlay").then((m) => ({ default: m.AmbientOverlay })),
);

const EXIT_MS = 460;
const SETTLE_MS = 1200;
const SWALLOW = ["keydown", "pointerdown", "click", "wheel", "touchstart"];
const DIM = "[data-bp-root]{visibility:hidden}";

function BpGamepadWake({ onWake }: { onWake: () => void }) {
  const live = useLiveGamepad();
  const { settings } = useSettings();
  const wakeRef = useRef(onWake);
  wakeRef.current = onWake;
  const dz = Math.max(0.05, settings.controllerDeadzone);

  useEffect(() => {
    const pressed = Object.values(live.buttons).some(Boolean);
    // Stick drift streams axis updates forever, so it must not hold off the saver.
    const moved = Object.values(live.axes).some((v) => Math.abs(v) >= dz);
    if (pressed || moved) wakeRef.current();
  }, [live, dz]);

  return null;
}

export function BpScreensaver({ blocked }: { blocked: boolean }) {
  const { active, items, wake } = useBpScreensaver(blocked);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const show = active && items.length > 0;

  const reduce = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (show) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [show]);

  useEffect(() => {
    if (!visible) return;
    // Parking focus on the overlay stops a controller Select, which clicks
    // document.activeElement directly, from firing a tile nobody can see.
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.focus({ preventScroll: true });
    const dim = document.createElement("style");
    dim.textContent = DIM;
    const settle = window.setTimeout(() => document.head.appendChild(dim), SETTLE_MS);
    return () => {
      window.clearTimeout(settle);
      dim.remove();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      wake();
    };
    // wheel and touchstart on window are passive by default, which would make
    // preventDefault a no-op and let the page scroll under the saver.
    for (const ev of SWALLOW) {
      window.addEventListener(ev, swallow, { capture: true, passive: false });
    }
    return () => {
      for (const ev of SWALLOW) window.removeEventListener(ev, swallow, true);
    };
  }, [visible, wake]);

  return (
    <>
      <BpGamepadWake onWake={wake} />
      {mounted &&
        createPortal(
          <div
            ref={rootRef}
            tabIndex={-1}
            data-bp-overlay={visible ? "true" : undefined}
            className="fixed inset-0 z-[980] outline-none"
            style={{ pointerEvents: visible ? "auto" : "none" }}
          >
            <Suspense fallback={null}>
              <AmbientOverlay
                items={items}
                reduce={reduce}
                visible={visible}
                onDismiss={wake}
                neverDeep
              />
            </Suspense>
          </div>,
          document.body,
        )}
    </>
  );
}
