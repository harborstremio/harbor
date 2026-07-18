import { useEffect, useState } from "react";
import type { Stroke } from "@/components/player/draw-canvas";
import { nameColor } from "@/lib/together/colors";
import type { IncomingDraw } from "@/lib/together/provider";

const STROKE_GC_MS = 9500;

type SendDraw = (
  strokeId: string,
  phase: "start" | "point" | "end" | "clear",
  path: string,
  x?: number,
  y?: number,
  color?: string,
) => void;

export function useDrawMode(params: {
  inRoom: boolean;
  participantCount: number;
  clientId: string;
  topPath: string;
  onIncomingDraw: (cb: (e: IncomingDraw) => void) => () => void;
  sendDraw: SendDraw;
}) {
  const { inRoom, participantCount, clientId, topPath, onIncomingDraw, sendDraw } = params;
  const [drawMode, setDrawMode] = useState(false);
  const [hideOthersDrawings, setHideOthersDrawings] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  useEffect(() => {
    if (drawMode && (!inRoom || participantCount <= 1)) {
      setDrawMode(false);
    }
  }, [drawMode, inRoom, participantCount]);

  const onDrawStart = (s: Stroke) => {
    setStrokes((prev) => [...prev, { ...s, path: topPath }]);
    if (inRoom) {
      const p = s.points[0];
      sendDraw(s.id, "start", topPath, p?.x, p?.y, s.color);
    }
  };
  const onDrawPoint = (id: string, x: number, y: number) => {
    setStrokes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, points: [...s.points, { x, y }] } : s)),
    );
    if (inRoom) sendDraw(id, "point", topPath, x, y);
  };
  const onDrawEnd = (id: string) => {
    setStrokes((prev) => prev.filter((s) => Date.now() - s.bornAt < STROKE_GC_MS));
    if (inRoom) sendDraw(id, "end", topPath);
  };
  const clearStrokes = () => {
    setStrokes((prev) => prev.filter((s) => s.path !== topPath));
    if (inRoom) sendDraw("", "clear", topPath);
  };

  useEffect(() => {
    if (!inRoom) return;
    return onIncomingDraw((e) => {
      if (e.from === clientId) return;
      if (e.path !== topPath) return;
      if (e.phase === "clear") {
        setStrokes((prev) => prev.filter((s) => s.path !== topPath));
        return;
      }
      if (e.x == null || e.y == null) {
        if (e.phase === "end")
          setStrokes((prev) => prev.filter((s) => Date.now() - s.bornAt < STROKE_GC_MS));
        return;
      }
      const point = { x: e.x, y: e.y };
      setStrokes((prev) => {
        const idx = prev.findIndex((s) => s.id === e.strokeId);
        if (idx === -1) {
          const stroke: Stroke = {
            id: e.strokeId,
            authorId: e.from,
            authorName: e.name,
            color: e.color || nameColor(e.name),
            points: [point],
            bornAt: Date.now(),
            path: topPath,
          };
          return [...prev, stroke];
        }
        const next = prev.slice();
        next[idx] = { ...next[idx], points: [...next[idx].points, point] };
        return next;
      });
    });
  }, [inRoom, onIncomingDraw, clientId, topPath]);

  useEffect(() => {
    if (strokes.length === 0) return;
    const id = window.setInterval(() => {
      setStrokes((prev) => {
        const now = Date.now();
        const live = prev.filter((s) => now - s.bornAt < STROKE_GC_MS);
        return live.length === prev.length ? prev : live;
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [strokes.length]);

  useEffect(() => {
    setStrokes((prev) => {
      const live = prev.filter((s) => s.path === topPath);
      return live.length === prev.length ? prev : live;
    });
  }, [topPath]);

  return {
    drawMode,
    setDrawMode,
    hideOthersDrawings,
    setHideOthersDrawings,
    strokes,
    onDrawStart,
    onDrawPoint,
    onDrawEnd,
    clearStrokes,
  };
}
