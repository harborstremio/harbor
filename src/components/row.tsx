import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { resetPosterDock as resetPosterDockItems, updatePosterDock } from "@/lib/poster-dock";
import { scrollDeltaToRevealCard } from "@/lib/poster-backdrop-expansion";
import { RowCardExpansionProvider } from "@/components/row-card-expansion";

const GAP = 20;

function columnSpan(value?: string): number {
  const span = value?.match(/span\s+(\d+)/)?.[1];
  return span ? Math.max(1, Number(span)) : 1;
}
const EAGER_COUNT = 6;
const NEAR_MARGIN = "300px";
const FAR_RELEASE_MS = 15000;

export type RowShape = "portrait" | "landscape" | "service" | "rank" | "tile";

export const TV_CARD_MIN = 318;

function holdsPosterCards(children: React.ReactNode): boolean {
  const first = Children.toArray(children)[0];
  if (!isValidElement(first)) return false;
  const type = first.type as { isPosterCard?: boolean };
  if (!type?.isPosterCard) return false;
  return (first.props as { kids?: boolean; meta?: { type?: string } }).kids !== true;
}

export function usePosterRow(min = 144, kids = false): { min: number; shape: RowShape } {
  const { settings } = useSettings();
  return settings.rowCardStyle === "tv" && !kids
    ? { min: TV_CARD_MIN, shape: "landscape" }
    : { min, shape: "portrait" };
}

const RowTrackContext = createContext<HTMLDivElement | null>(null);
export const ScrollRootContext = createContext<HTMLElement | null>(null);

function LazyChild({
  children,
  eager,
  shape,
  span,
  expansion,
}: {
  children: ReactNode;
  eager: boolean;
  shape: RowShape;
  span?: string;
  expansion?: {
    index: number;
    baseWidth: number;
    expandedWidth?: number;
    expanded: boolean;
    onExpand: (index: number, width: number) => void;
    onCollapse: (index: number) => void;
  };
}) {
  const root = useContext(RowTrackContext);
  const [visible, setVisible] = useState(eager);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root) return;
    const el = ref.current;
    if (!el) return;
    let hideTimer: number | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (hideTimer != null) {
            window.clearTimeout(hideTimer);
            hideTimer = null;
          }
          setVisible(true);
        } else if (!eager && hideTimer == null) {
          hideTimer = window.setTimeout(() => {
            hideTimer = null;
            setVisible(false);
          }, FAR_RELEASE_MS);
        }
      },
      { root, rootMargin: NEAR_MARGIN },
    );
    io.observe(el);
    const recheck = window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      if (rr.width === 0 || rr.height === 0) return;
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
      if (hideTimer != null) window.clearTimeout(hideTimer);
    };
  }, [root, eager]);

  return (
    <div
      ref={ref}
      data-row-card-index={expansion?.index}
      data-poster-card-cell={expansion ? "" : undefined}
      data-tv-nav-base-width={expansion?.baseWidth}
      className={
        expansion
          ? "relative min-w-0 transition-[flex-basis] duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          : undefined
      }
      style={
        expansion
          ? {
              flex: "0 0 auto",
              flexBasis: `${expansion.expandedWidth ?? expansion.baseWidth}px`,
            }
          : span
            ? { gridColumn: span }
            : undefined
      }
    >
      {visible ? (
        expansion ? (
          <RowCardExpansionProvider
            index={expansion.index}
            enabled
            expanded={expansion.expanded}
            onExpand={expansion.onExpand}
            onCollapse={expansion.onCollapse}
          >
            {children}
          </RowCardExpansionProvider>
        ) : (
          children
        )
      ) : (
        <Skeleton shape={shape} />
      )}
    </div>
  );
}

function Skeleton({ shape }: { shape: RowShape }) {
  const { settings } = useSettings();
  const radius = settings.posterRadius;
  if (shape === "service") {
    return <div className="h-20 w-full rounded-xl bg-elevated/40" />;
  }
  if (shape === "rank") {
    return (
      <div className="aspect-[228/246] w-full bg-elevated/30" style={{ borderRadius: radius }} />
    );
  }
  if (shape === "tile") {
    return <div className="aspect-[5/4] w-full rounded-2xl bg-elevated/30" />;
  }
  const aspect = shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]";
  const hideText = shape === "portrait" && settings.hidePosterTitles;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div className={`${aspect} bg-elevated/40`} style={{ borderRadius: radius }} />
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
  alwaysActive = false,
  children,
  onEndReached,
  onViewAll,
  viewAllLabel = "View all",
  viewAllClassName = "text-ink-subtle hover:text-ink",
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
  viewAllClassName?: string;
  headerRight?: React.ReactNode;
  titleClassName?: string;
  titleScale?: number;
}) {
  const { settings } = useSettings();
  const t = useT();
  const tvCards =
    shape === "portrait" && settings.rowCardStyle === "tv" && holdsPosterCards(children);
  const effShape: RowShape = tvCards ? "landscape" : shape;
  const effMin = Math.max(72, Math.round((tvCards ? TV_CARD_MIN : min) * settings.posterScale));
  const expandingCards = effShape === "portrait" && settings.posterBackdropExpansion;
  const dockEnabled = effShape === "portrait" && settings.posterDockMagnification;
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
  const [expandedCard, setExpandedCard] = useState<{
    index: number;
    widthScale: number;
  } | null>(null);
  const onEndRef = useRef(onEndReached);
  useEffect(() => {
    onEndRef.current = onEndReached;
  });

  const rtlRef = useRef(false);
  const measure = () => {
    const container = containerRef.current;
    if (!container) return;
    rtlRef.current =
      getComputedStyle(container).direction === "rtl" || document.documentElement.dir === "rtl";
    const available = container.getBoundingClientRect().width;
    if (available <= 0) return;
    const fits = Math.max(1, Math.floor((available + GAP) / (effMin + GAP)));
    const raw = (available - (fits - 1) * GAP) / fits;
    setCellWidth((Math.ceil(raw * 64) + 1) / 64);
  };

  const isRtl = () => rtlRef.current || document.documentElement.dir === "rtl";
  const readPos = (el: HTMLDivElement) => (isRtl() ? -el.scrollLeft : el.scrollLeft);
  const writePos = (el: HTMLDivElement, pos: number) => {
    el.scrollLeft = isRtl() ? -pos : pos;
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
  const expansionFrameRef = useRef<number | null>(null);
  const expansionSettleRef = useRef<number | null>(null);
  const hadExpandedCardRef = useRef(false);

  const expandRowCard = useCallback(
    (index: number, width: number) => {
      if (!expandingCards) return;
      const baseWidth = cellWidth ?? effMin;
      const widthScale = Math.max(1, width / baseWidth);
      setExpandedCard((current) => {
        if (current?.index === index && Math.abs(current.widthScale - widthScale) < 0.005) {
          return current;
        }
        return { index, widthScale };
      });
    },
    [cellWidth, effMin, expandingCards],
  );
  const collapseRowCard = useCallback((index: number) => {
    setExpandedCard((current) => (current?.index === index ? null : current));
  }, []);

  const revealExpanded = (track: HTMLDivElement, index: number) => {
    const cell = track.querySelector<HTMLElement>(`[data-row-card-index="${index}"]`);
    if (!cell) return;
    const delta = scrollDeltaToRevealCard(
      cell.getBoundingClientRect(),
      track.getBoundingClientRect(),
      GAP,
    );
    if (Math.abs(delta) > 0.5) track.scrollLeft += delta;
  };

  useLayoutEffect(() => {
    const track = trackRef.current;
    const hasExpansion = expandedCard !== null;
    if (!track || (!hasExpansion && !hadExpandedCardRef.current)) return;
    hadExpandedCardRef.current = hasExpansion;
    if (expansionFrameRef.current !== null) cancelAnimationFrame(expansionFrameRef.current);
    if (expansionSettleRef.current !== null) window.clearTimeout(expansionSettleRef.current);
    track.style.scrollSnapType = "none";
    track.style.scrollBehavior = "auto";
    if (expandedCard) {
      const startedAt = performance.now();
      const keepExpandedCardVisible = () => {
        expansionFrameRef.current = null;
        if (!drag.current.active) revealExpanded(track, expandedCard.index);
        if (performance.now() - startedAt < 520) {
          expansionFrameRef.current = requestAnimationFrame(keepExpandedCardVisible);
        }
      };
      expansionFrameRef.current = requestAnimationFrame(keepExpandedCardVisible);
    }
    expansionSettleRef.current = window.setTimeout(() => {
      expansionSettleRef.current = null;
      if (expandedCard && !drag.current.active) revealExpanded(track, expandedCard.index);
      if (!expandedCard) track.style.scrollSnapType = "";
      track.style.scrollBehavior = "";
      measureScroll();
    }, 540);
  }, [expandedCard]);

  useEffect(
    () => () => {
      if (expansionFrameRef.current !== null) cancelAnimationFrame(expansionFrameRef.current);
      if (expansionSettleRef.current !== null) window.clearTimeout(expansionSettleRef.current);
    },
    [],
  );

  const childCount = Children.count(children);
  const restoredRef = useRef(false);
  const userInteractedRef = useRef(false);
  const { rememberRowScroll, recallRowScroll } = useView();
  useLayoutEffect(() => {
    measure();
    measureScroll();
  }, [childCount, trackEl, effMin]);
  useLayoutEffect(() => {
    if (!trackEl || cellWidth == null) return;
    if (scrollKey && !restoredRef.current && childCount > 0) {
      const n = recallRowScroll(scrollKey);
      const max = trackEl.scrollWidth - trackEl.clientWidth;
      const target = n != null && n > 0 && max > 0 ? Math.min(n, max) : 0;
      if (readPos(trackEl) !== target) writePos(trackEl, target);
      restoredRef.current = true;
      return;
    }
    if (!userInteractedRef.current && readPos(trackEl) !== 0) {
      writePos(trackEl, 0);
    }
  }, [childCount, cellWidth, trackEl, scrollKey, recallRowScroll]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    let roRaf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (container.offsetParent === null) return;
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
      if (!detail?.prefix || !scrollKey.startsWith(detail.prefix)) return;
      if (saveTimer != null) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      writePos(track, 0);
      rememberRowScroll(scrollKey, 0);
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
    cancelGlide();
    const rtl = rtlRef.current;
    const cur = rtl ? -el.scrollLeft : el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    const stride = strideRef.current;
    const raw = cur + dir * el.clientWidth;
    const target = Math.max(0, Math.min(max, Math.round(raw / stride) * stride));
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = rtl ? -target : target;
      return;
    }
    el.style.scrollSnapType = "none";
    glideTo(el, target, false);
  };

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
    const rtl = rtlRef.current;
    updatePosterDock({
      track,
      pointerX,
      cellWidth: cellWidth ?? effMin,
      gap: GAP,
      scrollPosition: rtl ? -track.scrollLeft : track.scrollLeft,
      rtl,
      transitionMs: settings.posterDockTransitionMs,
    });
  }, [cellWidth, dockEnabled, effMin, resetPosterDock, settings.posterDockTransitionMs]);
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
    const rtl = rtlRef.current;
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
    if (dockEnabled && e.pointerType !== "touch" && e.buttons === 0 && !drag.current.active) {
      schedulePosterDock(e.clientX);
    }
    const d = drag.current;
    const el = trackRef.current;
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
    const projected = rtlRef.current ? -projectedRaw : projectedRaw;
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

  const trackPad = dockEnabled ? "pb-8 pt-14 -mb-8 -mt-14" : "py-5 -my-5 px-2 -mx-2 scroll-px-2";

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
                  className={`group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium transition-colors ${viewAllClassName}`}
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
            className={`harbor-row-track items-start gap-5 overflow-x-auto overflow-y-hidden ${trackPad} [scroll-snap-type:x_mandatory] [&>*]:[scroll-snap-align:start] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [overflow-anchor:none] [overscroll-behavior-x:contain] [&_img]:select-none [&_img]:[-webkit-user-drag:none] ${
              expandingCards
                ? "harbor-expanding-card-scope harbor-expanding-row flex flex-nowrap"
                : "grid grid-flow-col"
            }`}
            style={
              {
                "--row-poster-height": `${(cellWidth ?? effMin) * (effShape === "landscape" ? 9 / 16 : 1.5)}px`,
                ...(expandingCards
                  ? {}
                  : { gridAutoColumns: cellWidth != null ? `${cellWidth}px` : `${effMin}px` }),
                transform: "translateZ(0)",
                contain: expandingCards ? "style" : "layout style",
              } as React.CSSProperties
            }
          >
            {Children.map(children, (child, i) => {
              const span = isValidElement(child)
                ? (child.props as { style?: { gridColumn?: string } }).style?.gridColumn
                : undefined;
              const spanCount = columnSpan(span);
              const baseWidth = (cellWidth ?? effMin) * spanCount + GAP * (spanCount - 1);
              const expanded = expandedCard?.index === i;
              const desiredExpandedWidth =
                expanded && expandedCard
                  ? (cellWidth ?? effMin) * expandedCard.widthScale
                  : undefined;
              const viewportLimit = Math.max(
                baseWidth,
                (trackEl?.clientWidth ?? desiredExpandedWidth ?? baseWidth) - GAP * 2,
              );
              const expandedWidth =
                desiredExpandedWidth === undefined
                  ? undefined
                  : Math.max(baseWidth, Math.min(desiredExpandedWidth, viewportLimit));
              return (
                <LazyChild
                  eager={alwaysActive || i < EAGER_COUNT}
                  shape={effShape}
                  span={span}
                  expansion={
                    expandingCards
                      ? {
                          index: i,
                          baseWidth,
                          expandedWidth,
                          expanded,
                          onExpand: expandRowCard,
                          onCollapse: collapseRowCard,
                        }
                      : undefined
                  }
                >
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
  const { settings } = useSettings();
  const label = t(side === "left" ? "Scroll left" : "Scroll right");
  if (settings.liquidGlass) {
    const sideClass = side === "left" ? "start-0 justify-start" : "end-0 justify-end";
    return (
      <div
        className={`pointer-events-none absolute inset-y-0 z-30 flex w-14 items-center ${sideClass} ${
          always ? `transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}` : ""
        }`}
      >
        <ThreeLiquidGlassSurface
          radius="9999px"
          shaderRadius={0.58}
          intensity={0.9}
          interactive={false}
          alwaysActive
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.04)",
          }}
          className={`h-11 w-11 pointer-events-auto border border-white/[0.06] transition-opacity duration-200 ${
            visible
              ? "opacity-85 group-hover/row:opacity-100 focus-within:opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          contentClassName="flex h-full w-full items-center justify-center"
        >
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            tabIndex={visible ? 0 : -1}
            className="flex h-full w-full items-center justify-center rounded-full bg-transparent text-ink outline-none"
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
  const enter = side === "left" ? "-translate-x-2.5" : "translate-x-2.5";
  const chev = !visible
    ? "opacity-0"
    : always
      ? "opacity-100"
      : `opacity-0 ${enter} scale-[0.6] group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:scale-100 group-focus-visible/row:opacity-100 group-focus-visible/row:translate-x-0 group-focus-visible/row:scale-100`;
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 flex w-16 items-center ${
        side === "left"
          ? "start-0 justify-start bg-gradient-to-r rtl:bg-gradient-to-l from-canvas via-canvas/70 to-transparent"
          : "end-0 justify-end bg-gradient-to-l rtl:bg-gradient-to-r from-canvas via-canvas/70 to-transparent"
      } transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        tabIndex={visible ? 0 : -1}
        className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-elevated/90 text-ink shadow-lg ring-1 ring-white/5 backdrop-blur transition-all duration-200 hover:scale-105 hover:bg-elevated active:scale-95 ${chev}`}
      >
        {side === "left" ? (
          <ChevronLeft size={22} strokeWidth={2.2} className="dir-icon" />
        ) : (
          <ChevronRight size={22} strokeWidth={2.2} className="dir-icon" />
        )}
      </button>
    </div>
  );
}
