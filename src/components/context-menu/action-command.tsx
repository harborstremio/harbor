import { Check, LoaderCircle } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { ActionConfirmation, ContextAction } from "@/lib/context-actions";
import { t } from "@/lib/i18n";
import { menuItemClass } from "./menu-surface";

export type ActionRunState = {
  phase: "pending" | "success" | "error";
  error?: string;
};

export function MenuIcon({ action }: { action: Pick<ContextAction, "icon" | "active"> }) {
  return (
    <span className="context-menu-icon" aria-hidden="true" data-active={action.active || undefined}>
      {action.icon}
    </span>
  );
}

export function ActionCommand({
  action,
  run,
  state,
  blocked,
  quick = false,
  inMenu = true,
  className,
  children,
}: {
  action: ContextAction;
  run: (id: string, confirmationKey?: string) => Promise<void>;
  state?: ActionRunState;
  blocked: boolean;
  quick?: boolean;
  inMenu?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const restoreTrigger = useRef(false);
  const descriptionId = useId();
  const errorId = useId();
  const pending = state?.phase === "pending";
  const completed = state?.phase === "success" && !!action.confirmation;
  const unavailable = !!action.disabled || blocked || pending || completed;
  const confirming = !!confirmation && !completed;
  const longError =
    !!state?.error && (state.error.length > 110 || /[\r\n]|[A-Z]:[\\/]/i.test(state.error));
  const firstErrorLine = state?.error?.split(/\r?\n/, 1)[0].trim() ?? "";
  const errorSummary =
    firstErrorLine && firstErrorLine.length <= 110 && !/[A-Z]:[\\/]|^\//i.test(firstErrorLine)
      ? firstErrorLine
      : t("Could not complete this action.");
  useLayoutEffect(() => {
    // The safe choice receives focus; a held key cannot request and confirm
    // in one gesture. Restore only after React makes the trigger actionable.
    if (confirmation) cancelButton.current?.focus({ preventScroll: true });
    else if (restoreTrigger.current) {
      restoreTrigger.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
  }, [confirmation]);
  useLayoutEffect(() => {
    setConfirmation(null);
    setDetailsOpen(false);
    setErrorDetailsOpen(false);
  }, [action.confirmation?.key]);
  useLayoutEffect(() => setErrorDetailsOpen(false), [state?.error]);
  const cancel = () => {
    restoreTrigger.current = true;
    setDetailsOpen(false);
    setConfirmation(null);
  };
  const role = inMenu ? "menuitem" : undefined;
  return (
    <div
      data-context-command={action.id}
      data-context-confirmation={confirming || undefined}
      data-action-phase={state?.phase}
      className={inMenu ? undefined : "context-inline-action"}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.repeat) {
          event.preventDefault();
          event.stopPropagation();
        } else if (event.key === "Escape" && confirmation) {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <HoverTooltip
        label={action.reason ?? action.label}
        disabled={!(quick || action.reason) || unavailable || !!confirmation}
        contextMenu={inMenu}
        intentional={action.tooltipIntent === "deliberate"}
        side="top"
        align="center"
        className="context-menu-command-wrap"
      >
        <button
          ref={trigger}
          type="button"
          role={inMenu && action.checked !== undefined ? "menuitemcheckbox" : role}
          aria-checked={inMenu ? action.checked : undefined}
          aria-pressed={!inMenu ? action.checked : undefined}
          data-context-action={action.id}
          aria-disabled={unavailable || undefined}
          aria-busy={pending || undefined}
          disabled={action.disabled || confirming}
          aria-label={quick || children ? action.label : undefined}
          aria-expanded={action.confirmation ? !!confirmation : undefined}
          aria-describedby={confirmation || state?.error ? descriptionId : undefined}
          data-danger={action.danger || undefined}
          data-active={action.active || undefined}
          data-checked={action.checked}
          data-completed={completed || undefined}
          onClick={(event) => {
            if (unavailable || event.detail > 1) return;
            if (action.confirmation) {
              if (!confirmation) setConfirmation(action.confirmation);
            } else void run(action.id);
          }}
          className={className ?? `${menuItemClass} ${quick ? "context-menu-quick-item" : ""}`}
        >
          {children ?? (
            <>
              <MenuIcon
                action={
                  quick && pending
                    ? { ...action, icon: <LoaderCircle className="context-menu-spinner" /> }
                    : action
                }
              />
              <span
                className={quick ? "context-menu-quick-label" : "min-w-0 flex-1 whitespace-normal"}
              >
                {completed ? action.confirmation!.successLabel : action.label}
              </span>
            </>
          )}
          {action.checked !== undefined ? (
            <span
              className="context-menu-membership"
              aria-hidden="true"
              data-checked={action.checked}
              data-pending={pending || undefined}
            >
              {pending ? (
                <LoaderCircle className="context-menu-spinner" size={12} />
              ) : action.checked ? (
                <Check size={12} strokeWidth={2.5} />
              ) : null}
            </span>
          ) : pending && !quick ? (
            <LoaderCircle size={14} className="context-menu-spinner shrink-0" aria-hidden="true" />
          ) : null}
          {!quick && action.shortcut && (
            <span className="context-menu-shortcut" aria-hidden="true">
              {action.shortcut}
            </span>
          )}
        </button>
      </HoverTooltip>
      {confirmation && !completed && (
        <div className="context-menu-confirmation">
          <p id={descriptionId} className="context-menu-confirmation-summary">
            {confirmation.summary ?? confirmation.description}
          </p>
          <div className="context-menu-confirmation-controls">
            <button
              ref={cancelButton}
              type="button"
              role={role}
              data-context-cancel="true"
              aria-disabled={pending || undefined}
              onClick={() => {
                if (!pending) cancel();
              }}
              className={menuItemClass}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              role={role}
              data-context-confirm
              data-danger={action.danger || undefined}
              aria-describedby={descriptionId}
              aria-disabled={unavailable || undefined}
              aria-busy={pending || undefined}
              className={menuItemClass}
              onClick={(event) => {
                if (!unavailable && event.detail < 2) void run(action.id, confirmation.key);
              }}
            >
              {pending ? (confirmation.pendingLabel ?? t("Working…")) : confirmation.confirmLabel}
            </button>
          </div>
          {confirmation.summary && confirmation.summary !== confirmation.description && (
            <>
              <button
                type="button"
                role={role}
                data-context-details
                aria-expanded={detailsOpen}
                className="context-menu-detail-toggle"
                onClick={() => setDetailsOpen((open) => !open)}
              >
                {detailsOpen ? t("Hide details") : t("Details")}
              </button>
              {detailsOpen && (
                <p className="context-menu-action-details">{confirmation.description}</p>
              )}
            </>
          )}
        </div>
      )}
      {state?.error && (
        <div className="context-menu-action-feedback text-danger">
          <p role="alert" id={confirmation ? errorId : descriptionId}>
            {longError ? errorSummary : state.error}
          </p>
          {longError && (
            <>
              <button
                type="button"
                role={role}
                data-context-error-details
                aria-expanded={errorDetailsOpen}
                className="context-menu-detail-toggle"
                onClick={() => setErrorDetailsOpen((open) => !open)}
              >
                {errorDetailsOpen ? t("Hide details") : t("Details")}
              </button>
              {errorDetailsOpen && <p className="context-menu-action-details">{state.error}</p>}
            </>
          )}
        </div>
      )}
      {state?.phase === "success" && (
        <p
          role="status"
          className={
            completed && children ? "context-menu-action-feedback text-success" : "sr-only"
          }
        >
          {action.confirmation?.successLabel ?? t("Saved")}
        </p>
      )}
    </div>
  );
}
