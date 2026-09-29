import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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

export function useEscape(
  onDismiss: () => void,
  active = true,
  scope?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented || document.querySelector("[data-dropdown-menu]")) return;
      if (scope) {
        // A nested career profile must not dismiss the event behind it as well.
        const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
        if (dialogs[dialogs.length - 1] !== scope.current) return;
      }
      e.stopImmediatePropagation();
      onDismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDismiss, active, scope]);
}

export function ModalShell({
  closing,
  onDismiss,
  width = 640,
  labelledBy,
  backdropClassName,
  portalTarget,
  children,
}: {
  closing: boolean;
  onDismiss: () => void;
  width?: number;
  labelledBy?: string;
  backdropClassName?: string;
  portalTarget?: Element;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscape(onDismiss, true, dialogRef);

  return createPortal(
    <div
      className={`fixed inset-0 z-[240] grid place-items-center p-8 ${backdropClassName ?? ""} ${
        closing ? "animate-scrim-out" : "animate-scrim-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-harbor-modal-escape
        aria-labelledby={labelledBy}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)` }}
        className={`flex max-h-[86vh] flex-col overflow-hidden rounded-md bg-surface ${
          closing ? "animate-dialog-out" : "animate-dialog-in"
        }`}
      >
        {children}
      </div>
    </div>,
    portalTarget ?? document.body,
  );
}
