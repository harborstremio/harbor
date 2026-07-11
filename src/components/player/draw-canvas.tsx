import { useRef, useState } from "react";

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

export function StrokesLayer({
  strokes,
  hideOthers,
  selfId,
}: {
  strokes: Stroke[];
  hideOthers: boolean;
  selfId: string;
}) {
  const visibleStrokes = hideOthers ? strokes.filter((s) => s.authorId === selfId) : strokes;
  if (visibleStrokes.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 15 }}>
      <StrokesSvg strokes={visibleStrokes} />
    </div>
  );
}

export function DrawCanvas({
  enabled,
  selfId,
  selfName,
  selfColor,
  hideOthers,
  strokes,
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
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
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
