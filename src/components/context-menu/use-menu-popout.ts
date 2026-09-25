import { useLayoutEffect, useRef, type RefObject } from "react";
import { createMenuPopout } from "./menu-popout";
import "./menu-popout.css";

export function useMenuPopout(
  ref: RefObject<HTMLElement | null>,
  {
    enabled,
    ready,
    closing,
    getOrigin,
    onExitComplete,
  }: {
    enabled: boolean;
    ready: boolean;
    closing: boolean;
    getOrigin?: () => { x: number; y: number } | undefined;
    onExitComplete?: () => void;
  },
) {
  const controller = useRef<ReturnType<typeof createMenuPopout> | null>(null);
  const exitComplete = useRef(onExitComplete);
  exitComplete.current = onExitComplete;
  const origin = useRef(getOrigin);
  origin.current = getOrigin;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !ready || !element) return;
    controller.current ??= createMenuPopout(element);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      controller.current?.update({
        closing,
        reducedMotion: preference.matches,
        origin: origin.current?.(),
        onExitComplete: () => exitComplete.current?.(),
      });
    update();
    preference.addEventListener?.("change", update);
    return () => preference.removeEventListener?.("change", update);
  }, [ref, enabled, ready, closing]);
  useLayoutEffect(() => {
    if (!ready) {
      controller.current?.dispose();
      controller.current = null;
    }
  }, [ready]);
  useLayoutEffect(
    () => () => {
      controller.current?.dispose();
      controller.current = null;
    },
    [],
  );
}
