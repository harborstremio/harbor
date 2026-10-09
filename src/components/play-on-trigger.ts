import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";

export type PlayOnRequest = {
  meta: Meta;
  episode?: PlayEpisode;
};

const HOLD_MS = 480;
const MOVE_TOLERANCE_PX = 10;

let current: PlayOnRequest | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function openPlayOn(request: PlayOnRequest): void {
  current = request;
  emit();
}

export function closePlayOn(): void {
  if (!current) return;
  current = null;
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot(): PlayOnRequest | null {
  return current;
}

export function usePlayOnRequest(): PlayOnRequest | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export type PlayOnTriggerProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
};

export function usePlayOnTrigger(resolve: () => PlayOnRequest | null): PlayOnTriggerProps {
  const timer = useRef(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  const cancel = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = 0;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = 0;
        const request = resolveRef.current();
        if (!request) return;
        fired.current = true;
        openPlayOn(request);
      }, HOLD_MS);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = origin.current;
      if (!start || !timer.current) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  return {
    onPointerDown,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onPointerMove,
    onClickCapture,
  };
}
