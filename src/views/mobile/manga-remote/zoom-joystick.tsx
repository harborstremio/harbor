import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const PAD = 176;
const NUB = 66;
const MAX_OFFSET = 52;
const SLOP = 8;
const TAP_SLOP = 10;
const TAP_MS = 250;
const DEADZONE = 0.16;
const PAN_SPEED = 880;
const ZOOM_STEP = 0.25;
const DECAY = 16;
const ZERO = { x: 0, y: 0 };

type Phase = "idle" | "pending" | "drag" | "spring";

function clampUnit(n: number): number {
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

function shape(n: number): number {
  const a = Math.abs(n);
  if (a <= DEADZONE) return 0;
  const t = (a - DEADZONE) / (1 - DEADZONE);
  return (n < 0 ? -1 : 1) * t * t;
}

function clampDisk(x: number, y: number, r: number): { x: number; y: number } {
  const d = Math.hypot(x, y);
  if (d <= r || d === 0) return { x, y };
  const s = r / d;
  return { x: x * s, y: y * s };
}

function clampZoomTo(z: number, lo: number, hi: number): number {
  const r = Math.round(z * 100) / 100;
  return r < lo ? lo : r > hi ? hi : r;
}

export function ZoomJoystick({
  zoom,
  min,
  max,
  canZoom,
  onZoom,
  onPan,
  onEngageChange,
  bottomOffset = "calc(env(safe-area-inset-bottom, 0px) + 16px)",
}: {
  zoom: number;
  min: number;
  max: number;
  canZoom: boolean;
  onZoom: (zoom: number) => void;
  onPan: (dx: number, dy: number) => void;
  onEngageChange?: (engaged: boolean) => void;
  bottomOffset?: string;
}) {
  const reduce = useReducedMotion();
  const t = useT();
  const [engaged, setEngaged] = useState(false);
  const [show, setShow] = useState(false);
  const [active, setActive] = useState(false);
  const [offset, setOffset] = useState(ZERO);
  const [pct, setPct] = useState(() => Math.round(zoom * 100));

  const padRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ zoom, min, max, onZoom, onPan });
  propsRef.current = { zoom, min, max, onZoom, onPan };

  const rafRef = useRef(0);
  const tickRef = useRef((_now: number) => {});
  const phaseRef = useRef<Phase>("idle");
  const activeRef = useRef(false);
  const offRef = useRef(ZERO);
  const panRemXRef = useRef(0);
  const panRemYRef = useRef(0);
  const pctRef = useRef(Math.round(zoom * 100));
  const pidRef = useRef(-1);
  const lastTRef = useRef(0);
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const lastRef = useRef({ x: 0, y: 0 });
  const baseRef = useRef(ZERO);

  const schedule = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame((t) => {
      rafRef.current = 0;
      tickRef.current(t);
    });
  };

  const pushPct = (z: number) => {
    const p = Math.round(z * 100);
    if (p !== pctRef.current) {
      pctRef.current = p;
      setPct(p);
    }
  };

  const stepZoom = (dir: 1 | -1) => {
    const { zoom: z, min: lo, max: hi, onZoom: emit } = propsRef.current;
    emit(clampZoomTo(z + dir * ZOOM_STEP, lo, hi));
  };

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - lastTRef.current) / 1000);
    lastTRef.current = now;
    const { onPan: emitPan } = propsRef.current;

    if (phaseRef.current === "drag") {
      const off = offRef.current;
      const nx = clampUnit(off.x / MAX_OFFSET);
      const ny = clampUnit(off.y / MAX_OFFSET);
      const px = shape(nx);
      const py = shape(ny);
      if (px !== 0 || py !== 0) {
        panRemXRef.current += px * PAN_SPEED * dt;
        panRemYRef.current += py * PAN_SPEED * dt;
        const wx = Math.trunc(panRemXRef.current);
        const wy = Math.trunc(panRemYRef.current);
        if (wx !== 0 || wy !== 0) {
          panRemXRef.current -= wx;
          panRemYRef.current -= wy;
          emitPan(wx, wy);
        }
      }
      schedule();
      return;
    }

    if (phaseRef.current === "spring") {
      const off = offRef.current;
      const k = Math.exp(-DECAY * dt);
      const nx = off.x * k;
      const ny = off.y * k;
      if (Math.hypot(nx, ny) < 0.5) {
        offRef.current = ZERO;
        setOffset(ZERO);
        phaseRef.current = "idle";
      } else {
        const o = { x: nx, y: ny };
        offRef.current = o;
        setOffset(o);
        schedule();
      }
    }
  };
  tickRef.current = tick;

  const stopAll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    phaseRef.current = "idle";
    activeRef.current = false;
    setActive(false);
    offRef.current = ZERO;
    setOffset(ZERO);
    panRemXRef.current = 0;
    panRemYRef.current = 0;
  };

  const engage = () => {
    setEngaged(true);
    onEngageChange?.(true);
  };

  const disengage = () => {
    stopAll();
    setEngaged(false);
    onEngageChange?.(false);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    try {
      padRef.current?.setPointerCapture(e.pointerId);
    } catch {}
    pidRef.current = e.pointerId;
    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    lastRef.current = { x: e.clientX, y: e.clientY };
    baseRef.current = offRef.current;
    phaseRef.current = "pending";
    panRemXRef.current = 0;
    panRemYRef.current = 0;
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pidRef.current !== e.pointerId) return;
    const ph = phaseRef.current;
    if (ph !== "pending" && ph !== "drag") return;
    lastRef.current = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (ph === "pending") {
      if (Math.hypot(dx, dy) < SLOP) return;
      phaseRef.current = "drag";
      activeRef.current = true;
      setActive(true);
      lastTRef.current = performance.now();
      schedule();
    }
    const o = clampDisk(baseRef.current.x + dx, baseRef.current.y + dy, MAX_OFFSET);
    offRef.current = o;
    setOffset(o);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>, cancel: boolean) => {
    if (pidRef.current !== e.pointerId) return;
    try {
      padRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    pidRef.current = -1;
    const ph = phaseRef.current;
    if (ph === "drag") {
      activeRef.current = false;
      setActive(false);
      if (reduce) {
        offRef.current = ZERO;
        setOffset(ZERO);
        phaseRef.current = "idle";
      } else {
        phaseRef.current = "spring";
        lastTRef.current = performance.now();
        schedule();
      }
      return;
    }
    phaseRef.current = "idle";
    if (cancel) return;
    const held = performance.now() - startRef.current.t;
    const moved = Math.hypot(
      lastRef.current.x - startRef.current.x,
      lastRef.current.y - startRef.current.y,
    );
    if (held <= TAP_MS && moved <= TAP_SLOP) disengage();
  };

  useEffect(() => {
    if (!engaged) {
      setShow(false);
      return;
    }
    if (reduce) {
      setShow(true);
      return;
    }
    const r = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(r);
  }, [engaged, reduce]);

  useEffect(() => {
    if (activeRef.current) return;
    pushPct(clampZoomTo(zoom, min, max));
  }, [zoom, min, max]);

  useEffect(() => {
    if (!canZoom && engaged) disengage();
  }, [canZoom, engaged]);

  useEffect(() => {
    const clear = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      phaseRef.current = "idle";
    };
    const onVis = () => {
      if (document.visibilityState !== "visible") clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!canZoom) return null;

  return (
    <div className="absolute end-4 z-40 flex flex-col items-end" style={{ bottom: bottomOffset }}>
      {!engaged && (
        <button
          type="button"
          aria-label={t("Zoom controls, {percent} percent", { percent: pct })}
          onClick={engage}
          className="flex h-14 w-14 touch-none select-none flex-col items-center justify-center rounded-full bg-elevated/80 text-ink shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] ring-1 ring-edge-soft/50 backdrop-blur-xl transition-transform duration-100 active:scale-90"
        >
          <ZoomIn size={20} strokeWidth={2.2} />
          <span className="mt-0.5 text-[10.5px] font-semibold leading-none tabular-nums text-ink-subtle">
            {pct}%
          </span>
        </button>
      )}

      {engaged && (
        <div
          className={`relative origin-bottom-right transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
            show ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label={t("Close zoom controls")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={disengage}
            className="absolute -right-1 -top-1 z-10 grid h-11 w-11 place-items-center rounded-full text-ink-subtle transition-transform active:scale-90"
          >
            <X size={20} strokeWidth={2.4} />
          </button>

          <div className="absolute -left-3 top-1/2 flex -translate-x-full -translate-y-1/2 flex-col gap-2">
            <button
              type="button"
              aria-label={t("Zoom in")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => stepZoom(1)}
              className="grid h-12 w-12 place-items-center rounded-full bg-surface/85 text-ink shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] ring-1 ring-edge-soft/50 backdrop-blur-xl transition-transform active:scale-90"
            >
              <ZoomIn size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label={t("Zoom out")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => stepZoom(-1)}
              className="grid h-12 w-12 place-items-center rounded-full bg-surface/85 text-ink shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] ring-1 ring-edge-soft/50 backdrop-blur-xl transition-transform active:scale-90"
            >
              <ZoomOut size={18} strokeWidth={2.2} />
            </button>
          </div>

          <div
            ref={padRef}
            role="group"
            aria-label={t("Zoom and pan joystick")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={(e) => release(e, false)}
            onPointerCancel={(e) => release(e, true)}
            className="relative grid touch-none select-none place-items-center rounded-full bg-surface/80 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.75)] ring-1 ring-edge-soft/40 backdrop-blur-2xl"
            style={{ width: PAD, height: PAD }}
          >
            <div className="pointer-events-none absolute inset-3 rounded-full ring-1 ring-edge-soft/25" />
            <ChevronUp
              aria-hidden
              size={16}
              strokeWidth={2.2}
              className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-ink-subtle/55"
            />
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={2.2}
              className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-ink-subtle/55"
            />
            <ChevronLeft
              aria-hidden
              size={16}
              strokeWidth={2.2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle/55"
            />
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2.2}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle/55"
            />

            <div
              className={`pointer-events-none grid place-items-center rounded-full shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)] ${
                active
                  ? "bg-elevated ring-2 ring-accent/70"
                  : "bg-elevated/95 ring-1 ring-edge-soft/60"
              } ${reduce ? "" : "transition-[background-color,box-shadow] duration-150"}`}
              style={{
                width: NUB,
                height: NUB,
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${active ? 1.04 : 1})`,
              }}
            >
              <span className="text-[13px] font-semibold tabular-nums text-ink">{pct}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
