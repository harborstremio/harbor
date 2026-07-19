import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { resetPosterDock as resetPosterDockItems, updatePosterDock } from "@/lib/poster-dock";
import { useView } from "@/lib/view";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

const GAP = 20;
const EAGER_COUNT = 6;
const NEAR_MARGIN = "300px";

function isRtlTrack(el: HTMLDivElement): boolean {
  return getComputedStyle(el).direction === "rtl";
}

function readPos(el: HTMLDivElement): number {
  return isRtlTrack(el) ? -el.scrollLeft : el.scrollLeft;
}

function writePos(el: HTMLDivElement, pos: number): void {
  el.scrollLeft = isRtlTrack(el) ? -pos : pos;
}

export type RowShape = "portrait" | "landscape" | "service" | "rank" | "tile";

const RowTrackContext = createContext<HTMLDivElement | null>(null);
export const ScrollRootContext = createContext<HTMLElement | null>(null);

function LazyChild({
  children,
  eager,
  shape,
  span,
}: {
  children: ReactNode;
  eager: boolean;
  shape: RowShape;
  span?: string;
}) {
  const root = useContext(RowTrackContext);
  const [visible, setVisible] = useState(eager);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) return;
    if (!root) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true);
      },
      { root, rootMargin: NEAR_MARGIN },
    );
    io.observe(el);
    const recheck = window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const near = 300;
      const within =
        rect.right > rr.left - near &&
        rect.left < rr.right + near &&
        rect.bottom > rr.top - near &&
        rect.top < rr.bottom + near;
      if (within) setVisible(true);
    }, 400);
    return () => {
      io.disconnect();
      window.clearTimeout(recheck);
    };
  }, [root, visible]);

  return (
    <div
      ref={ref}
      style={{
        ...(span ? { gridColumn: span } : undefined),
        contentVisibility: visible ? "visible" : "auto",
        containIntrinsicSize: visible ? undefined : "auto 200px",
      }}
    >
      {visible ? children : <Skeleton shape={shape} />}
    </div>
  );
}

function Skeleton({ shape }: { shape: RowShape }) {
  const { settings } = useSettings();
  if (shape === "service") {
    return <div className="h-20 w-full rounded-xl bg-elevated/40" />;
  }
  if (shape === "rank") {
    return <div className="aspect-[228/268] w-full rounded-xl bg-elevated/30" />;
  }
  if (shape === "tile") {
    return <div className="aspect-[5/4] w-full rounded-2xl bg-elevated/30" />;
  }
  const aspect = shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]";
  const hideText = shape === "portrait" && settings.hidePosterTitles;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div className={`${aspect} rounded-xl bg-elevated/40`} />
      {!hideText && (
        <div className={`flex flex-col gap-1.5 ${shape === "landscape" ? "" : "h-9"}`}>
          <div className="h-3 w-3/5 rounded bg-elevated/35" />
          <div className="h-3 w-2/5 rounded bg-elevated/25" />
        </div>
      )}
    </div>
  );
}

export function Row({
  title,
  titleExtra,
  className = "",
  min = 144,
  shape = "portrait",
  scrollKey,
  arrowsAlways = false,
  children,
  onEndReached,
  onViewAll,
  viewAllLabel = "View all",
  headerRight,
  titleClassName = "text-ink",
  titleScale = 1,
}: {
  title?: React.ReactNode;
  titleExtra?: React.ReactNode;
  className?: string;
  min?: number;
  shape?: RowShape;
  alwaysActive?: boolean;
  arrowsAlways?: boolean;
  scrollKey?: string;
  children: React.ReactNode;
  onEndReached?: () => void;
  onViewAll?: () => void;
  viewAllLabel?: string;
  headerRight?: React.ReactNode;
  titleClassName?: string;
  titleScale?: number;
}) {
  const { settings } = useSettings();
  const t = useT();
  const effMin = Math.max(72, Math.round(min * settings.posterScale));
  const dockEnabled = shape === "portrait" && settings.posterDockMagnification;
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const trackCb = useCallback((el: HTMLDivElement | null) => {
    trackRef.current = el;
    setTrackEl(el);
  }, []);
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const onEndRef = useRef(onEndReached);
  useEffect(() => {
    onEndRef.current = onEndReached;
  });

  const measure = () => {
    const container = containerRef.current;
    if (!container) return;
    const available = container.clientWidth;
    if (available <= 0) return;
    const fits = Math.max(1, Math.floor((available + GAP) / (effMin + GAP)));
    setCellWidth((available - (fits - 1) * GAP) / fits);
  };

  const measureScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const pos = readPos(el);
    setCanPrev(pos > 1);
    const remaining = el.scrollWidth - el.clientWidth - pos;
    setCanNext(remaining > 1);
    if (el.clientWidth > 0 && remaining < 800) onEndRef.current?.();
  };

  // Keep native CSS grid rails — horizontal virtualization made posters look
  // mid-scrolled / misaligned. LazyChild + IO is enough for row-sized lists.
  const items = useMemo(() => Children.toArray(children), [children]);
  const childCount = items.length;

  const userInteractedRef = useRef(false);
  const { rememberRowScroll } = useView();
  useLayoutEffect(() => {
    measure();
    // Always pin rails to the first poster unless the user scrolled this session.
    // Restoring saved scrollLeft made every page open mid-row ("posters scrolled").
    if (trackEl && cellWidth != null && childCount > 0 && !userInteractedRef.current) {
      if (readPos(trackEl) !== 0) writePos(trackEl, 0);
    }
    measureScroll();
  }, [children, childCount, cellWidth, trackEl, effMin]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    let roRaf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (roRaf != null) return;
      roRaf = requestAnimationFrame(() => {
        roRaf = null;
        measure();
        measureScroll();
      });
    });
    ro.observe(container);
    ro.observe(track);
    let saveTimer: number | null = null;
    let scrollRaf: number | null = null;
    const onScroll = () => {
      if (scrollRaf == null) {
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = null;
          measureScroll();
        });
      }
      if (!scrollKey) return;
      if (saveTimer != null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        rememberRowScroll(scrollKey, readPos(track));
      }, 200);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    const markInteracted = () => {
      userInteractedRef.current = true;
    };
    let wheelSettle: number | null = null;
    const onWheel = (e: WheelEvent) => {
      userInteractedRef.current = true;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (rafId.current != null && Math.abs(e.deltaX) < 4) return;
      cancelGlide();
      track.style.scrollSnapType = "none";
      track.style.scrollBehavior = "auto";
      if (wheelSettle != null) window.clearTimeout(wheelSettle);
      wheelSettle = window.setTimeout(() => {
        wheelSettle = null;
        const stride = strideRef.current;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0 || stride <= 0) {
          track.style.scrollSnapType = "";
          track.style.scrollBehavior = "";
          return;
        }
        const pos = readPos(track);
        const aligned = Math.max(0, Math.min(Math.round(pos / stride) * stride, max));
        const target = max - pos < stride * 0.5 ? max : aligned;
        glideTo(track, target, true);
      }, 200);
    };
    track.addEventListener("wheel", onWheel, { passive: true });
    track.addEventListener("pointerdown", markInteracted);
    track.addEventListener("keydown", markInteracted);
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<{ prefix?: string }>).detail;
      if (!scrollKey) return;
      // Empty/missing prefix = reset every rail (nav change). Otherwise match prefix.
      if (detail?.prefix && !scrollKey.startsWith(detail.prefix)) return;
      if (saveTimer != null) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      writePos(track, 0);
      userInteractedRef.current = false;
      measureScroll();
    };
    window.addEventListener("harbor:reset-row-scrolls", onReset);
    return () => {
      ro.disconnect();
      if (roRaf != null) cancelAnimationFrame(roRaf);
      if (scrollRaf != null) cancelAnimationFrame(scrollRaf);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("pointerdown", markInteracted);
      track.removeEventListener("keydown", markInteracted);
      window.removeEventListener("harbor:reset-row-scrolls", onReset);
      if (saveTimer != null) window.clearTimeout(saveTimer);
      if (wheelSettle != null) window.clearTimeout(wheelSettle);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (scrollKey && readPos(track) > 0) {
        rememberRowScroll(scrollKey, readPos(track));
      }
    };
  }, [scrollKey, rememberRowScroll]);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    userInteractedRef.current = true;
    const delta = (isRtlTrack(el) ? -dir : dir) * el.clientWidth;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startScroll: 0,
    pointerId: -1,
    lastX: 0,
    lastT: 0,
    vel: 0,
  });
  const rafId = useRef<number | null>(null);
  const strideRef = useRef(effMin + GAP);
  strideRef.current = (cellWidth ?? effMin) + GAP;
  const dockFrameRef = useRef<number | null>(null);
  const dockPointerXRef = useRef<number | null>(null);

  const resetPosterDock = useCallback(() => {
    const track = trackRef.current;
    if (track) resetPosterDockItems(track);
  }, []);

  const applyPosterDock = useCallback(() => {
    dockFrameRef.current = null;
    const track = trackRef.current;
    const pointerX = dockPointerXRef.current;
    if (!dockEnabled || !track || pointerX === null) {
      resetPosterDock();
      return;
    }

    updatePosterDock({
      track,
      pointerX,
      cellWidth: cellWidth ?? effMin,
      gap: GAP,
      scrollPosition: readPos(track),
      rtl: isRtlTrack(track),
    });
  }, [cellWidth, dockEnabled, effMin, resetPosterDock]);

  const schedulePosterDock = useCallback(
    (clientX: number) => {
      dockPointerXRef.current = clientX;
      if (dockFrameRef.current === null) {
        dockFrameRef.current = requestAnimationFrame(applyPosterDock);
      }
    },
    [applyPosterDock],
  );

  useEffect(
    () => () => {
      if (dockFrameRef.current !== null) cancelAnimationFrame(dockFrameRef.current);
      resetPosterDock();
    },
    [resetPosterDock],
  );

  useEffect(() => {
    if (!dockEnabled) resetPosterDock();
  }, [dockEnabled, resetPosterDock]);

  const cancelGlide = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  const glideTo = (el: HTMLDivElement, target: number, snappy = false) => {
    const rtl = isRtlTrack(el);
    const start = rtl ? -el.scrollLeft : el.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
      return;
    }
    const startTime = performance.now();
    const duration = snappy
      ? Math.max(140, Math.min(300, Math.abs(distance) * 0.9))
      : Math.max(280, Math.min(620, 260 + Math.abs(distance) * 0.45));
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + distance * eased;
      el.scrollLeft = rtl ? -next : next;
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
      }
    };
    rafId.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dockPointerXRef.current = null;
    resetPosterDock();
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (!(e.target as Element).closest("button")) return;
    const el = trackRef.current;
    if (!el) return;
    cancelGlide();
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    if (dockEnabled && e.pointerType !== "touch" && e.buttons === 0 && !d.active) {
      schedulePosterDock(e.clientX);
    }
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      try {
        el.setPointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const instant = (e.clientX - d.lastX) / dt;
      d.vel = d.vel * 0.55 + instant * 0.45;
    }
    d.lastX = e.clientX;
    d.lastT = now;
    el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    d.active = false;
    if (!d.moved || !el) {
      setTimeout(() => {
        drag.current.moved = false;
      }, 0);
      return;
    }
    try {
      if (e) el.releasePointerCapture(d.pointerId);
    } catch {
      /* ignore */
    }

    const friction = 0.004;
    const v = d.vel;
    const projection = -((v * Math.abs(v)) / (2 * friction));
    const projectedRaw = el.scrollLeft + projection;
    const projected = isRtlTrack(el) ? -projectedRaw : projectedRaw;
    const stride = (cellWidth ?? effMin) + GAP;
    const max = el.scrollWidth - el.clientWidth;
    const targetIdx = Math.round(projected / stride);
    const target = Math.max(0, Math.min(targetIdx * stride, max));
    glideTo(el, target);

    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div className={`flex min-w-0 flex-col gap-5 ps-[9px] ${className}`}>
      {(title || onViewAll || headerRight) && (
        <div className="flex items-baseline justify-between gap-4 pe-1">
          {title && (
            <div className="flex min-w-0 items-center gap-2">
              <h3
                className={`truncate font-medium tracking-tight ${titleClassName}`}
                style={{ fontSize: `${Math.round(17 * settings.rowTitleScale * titleScale)}px` }}
              >
                {title}
              </h3>
              {titleExtra}
            </div>
          )}
          {(onViewAll || headerRight) && (
            <div className="flex shrink-0 items-center gap-3">
              {headerRight}
              {onViewAll && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className="group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
                >
                  {t(viewAllLabel)}
                  <ChevronRight
                    size={14}
                    strokeWidth={2.2}
                    className="dir-icon transition-transform duration-200 group-hover/va:translate-x-0.5"
                  />
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} className="group/row relative min-w-0">
        <RowTrackContext.Provider value={trackEl}>
          <div
            ref={trackCb}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => {
              endDrag(event);
              if (dockEnabled && event.pointerType !== "touch") schedulePosterDock(event.clientX);
            }}
            onPointerCancel={(event) => {
              endDrag(event);
              dockPointerXRef.current = null;
              resetPosterDock();
            }}
            onPointerLeave={() => {
              dockPointerXRef.current = null;
              resetPosterDock();
            }}
            onClickCapture={onClickCapture}
            onDragStart={(e) => e.preventDefault()}
            className="harbor-row-track grid grid-flow-col items-start gap-5 overflow-x-auto px-5 pb-5 pt-8 -mx-5 -mb-5 -mt-8 scroll-ps-5 scroll-pe-5 [scroll-snap-type:x_mandatory] *:snap-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [overflow-anchor:none] overscroll-x-contain [&_img]:select-none [&_img]:[-webkit-user-drag:none]"
            style={{
              gridAutoColumns: cellWidth != null ? `${cellWidth}px` : `${effMin}px`,
              willChange: "transform",
              transform: "translateZ(0)",
              contain: "layout style",
            }}
          >
            {items.map((child, i) => {
              const span = isValidElement(child)
                ? (child.props as { style?: { gridColumn?: string } }).style?.gridColumn
                : undefined;
              return (
                <LazyChild key={i} eager={i < EAGER_COUNT} shape={shape} span={span}>
                  {child}
                </LazyChild>
              );
            })}
          </div>
        </RowTrackContext.Provider>
        <EdgeArrow side="left" visible={canPrev} always={arrowsAlways} onClick={() => scroll(-1)} />
        <EdgeArrow side="right" visible={canNext} always={arrowsAlways} onClick={() => scroll(1)} />
      </div>
    </div>
  );
}

function EdgeArrow({
  side,
  visible,
  always = false,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  always?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const label = t(side === "left" ? "Scroll left" : "Scroll right");

  if (always) {
    return (
      <div
        className={`pointer-events-none absolute inset-y-0 z-30 flex w-14 items-center transition-opacity duration-200 ${
          side === "left" ? "inset-s-0 justify-start" : "inset-e-0 justify-end"
        } ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <ThreeLiquidGlassSurface
          radius="9999px"
          shaderRadius={1}
          intensity={1}
          variant="overlay"
          backdropBlur
          className={`h-11 w-11 pointer-events-auto ${
            visible
              ? "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          contentClassName="flex h-full w-full items-center justify-center"
        >
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            tabIndex={visible ? 0 : -1}
            className="
      flex h-full w-full
      items-center justify-center
      rounded-full bg-transparent
      text-ink outline-none
    "
          >
            {side === "left" ? (
              <ChevronLeft size={22} strokeWidth={2.2} className="dir-icon" />
            ) : (
              <ChevronRight size={22} strokeWidth={2.2} className="dir-icon" />
            )}
          </button>
        </ThreeLiquidGlassSurface>
      </div>
    );
  }

  const sideClass = side === "left" ? "start-0 justify-start" : "end-0 justify-end";

  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 flex w-14 items-center ${sideClass}`}
    >
      <ThreeLiquidGlassSurface
        radius="9999px"
        shaderRadius={1}
        intensity={1}
        variant="overlay"
        backdropBlur
        className={`h-11 w-11 pointer-events-auto ${
          visible
            ? "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        contentClassName="flex h-full w-full items-center justify-center"
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          tabIndex={visible ? 0 : -1}
          className="
      flex h-full w-full
      items-center justify-center
      rounded-full bg-transparent
      text-ink outline-none
    "
        >
          {side === "left" ? (
            <ChevronLeft size={22} strokeWidth={2.2} className="dir-icon" />
          ) : (
            <ChevronRight size={22} strokeWidth={2.2} className="dir-icon" />
          )}
        </button>
      </ThreeLiquidGlassSurface>
    </div>
  );
}
