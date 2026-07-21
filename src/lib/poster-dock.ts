import { animate } from "motion";

const DISTANCE = 190;
const SCALE = 1.12;
const SPREAD = 26;
const LIFT = 7;

const SPRING = {
  type: "spring",
  mass: 0.1,
  stiffness: 100,
  damping: 20,
} as const;

const activeItems = new WeakMap<HTMLElement, Set<HTMLElement>>();
const animations = new WeakMap<HTMLElement, ReturnType<typeof animate>>();

function move(element: HTMLElement, x: number, y: number, scale: number): void {
  animations.get(element)?.stop();

  animations.set(element, animate(element, { x, y, scale }, SPRING));
}

function resetItem(element: HTMLElement): void {
  move(element, 0, 0, 1);
  element.style.zIndex = "";
  element.style.willChange = "";
}

export function resetPosterDock(track: HTMLElement): void {
  for (const child of track.children) {
    resetItem(child as HTMLElement);
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
}: {
  track: HTMLElement;
  pointerX: number;
  cellWidth: number;
  gap: number;
  scrollPosition: number;
  rtl: boolean;
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

    element.style.transformOrigin = "center bottom";
    element.style.willChange = "transform";
    element.style.zIndex = String(Math.round(1 + smooth * 99));

    move(element, x, y, scale);
  }

  for (const element of activeItems.get(track) ?? []) {
    if (!nextItems.has(element)) resetItem(element);
  }

  activeItems.set(track, nextItems);
}
