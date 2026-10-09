import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ProxiedImg } from "./proxied-img";
import { usePinchZoom } from "./hooks/use-pinch-zoom";

const OBSERVER_FALLBACK_MS = 300;
const FOLLOW_IDLE_MS = 1200;

export function ModeStrip({
  pages,
  initialPage,
  onPageChange,
  onToggleChrome,
  onScrollState,
  direction = "vertical",
  rtl = false,
  showImages = true,
  zoom = 1,
  applyZoom = false,
  onZoom,
  onPan,
}: {
  pages: string[];
  initialPage: number;
  onPageChange: (p: number, frac?: number) => void;
  onToggleChrome: () => void;
  onScrollState?: (page: number, frac: number, vel: number) => void;
  direction?: "vertical" | "horizontal";
  rtl?: boolean;
  showImages?: boolean;
  zoom?: number;
  applyZoom?: boolean;
  onZoom?: (z: number) => void;
  onPan?: (dx: number, dy: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const els = useRef<Array<HTMLDivElement | null>>([]);
  const change = useRef(onPageChange);
  change.current = onPageChange;
  const scrollState = useRef(onScrollState);
  scrollState.current = onScrollState;
  const pinch = usePinchZoom({ zoom, onZoom, onPan, rootRef });

  const onRootClick = () => {
    if (pinch.shouldSuppressClick()) return;
    onToggleChrome();
  };

  const horizontal = direction === "horizontal";

  const didScroll = useRef(false);
  const quietUntil = useRef(0);
  const lastScrollSend = useRef(0);
  const lastInput = useRef(0);
  const currentRef = useRef(initialPage);
  const targetRef = useRef(initialPage);
  targetRef.current = initialPage;
  const firstUrl = useRef(pages[0]);
  const firstDir = useRef(horizontal);
  const firstRtl = useRef(rtl);
  if (firstUrl.current !== pages[0] || firstDir.current !== horizontal || firstRtl.current !== rtl) {
    firstUrl.current = pages[0];
    firstDir.current = horizontal;
    firstRtl.current = rtl;
    didScroll.current = false;
    quietUntil.current = performance.now() + 200;
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (performance.now() < quietUntil.current) return;
        if (performance.now() - lastScrollSend.current < OBSERVER_FALLBACK_MS) return;
        const rRoot = root.getBoundingClientRect();
        const center = horizontal
          ? rRoot.left + rRoot.width / 2
          : rRoot.top + rRoot.height / 2;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const box = (e.target as HTMLElement).getBoundingClientRect();
          const start = horizontal ? box.left : box.top;
          const size = horizontal ? box.width : box.height;
          if (size < 2) continue;
          const i = Number((e.target as HTMLElement).dataset.page);
          if (!Number.isFinite(i)) continue;
          const frac = Math.max(0, Math.min(1, (center - start) / size));
          currentRef.current = i;
          change.current(i, frac);
        }
      },
      { root, rootMargin: horizontal ? "0px -45% 0px -45%" : "-45% 0px -45% 0px" },
    );
    els.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [pages, horizontal]);

  useEffect(() => {
    if (didScroll.current || pages.length === 0) return;
    didScroll.current = true;
    if (initialPage <= 0) return;
    els.current[initialPage]?.scrollIntoView(
      horizontal ? { inline: "center", block: "nearest" } : { block: "start" },
    );
  }, [pages, initialPage, horizontal, rtl]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let last = 0;
    let lastSample = { frac: -1, page: -1, t: 0 };
    const report = () => {
      raf = 0;
      const cb = scrollState.current;
      if (!cb) return;
      const now = performance.now();
      if (now - last < 50 || now < quietUntil.current) return;
      last = now;
      const rRoot = root.getBoundingClientRect();
      const center = horizontal
        ? rRoot.left + rRoot.width / 2
        : rRoot.top + rRoot.height / 2;
      for (let i = 0; i < els.current.length; i++) {
        const el = els.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const start = horizontal ? r.left : r.top;
        const size = horizontal ? r.width : r.height;
        if (center >= start && center < start + size && size > 0) {
          const frac = Math.max(0, Math.min(1, (center - start) / size));
          let vel = 0;
          if (lastSample.page === i && now > lastSample.t) {
            vel = (frac - lastSample.frac) / (now - lastSample.t);
          }
          lastSample = { frac, page: i, t: now };
          lastScrollSend.current = now;
          currentRef.current = i;
          cb(i, frac, vel);
          return;
        }
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(report);
    };
    const stamp = () => {
      lastInput.current = performance.now();
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("pointerdown", stamp);
    root.addEventListener("wheel", stamp, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointerdown", stamp);
      root.removeEventListener("wheel", stamp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pages, horizontal]);

  useEffect(() => {
    if (targetRef.current === currentRef.current) return;
    const node = els.current[targetRef.current];
    if (!node) return;
    if (performance.now() - lastInput.current < FOLLOW_IDLE_MS) {
      const t = window.setTimeout(() => {
        if (targetRef.current === currentRef.current) return;
        if (performance.now() - lastInput.current < FOLLOW_IDLE_MS) return;
        els.current[targetRef.current]?.scrollIntoView(
          horizontal ? { inline: "center", block: "nearest" } : { block: "start" },
        );
      }, FOLLOW_IDLE_MS + 100);
      return () => window.clearTimeout(t);
    }
    node.scrollIntoView(horizontal ? { inline: "center", block: "nearest" } : { block: "start" });
  }, [initialPage, horizontal, rtl]);

  const innerStyle: CSSProperties = horizontal
    ? {
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 108px)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 96px)",
      }
    : {
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 108px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
      };

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      const w = Math.max(1, Math.round(root.clientWidth));
      const h = Math.max(1, Math.round(root.clientHeight));
      setViewport((v) => (v.w === w && v.h === h ? v : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, [pages, horizontal]);

  const zoomed = applyZoom && zoom > 1;
  const imgStyle: CSSProperties | undefined =
    !zoomed || viewport.w <= 0 || viewport.h <= 0
      ? undefined
      : horizontal
        ? { height: `${Math.round(viewport.h * zoom)}px`, width: "auto" }
        : { width: `${Math.round(viewport.w * zoom)}px`, height: "auto" };

  return (
    <div
      ref={rootRef}
      dir={horizontal ? (rtl ? "rtl" : "ltr") : undefined}
      className={`h-full w-full overscroll-contain ${
        horizontal ? "overflow-x-auto" : zoomed ? "overflow-x-auto overflow-y-auto" : "overflow-y-auto"
      }`}
      style={onZoom ? { touchAction: "pan-x pan-y" } : undefined}
      onClick={onRootClick}
      onPointerDown={pinch.onPointerDown}
      onPointerMove={pinch.onPointerMove}
      onPointerUp={pinch.onPointerUp}
      onPointerCancel={pinch.onPointerCancel}
    >
      <div
        className={
          horizontal
            ? "flex h-full w-max min-w-full flex-row items-center"
            : "flex flex-col items-center"
        }
        style={innerStyle}
      >
        {pages.map((url, i) => (
          <div
            key={i}
            data-page={i}
            ref={(el) => {
              els.current[i] = el;
            }}
            className={
              horizontal
                ? "flex h-full shrink-0 items-center justify-center bg-[#0b0b0d]"
                : "flex min-h-[40vh] w-full items-center justify-center bg-[#0b0b0d]"
            }
            style={horizontal ? { minWidth: "36vw" } : undefined}
          >
            {showImages ? (
              <ProxiedImg
                url={url}
                className={horizontal ? "block h-full w-auto object-contain" : "block w-full"}
                style={imgStyle}
              />
            ) : (
              <span className="text-[15px] font-semibold tabular-nums text-ink-subtle">
                {i + 1}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}