import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import "./reminder-modal.css";

/** The reminder editor is a separate overlay, even when opened from an event dialog. */
export function ReminderDialog({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  useSectionBack(onClose, true, true);
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = closeButton.current?.closest<HTMLElement>('[role="dialog"]');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || (event.target as Element)?.closest?.("[data-dropdown-menu]"))
        return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      const items = [
        ...(dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
        ) || []),
      ].filter((item) => item.getClientRects().length > 0);
      if (
        !dialog?.contains(document.activeElement) ||
        document.activeElement === (event.shiftKey ? items[0] : items.at(-1))
      ) {
        event.preventDefault();
        (event.shiftKey ? items.at(-1) : items[0])?.focus();
      }
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", trap, true);
    return () => {
      window.removeEventListener("keydown", trap, true);
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <ModalShell
      closing={false}
      onDismiss={onClose}
      width={480}
      labelledBy={titleId}
      backdropClassName="sh-reminder-backdrop"
    >
      <div className="sh-reminder-modal-head">
        <h2 id={titleId}>{t("Remind me")}</h2>
        <button
          ref={closeButton}
          type="button"
          className="sh-icon"
          onClick={onClose}
          aria-label={t("Close")}
        >
          <X size={19} />
        </button>
      </div>
      <div className="sh-reminder-modal-body">{children}</div>
    </ModalShell>
  );
}
