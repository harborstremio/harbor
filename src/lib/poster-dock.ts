const DISTANCE = 190;
const SCALE = 1.12;
const SPREAD = 26;
const LIFT = 7;

const MIN_TRANSITION_MS = 250;
const MAX_TRANSITION_MS = 1500;

const activeItems = new WeakMap<HTMLElement, Set<HTMLElement>>();
const visuals = new WeakMap<HTMLElement, HTMLElement>();
const transitionDurations = new WeakMap<HTMLElement, number>();

function transitionFor(duration: number): string {
  const milliseconds = Number.isFinite(duration)
    ? Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, Math.round(duration)))
    : 760;

  return `transform ${milliseconds}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
}

function getVisual(element: HTMLElement): HTMLElement {
  const cached = visuals.get(element);
  if (cached) return cached;

  const visual = element.querySelector<HTMLElement>("[data-preview-anchor]");
  if (visual) visuals.set(element, visual);

  return visual ?? element;
}

function move(element: HTMLElement, x: number, y: number, scale: number): void {
  element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

function resetItem(element: HTMLElement): void {
  const visual = getVisual(element);
  move(visual, 0, 0, 1);
  element.style.zIndex = "";
  visual.style.willChange = "";
}

export function resetPosterDock(track: HTMLElement): void {
  for (const element of activeItems.get(track) ?? []) {
    resetItem(element);
  }

  activeItems.delete(track);
}

export function updatePosterDock({
  track,
  pointerX,
  cellWidth,
  gap,
  scrollPosition,
  rtl,
  transitionMs,
}: {
  track: HTMLElement;
  pointerX: number;
  cellWidth: number;
  gap: number;
  scrollPosition: number;
  rtl: boolean;
  transitionMs: number;
}): void {
  const rect = track.getBoundingClientRect();
  const stride = cellWidth + gap;

  if (rect.width <= 0 || stride <= 0) return;

  const viewportX = pointerX - rect.left;

  const contentX = rtl
    ? track.scrollWidth - viewportX - scrollPosition
    : viewportX + scrollPosition;

  const activeIndex = (contentX - cellWidth / 2) / stride;
  const range = Math.ceil(DISTANCE / stride);
  const nextItems = new Set<HTMLElement>();
  const previousItems = activeItems.get(track);

  const first = Math.max(0, Math.floor(activeIndex - range));
  const last = Math.min(track.children.length - 1, Math.ceil(activeIndex + range));

  for (let index = first; index <= last; index += 1) {
    const element = track.children[index] as HTMLElement;

    const rawDistance = (activeIndex - index) * stride;
    const pointerDistance = rtl ? -rawDistance : rawDistance;
    const influence = Math.max(0, 1 - Math.abs(pointerDistance) / DISTANCE);

    if (influence === 0) continue;

    const smooth = Math.sin((influence * Math.PI) / 2);
    const normalized = Math.max(-1, Math.min(1, pointerDistance / DISTANCE));

    const scale = 1 + (SCALE - 1) * smooth;
    const x = -normalized * SPREAD * smooth;
    const y = -LIFT * smooth;

    nextItems.add(element);

    const visual = getVisual(element);
    if (!previousItems?.has(element)) {
      visual.style.transformOrigin = "center bottom";
      visual.style.willChange = "transform";
    }
    if (transitionDurations.get(visual) !== transitionMs) {
      visual.style.transition = transitionFor(transitionMs);
      transitionDurations.set(visual, transitionMs);
    }
    element.style.zIndex = String(Math.round(1 + smooth * 99));

    move(visual, x, y, scale);
  }

  for (const element of previousItems ?? []) {
    if (!nextItems.has(element)) resetItem(element);
  }

  activeItems.set(track, nextItems);
}
