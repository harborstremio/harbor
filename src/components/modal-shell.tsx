import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const EXIT_MS = 190;

export function useModalExit(onClose: () => void, open = true) {
  const [closing, setClosing] = useState(false);
  const fired = useRef(false);
  const close = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    setClosing(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    fired.current = false;
    setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(onClose, reduce ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [closing, onClose]);

  return { closing, close };
}

export function useEscape(onDismiss: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onDismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDismiss, active]);
}

export function ModalShell({
  closing,
  onDismiss,
  width = 640,
  children,
}: {
  closing: boolean;
  onDismiss: () => void;
  width?: number;
  children: ReactNode;
}) {
  useEscape(onDismiss);

  return createPortal(
    <div
      className={`fixed inset-0 z-[240] grid place-items-center p-8 ${
        closing ? "animate-scrim-out" : "animate-scrim-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)` }}
        className={`flex max-h-[86vh] flex-col overflow-hidden rounded-md bg-surface ${
          closing ? "animate-dialog-out" : "animate-dialog-in"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
