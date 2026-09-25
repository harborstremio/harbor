type Bounds = { left: number; top: number; width: number; height: number };
type Anchor = { left: number; right: number; top: number; bottom: number };
type Origin = { x: number; y: number };

const CONTRACTED_SCALE = "scale(0.92)";

/** Changing origin during a transition must preserve its currently painted matrix. */
export function retargetOriginTransform(transform: string, previous: Origin, next: Origin) {
  const match = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!match) return transform;
  const values = match[1].split(",").map(Number);
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) return transform;
  const [a, b, c, d, x, y] = values;
  const dx = previous.x - next.x;
  const dy = previous.y - next.y;
  return `matrix(${a}, ${b}, ${c}, ${d}, ${x + (1 - a) * dx - c * dy}, ${y - b * dx + (1 - d) * dy})`;
}

/** Recover layout geometry without inheriting the parent surface's visual scale. */
export function settledMenuAnchor(row: Anchor, visual: Bounds, settled: Bounds): Anchor {
  const scaleX = visual.width / settled.width;
  const scaleY = visual.height / settled.height;
  if (!(scaleX > 0 && scaleY > 0 && Number.isFinite(scaleX + scaleY))) return row;
  return {
    left: settled.left + (row.left - visual.left) / scaleX,
    right: settled.left + (row.right - visual.left) / scaleX,
    top: settled.top + (row.top - visual.top) / scaleY,
    bottom: settled.top + (row.bottom - visual.top) / scaleY,
  };
}

export function popoutOvershoot(
  bounds: Bounds,
  origin: { x: number; y: number },
  viewport: { width: number; height: number },
) {
  const x = (bounds.width * origin.x) / 100;
  const y = (bounds.height * origin.y) / 100;
  let extra = 0.006;
  for (const [distance, clearance] of [
    [x, bounds.left],
    [bounds.width - x, viewport.width - bounds.left - bounds.width],
    [y, bounds.top],
    [bounds.height - y, viewport.height - bounds.top - bounds.height],
  ]) {
    if (distance > 0) extra = Math.min(extra, Math.max(0, clearance) / distance);
  }
  return 1 + extra;
}

type MotionState = {
  closing: boolean;
  reducedMotion: boolean;
  origin?: Origin;
  onExitComplete?: () => void;
};

/** One controller per mounted surface; interruption samples before cancelling. */
export function createMenuPopout(element: HTMLElement) {
  const view = element.ownerDocument.defaultView!;
  const previous = {
    transform: element.style.transform,
    opacity: element.style.opacity,
    willChange: element.style.willChange,
    transformOrigin: element.style.transformOrigin,
  };
  let animation: Animation | null = null;
  let fallback: number | undefined;
  let generation = 0;
  let initialized = false;
  const cancel = () => {
    view.clearTimeout(fallback);
    fallback = undefined;
    if (animation) {
      animation.onfinish = null;
      animation.cancel();
      animation = null;
    }
  };
  return {
    update({ closing, reducedMotion, origin, onExitComplete }: MotionState) {
      const token = ++generation;
      const computed = view.getComputedStyle(element);
      const from = {
        transform: initialized ? computed.transform || "none" : CONTRACTED_SCALE,
        opacity: initialized ? Number(computed.opacity || 1) : 0.18,
      };
      if (origin) {
        const [oldX, oldY] = computed.transformOrigin.split(" ").map(Number.parseFloat);
        element.style.transformOrigin = `${origin.x}% ${origin.y}%`;
        const [newX, newY] = view
          .getComputedStyle(element)
          .transformOrigin.split(" ")
          .map(Number.parseFloat);
        if (initialized && [oldX, oldY, newX, newY].every(Number.isFinite))
          from.transform = retargetOriginTransform(
            from.transform,
            { x: oldX, y: oldY },
            { x: newX, y: newY },
          );
      }
      cancel();
      initialized = true;
      let finished = false;
      const finish = () => {
        if (generation !== token || finished) return;
        finished = true;
        element.style.transform = closing && !reducedMotion ? CONTRACTED_SCALE : "none";
        element.style.opacity = closing ? "0" : "1";
        element.style.willChange = previous.willChange;
        cancel();
        if (closing) onExitComplete?.();
      };
      if (reducedMotion || typeof element.animate !== "function") {
        element.style.transform = "none";
        element.style.opacity = closing ? "0" : "1";
        // Defer disposal until sibling layout effects have seen logical closing.
        if (closing) queueMicrotask(finish);
        else element.style.willChange = previous.willChange;
        return;
      }
      const owner = element.parentElement!;
      const targetOrigin = origin ?? {
        x: Number.parseFloat(computed.getPropertyValue("--context-menu-reveal-x")) || 0,
        y: Number.parseFloat(computed.getPropertyValue("--context-menu-reveal-origin")) || 0,
      };
      const peak = popoutOvershoot(owner.getBoundingClientRect(), targetOrigin, {
        width: view.visualViewport?.width ?? view.innerWidth,
        height: view.visualViewport?.height ?? view.innerHeight,
      });
      const frames: Keyframe[] = closing
        ? [from, { transform: CONTRACTED_SCALE, opacity: 0 }]
        : [
            { ...from, offset: 0, easing: "cubic-bezier(0.18, 0.8, 0.24, 1)" },
            {
              transform: `scale(${peak})`,
              opacity: 1,
              offset: 0.72,
              easing: "cubic-bezier(0.25, 1, 0.5, 1)",
            },
            { transform: "scale(1)", opacity: 1, offset: 1 },
          ];
      const duration = closing ? 120 : 220;
      element.style.transform = from.transform;
      element.style.opacity = String(from.opacity);
      element.style.willChange = "transform, opacity";
      animation = element.animate(frames, {
        duration,
        easing: closing ? "cubic-bezier(0.22, 0.65, 0.3, 1)" : "linear",
        fill: "both",
      });
      animation.onfinish = finish;
      // Background/older WebViews may omit finish dispatch; never retain a ghost.
      fallback = view.setTimeout(finish, duration + 80);
    },
    dispose() {
      generation++;
      cancel();
      Object.assign(element.style, previous);
    },
  };
}
