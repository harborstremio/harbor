import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Toast = { id: number; text: string };

const listeners = new Set<(t: Toast) => void>();
let seq = 0;

export function emitListToast(text: string): void {
  const toast = { id: ++seq, text };
  for (const fn of listeners) fn(toast);
}

export function ListToastHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onToast = (t: Toast) => {
      setToast(t);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setToast(null), 2400);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[260] -translate-x-1/2 animate-popover-in">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-edge-soft bg-elevated/95 py-1.5 ps-1.5 pe-4 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Check size={13} strokeWidth={2.6} />
        </span>
        <span className="text-[12.5px] font-medium text-ink">{toast.text}</span>
      </div>
    </div>,
    document.body,
  );
}
