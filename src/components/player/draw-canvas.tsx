import { useEffect, useRef, useState } from "react";
import { PenCursor } from "./pen-cursor";

export type Stroke = {
  id: string;
  authorId: string;
  authorName: string;
  color: string;
  points: { x: number; y: number }[];
  bornAt: number;
  path?: string;
};

const STROKE_LIFETIME_MS = 9000;
const MIN_POINT_DIST_SQ = 0.004 * 0.004;

type Box = { left: number; top: number; width: number; height: number };

export type VideoTransform = { panscan?: number; zoom?: number; stretch?: boolean };

export function videoContentBox(
  boxW: number,
  boxH: number,
  videoW: number,
  videoH: number,
  transform?: VideoTransform,
): Box {
  const whole = { left: 0, top: 0, width: boxW, height: boxH };
  if (boxW <= 0 || boxH <= 0) return whole;
  if (videoW <= 0 || videoH <= 0) return whole;
  if (transform?.stretch) return whole;

  const scale = Math.min(boxW / videoW, boxH / videoH);
  let w = videoW * scale;
  let h = videoH * scale;

  const panscan = Math.max(0, Math.min(1, transform?.panscan ?? 0));
  if (panscan > 0) {
    let area = boxH - h;
    let fw = h > 0 ? w / h : 1;
    let fh = 1;
    if (Math.round(area) === 0) {
      area = boxW - w;
      fw = 1;
      fh = w > 0 ? h / w : 1;
    }
    w += area * panscan * fw;
    h += area * panscan * fh;
  }

  const zoom = transform?.zoom ?? 0;
  if (zoom !== 0) {
    const factor = Math.pow(2, zoom);
    w *= factor;
    h *= factor;
  }

  return { left: (boxW - w) / 2, top: (boxH - h) / 2, width: w, height: h };
}

export function StrokesLayer({
  strokes,
  hideOthers,
  selfId,
  videoWidth = 0,
  videoHeight = 0,
  transform,
}: {
  strokes: Stroke[];
  hideOthers: boolean;
  selfId: string;
  videoWidth?: number;
  videoHeight?: number;
  transform?: VideoTransform;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const box = useContentBox(hostRef, videoWidth, videoHeight, transform);
  const visibleStrokes = hideOthers ? strokes.filter((s) => s.authorId === selfId) : strokes;
  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 15 }}>
      {visibleStrokes.length > 0 && (
        <div
          className="absolute"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          <StrokesSvg strokes={visibleStrokes} />
        </div>
      )}
    </div>
  );
}

function useContentBox(
  ref: React.RefObject<HTMLDivElement | null>,
  videoWidth: number,
  videoHeight: number,
  transform?: VideoTransform,
): Box {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return videoContentBox(size.w, size.h, videoWidth, videoHeight, transform);
}

export function DrawCanvas({
  enabled,
  selfId,
  selfName,
  selfColor,
  hideOthers,
  strokes,
  videoWidth = 0,
  videoHeight = 0,
  transform,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
}: {
  enabled: boolean;
  selfId: string;
  selfName: string;
  selfColor: string;
  hideOthers: boolean;
  strokes: Stroke[];
  videoWidth?: number;
  videoHeight?: number;
  transform?: VideoTransform;
  onStrokeStart: (stroke: Stroke) => void;
  onStrokePoint: (id: string, x: number, y: number) => void;
  onStrokeEnd: (id: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const drawing = useRef<{ id: string; lastX: number; lastY: number } | null>(null);

  if (!enabled) return null;

  const norm = (e: React.PointerEvent) => {
    const r = surfaceRef.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    const box = videoContentBox(r.width, r.height, videoWidth, videoHeight, transform);
    if (box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    return {
      x: (e.clientX - r.left - box.left) / box.width,
      y: (e.clientY - r.top - box.top) / box.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      surfaceRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported */
    }
    const { x, y } = norm(e);
    const id = `${selfId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    drawing.current = { id, lastX: x, lastY: y };
    onStrokeStart({
      id,
      authorId: selfId,
      authorName: selfName,
      color: selfColor,
      points: [{ x, y }],
      bornAt: Date.now(),
    });
  };
  const onMove = (e: React.PointerEvent) => {
    const r = surfaceRef.current?.getBoundingClientRect();
    if (r) setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, visible: true });
    const cur = drawing.current;
    if (!cur) return;
    const { x, y } = norm(e);
    const dx = x - cur.lastX;
    const dy = y - cur.lastY;
    if (dx * dx + dy * dy < MIN_POINT_DIST_SQ) return;
    cur.lastX = x;
    cur.lastY = y;
    onStrokePoint(cur.id, x, y);
  };
  const onUp = (e: React.PointerEvent) => {
    const cur = drawing.current;
    if (cur) {
      const { x, y } = norm(e);
      if (x !== cur.lastX || y !== cur.lastY) onStrokePoint(cur.id, x, y);
      onStrokeEnd(cur.id);
      drawing.current = null;
    }
    try {
      surfaceRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* unsupported */
    }
  };
  const onLeave = () => setPointer((p) => ({ ...p, visible: false }));

  void strokes;
  void hideOthers;
  void selfId;

  return (
    <div
      ref={surfaceRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onLeave}
      className="pointer-events-auto absolute inset-0 z-20"
      style={{ cursor: "none", touchAction: "none" }}
    >
      {pointer.visible && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: pointer.x,
            top: pointer.y,
            transform: "translate(-70%, -77%)",
          }}
        >
          <PenCursor tint={selfColor} size={40} />
        </div>
      )}
    </div>
  );
}

function StrokesSvg({ strokes }: { strokes: Stroke[] }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
      {strokes.map((s) => {
        if (s.points.length < 2) return null;
        const d = strokePath(s.points);
        return (
          <path
            key={s.id}
            d={d}
            stroke={s.color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            style={{
              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.55))",
              animation: `harbor-stroke-fade ${STROKE_LIFETIME_MS}ms cubic-bezier(0.32, 0.72, 0.24, 1) forwards`,
            }}
          />
        );
      })}
    </svg>
  );
}

function strokePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}
