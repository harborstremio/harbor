const MAX_DISTANCE = 2.5;
const affectedItems = new WeakMap<HTMLElement, Set<HTMLElement>>();

function resetItem(element: HTMLElement): void {
  element.style.transform = "translate3d(0, 0, 0) scale(1)";
  element.style.zIndex = "";
  element.style.willChange = "";
  element.style.transition = "transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1)";
}

export function resetPosterDock(track: HTMLElement): void {
  for (const element of affectedItems.get(track) ?? []) {
    resetItem(element);
  }
  affectedItems.delete(track);
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
    ? track.scrollWidth - (viewportX + scrollPosition)
    : viewportX + scrollPosition;
  const activeIndex = (contentX - cellWidth / 2) / stride;

  const nextItems = new Set<HTMLElement>();
  const previousItems = affectedItems.get(track);
  const firstIndex = Math.max(0, Math.ceil(activeIndex - MAX_DISTANCE));
  const lastIndex = Math.min(track.children.length - 1, Math.floor(activeIndex + MAX_DISTANCE));

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const element = track.children[index] as HTMLElement;
    const influence = Math.max(0, 1 - Math.abs(index - activeIndex) / MAX_DISTANCE);
    if (influence <= 0) continue;
    nextItems.add(element);
    if (!previousItems?.has(element)) {
      element.style.willChange = "transform";
      element.style.transition = "transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1)";
    }
    element.style.transform = `translate3d(0, ${-influence * 6}px, 0) scale(${1 + influence * 0.1})`;
    element.style.zIndex = String(Math.round(10 + influence * 90));
  }

  for (const element of previousItems ?? []) {
    if (!nextItems.has(element)) resetItem(element);
  }
  affectedItems.set(track, nextItems);
}
