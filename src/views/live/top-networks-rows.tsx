import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { IptvChannel } from "@/lib/iptv/types";
import { type NetworkRow, type ResolvedNetwork, resolveNetworks } from "@/lib/iptv/top-networks";

const MIN_CARD_WIDTH = 150;
const GAP = 14;
const CARD_HEIGHT = 132;
const LOGO_HEIGHT = 84;

export function TopNetworksRows({
  rows,
  channels,
  onPlay,
}: {
  rows: NetworkRow[];
  channels: IptvChannel[];
  onPlay: (ch: IptvChannel) => void;
}) {
  const resolvedRows = useMemo(
    () =>
      rows
        .map((row) => ({ row, resolved: resolveNetworks(channels, row.networks) }))
        .filter((r) => r.resolved.length > 0),
    [rows, channels],
  );
  if (resolvedRows.length === 0) return null;
  return (
    <div className="flex flex-col gap-6 pb-3">
      {resolvedRows.map(({ row, resolved }) => (
        <Row key={row.id} title={row.title} resolved={resolved} onPlay={onPlay} />
      ))}
    </div>
  );
}

function Row({
  title,
  resolved,
  onPlay,
}: {
  title: string;
  resolved: ResolvedNetwork[];
  onPlay: (ch: IptvChannel) => void;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const rafRef = useRef<number | null>(null);
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

  const measure = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    const available = container.clientWidth;
    if (available <= 0) return;
    const fits = Math.max(1, Math.floor((available + GAP) / (MIN_CARD_WIDTH + GAP)));
    setCellWidth((available - (fits - 1) * GAP) / fits);
    setCanPrev(track.scrollLeft > 1);
    setCanNext(track.scrollWidth - (track.scrollLeft + track.clientWidth) > 1);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [resolved.length, measure]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(track);
    const onScroll = () => measure();
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      track.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  const cancelGlide = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stride = (cellWidth ?? MIN_CARD_WIDTH) + GAP;

  const animateTo = (target: number) => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const clamped = Math.max(0, Math.min(target, max));
    const start = el.scrollLeft;
    const distance = clamped - start;
    if (Math.abs(distance) < 1) return;
    const startTime = performance.now();
    const duration = Math.max(220, Math.min(560, 200 + Math.abs(distance) * 0.4));
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    cancelGlide();
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      el.scrollLeft = start + distance * ease(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const scrollPage = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    animateTo(el.scrollLeft + dir * el.clientWidth);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      try {
        el.setPointerCapture(d.pointerId);
      } catch {}
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
    } catch {}
    const friction = 0.004;
    const v = d.vel;
    const projection = -((v * Math.abs(v)) / (2 * friction));
    const projected = el.scrollLeft + projection;
    const targetIdx = Math.round(projected / stride);
    animateTo(targetIdx * stride);
    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollPage(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollPage(1);
    }
  };

  return (
    <section
      ref={containerRef}
      className="group/row relative flex w-full min-w-0 flex-col gap-2.5"
      onKeyDown={onKey}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
        {t(title)}
      </h2>
      <div className="relative w-full">
        <div
          ref={trackRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex w-full overflow-x-auto overflow-y-hidden pb-1 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap: GAP }}
        >
          {cellWidth != null &&
            resolved.map((n) => (
              <NetworkCard
                key={n.def.id}
                resolved={n}
                width={cellWidth}
                onClick={() => {
                  if (drag.current.moved) return;
                  onPlay(n.channel);
                }}
              />
            ))}
        </div>
        {canPrev && (
          <button
            aria-label={t("Scroll left")}
            onClick={() => scrollPage(-1)}
            className="absolute start-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft/55 bg-canvas/90 text-ink opacity-0 backdrop-blur transition-opacity duration-150 hover:bg-canvas group-hover/row:opacity-100 focus-visible:opacity-100 rtl:translate-x-1/2"
          >
            <ChevronLeft size={18} strokeWidth={2.2} className="dir-icon" />
          </button>
        )}
        {canNext && (
          <button
            aria-label={t("Scroll right")}
            onClick={() => scrollPage(1)}
            className="absolute end-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft/55 bg-canvas/90 text-ink opacity-0 backdrop-blur transition-opacity duration-150 hover:bg-canvas group-hover/row:opacity-100 focus-visible:opacity-100 rtl:-translate-x-1/2"
          >
            <ChevronRight size={18} strokeWidth={2.2} className="dir-icon" />
          </button>
        )}
      </div>
    </section>
  );
}

function NetworkCard({
  resolved,
  width,
  onClick,
}: {
  resolved: ResolvedNetwork;
  width: number;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const showLogo = resolved.logoUrl && !errored;
  return (
    <button
      onClick={onClick}
      title={resolved.def.displayName}
      style={{ width, height: CARD_HEIGHT, flex: `0 0 ${width}px` }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-edge-soft/55 bg-elevated text-start transition-colors duration-150 hover:border-edge hover:bg-raised"
    >
      <div
        className="flex shrink-0 items-center justify-center bg-surface/70 p-3"
        style={{ height: LOGO_HEIGHT }}
      >
        {showLogo ? (
          <img
            src={resolved.logoUrl!}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setErrored(true)}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Tv size={26} strokeWidth={1.6} className="text-ink-subtle" />
        )}
      </div>
      <div className="flex flex-1 items-center px-3">
        <span className="truncate text-[14px] font-semibold leading-tight text-ink">
          {resolved.def.displayName}
        </span>
      </div>
    </button>
  );
}
