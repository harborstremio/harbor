import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";

export type DockSpot = { x: number; y: number };
type Spot = DockSpot;

const EDGE = 8;
let held: Spot | null = null;

function clamp(spot: Spot, box: DOMRect): Spot {
  return {
    x: Math.min(Math.max(EDGE, spot.x), Math.max(EDGE, window.innerWidth - box.width - EDGE)),
    y: Math.min(Math.max(EDGE, spot.y), Math.max(EDGE, window.innerHeight - box.height - EDGE)),
  };
}

export function useDockDrag(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  onPositionChange?: () => void,
  prepareMove?: (spot: Spot, commit: () => void) => boolean,
) {
  const [spot, setSpot] = useState<Spot | null>(held);
  const grab = useRef<(Spot & { pointerId: number }) | null>(null);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  useLayoutEffect(() => { if (enabled) onPositionChange?.(); }, [enabled, spot, onPositionChange]);
  useLayoutEffect(() => () => {
    generation.current += 1;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    grab.current = null;
  }, [enabled]);
  const move = useCallback((next: Spot) => {
    const currentGeneration = generation.current;
    const commit = () => {
      if (!root.current || generation.current !== currentGeneration) return;
      Object.assign(root.current.style, { left: `${next.x}px`, right: "auto", top: `${next.y}px`, bottom: "auto" });
      onPositionChange?.();
      if (!grab.current) setSpot(next);
    };
    if (!prepareMove?.(next, commit)) commit();
  }, [root, onPositionChange, prepareMove]);
  useEffect(() => {
    if (!enabled) return;
    const element = root.current;
    const fit = () => {
      const box = element?.getBoundingClientRect();
      if (!box || !held || grab.current) return;
      const next = clamp(held, box);
      if (next.x === held.x && next.y === held.y) return;
      held = next;
      setSpot(next);
    };
    const observer = element ? new ResizeObserver(fit) : null;
    if (element && observer) observer.observe(element);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [enabled, root]);
  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button, a, input, iframe")) return;
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      event.preventDefault();
      grab.current = { x: event.clientX - box.left, y: event.clientY - box.top, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled, root],
  );
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const hold = grab.current;
      const box = root.current?.getBoundingClientRect();
      if (!enabled || !hold || hold.pointerId !== event.pointerId || !box) return;
      event.preventDefault();
      held = clamp({ x: event.clientX - hold.x, y: event.clientY - hold.y }, box);
      // Move once per frame without rerendering the entire playback tree on every pointer event.
      if (frame.current === null) frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (!root.current || !held) return;
        move(held);
      });
    },
    [enabled, root, move],
  );
  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (grab.current?.pointerId !== event.pointerId) return;
    grab.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (held) move(held);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }, [move]);
  const style: CSSProperties | undefined =
    enabled && spot
      ? { left: `${spot.x}px`, right: "auto", top: `${spot.y}px`, bottom: "auto" }
      : undefined;
  return {
    style,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture: onPointerUp },
  };
}
