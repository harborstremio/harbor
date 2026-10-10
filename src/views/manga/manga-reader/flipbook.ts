export type FlipPage = {
  _setAngle?: (deg: number) => void;
  angle?: number;
  dragging?: boolean;
};

export type FlipBookView = {
  onSwipe?: (
    target: unknown,
    phase: string,
    deltaX: number,
    deltaY: number,
    dist: number,
    touches: number,
  ) => void;
  wrapperW?: number;
  isZoomed?: () => boolean;
  getRightPage?: () => FlipPage | null | undefined;
  getLeftPage?: () => FlipPage | null | undefined;
  _start?: (target?: unknown) => void;
  _move?: (target: unknown, deltaX: number, deltaY: number) => void;
  _end?: (target?: unknown) => void;
};

export type FlipInstance = {
  goToPage?: (n: number, skipAnim?: boolean) => void;
  nextPage?: () => void;
  prevPage?: () => void;
  toggleSound?: (on: boolean) => void;
  zoomTo?: (level: number, time?: number, ev?: unknown) => void;
  getZoomMin?: () => number;
  moveBook?: (dir: "left" | "right" | "up" | "down") => void;
  Book?: FlipBookView;
  dispose?: () => void;
  destroy?: () => void;
};

export type FlipCtor = new (el: HTMLElement, opts: Record<string, unknown>) => FlipInstance;

type FlipMainInstance = { options?: unknown };
type FlipMainProto = {
  pageLoaded?: (this: FlipMainInstance, ...args: Array<unknown>) => unknown;
  __harborPageLoadedGuard?: boolean;
};

export function guardPageLoaded(): void {
  if (typeof window === "undefined") return;
  const proto = (window as unknown as { FLIPBOOK?: { Main?: { prototype?: FlipMainProto } } })
    .FLIPBOOK?.Main?.prototype;
  if (!proto || typeof proto.pageLoaded !== "function" || proto.__harborPageLoadedGuard) return;
  const orig = proto.pageLoaded;
  proto.pageLoaded = function (this: FlipMainInstance, ...args: Array<unknown>): unknown {
    if (!this || this.options == null) return undefined;
    return orig.apply(this, args);
  };
  proto.__harborPageLoadedGuard = true;
}

export function hasNativeZoom(inst: FlipInstance | null): boolean {
  return !!inst && typeof inst.zoomTo === "function";
}

export function fitLevel(inst: FlipInstance): number {
  if (typeof inst.getZoomMin !== "function") return 1;
  try {
    const m = inst.getZoomMin();
    return Number.isFinite(m) && m > 0 ? m : 1;
  } catch {
    return 1;
  }
}

export function nativePan(inst: FlipInstance, dx: number, dy: number): void {
  const view = inst.Book;
  if (!view || typeof view._start !== "function" || typeof view._move !== "function") return;
  if (typeof view.isZoomed === "function" && !view.isZoomed()) return;
  try {
    view._start?.();
    view._move?.(null, dx, dy);
    view._end?.();
  } catch {
    /* noop */
  }
}
