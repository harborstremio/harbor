import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, type RefObject } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import {
  dismissExternalLinkMenu,
  hasExternalLinkAlternateDestination,
} from "@/lib/social/external-link-journey-controller";
import type { ExternalLinkDestinationPreference } from "@/lib/social/external-link-preference";

export type ExternalLinkSplitButtonProps = {
  main: ExternalLinkDestinationPreference;
  alternate: ExternalLinkDestinationPreference | null;
  menuOpen: boolean;
  disabled: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuOpenChange: (open: boolean) => void;
  onSelect: (action: ExternalLinkDestinationPreference, source: "main" | "alternate") => void;
};

function ActionIcon({ action }: { action: ExternalLinkDestinationPreference }) {
  return action === "harbor" ? (
    <HarborMark className="h-4 w-4 shrink-0" />
  ) : (
    <ExternalLink size={16} className="shrink-0" />
  );
}

function actionLabel(action: ExternalLinkDestinationPreference) {
  return action === "harbor" ? "Continue in Harbor" : "Continue in browser";
}

export function ExternalLinkSplitButton({
  main,
  alternate,
  menuOpen,
  disabled,
  menuButtonRef,
  onMenuOpenChange,
  onSelect,
}: ExternalLinkSplitButtonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const hasAlternate = hasExternalLinkAlternateDestination(alternate);

  useEffect(() => {
    if (!menuOpen) return;
    queueMicrotask(() => menuItemRef.current?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        dismissExternalLinkMenu("outside", { setMenuOpen: onMenuOpenChange });
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, onMenuOpenChange]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Choose where to open this link"
      className="relative inline-flex w-full sm:w-auto"
    >
      <button
        type="button"
        onClick={() => onSelect(main, "main")}
        disabled={disabled}
        className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 bg-ink px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50 ${
          hasAlternate ? "rounded-s-[12px]" : "rounded-[12px]"
        }`}
      >
        <span>{actionLabel(main)}</span>
        <ActionIcon action={main} />
      </button>
      {hasAlternate && (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => onMenuOpenChange(!menuOpen)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            event.stopPropagation();
            onMenuOpenChange(true);
          }}
          disabled={disabled}
          aria-label="Choose another destination"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-e-[12px] border-s border-canvas/20 bg-ink text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <ChevronDown
            size={16}
            strokeWidth={2.4}
            className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}
      {hasAlternate && menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Alternate link destination"
          className="absolute end-0 top-[calc(100%+8px)] z-20 min-w-[220px] overflow-hidden rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
        >
          <button
            ref={menuItemRef}
            type="button"
            role="menuitem"
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={() => {
              onSelect(alternate, "alternate");
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] font-medium text-ink transition-colors hover:bg-raised"
          >
            <ActionIcon action={alternate} />
            <span>{actionLabel(alternate)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
