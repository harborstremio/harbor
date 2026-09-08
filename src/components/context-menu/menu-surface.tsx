import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { fitMenu } from "@/lib/context-actions";

const ExecutionContext = createContext<{
  busy: boolean;
  acquire: () => boolean;
  release: () => void;
} | null>(null);
export function useMenuExecution() {
  return useContext(ExecutionContext);
}

export const menuItemClass =
  "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] text-ink outline-none transition-colors hover:bg-raised focus-visible:bg-raised disabled:cursor-not-allowed disabled:text-ink-subtle/55 aria-disabled:cursor-not-allowed aria-disabled:text-ink-subtle/55";

export function selectMenuFocusTarget<T>(
  previous: readonly T[],
  current: readonly T[],
  focused: T,
): T | null {
  if (current.includes(focused)) return focused;
  const index = previous.indexOf(focused);
  return (
    previous.slice(index + 1).find((item) => current.includes(item)) ??
    previous
      .slice(0, index)
      .reverse()
      .find((item) => current.includes(item)) ??
    current[0] ??
    null
  );
}

export function menuItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)")).filter(
    (item) => item.closest("[data-harbor-menu-panel]") === panel,
  );
}

export function useMenuFocus(ref: RefObject<HTMLElement | null>, enabled = true, autofocus = true) {
  const focusOnOpen = useRef(autofocus);
  focusOnOpen.current = autofocus;
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!enabled || !panel) return;
    let previous = menuItems(panel);
    let focused: HTMLElement | null = null;
    const remember = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest("[data-harbor-menu-panel]") !== panel) return;
      focused = event.target;
      previous = menuItems(panel);
    };
    panel.addEventListener("focusin", remember);
    if (focusOnOpen.current) (previous[0] ?? panel).focus({ preventScroll: true });
    const observer = new MutationObserver(() => {
      const current = menuItems(panel);
      const active = document.activeElement;
      // A dialog or another submenu owns its own focus. Only repair focus lost
      // by an action disappearing or becoming unavailable in this panel.
      if (focused && (active === focused || active === document.body || active === panel)) {
        const next = selectMenuFocusTarget(previous, current, focused) ?? panel;
        if (next !== active) next.focus({ preventScroll: true });
      }
      previous = current;
    });
    observer.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    return () => {
      observer.disconnect();
      panel.removeEventListener("focusin", remember);
    };
  }, [ref, enabled]);
}

export function MenuSurface({
  point,
  children,
  onClose,
  label,
  width = 244,
  isValid,
}: {
  point: { x: number; y: number };
  children: ReactNode;
  onClose: (restoreFocus?: boolean) => void;
  label?: string;
  width?: number;
  isValid?: () => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(point);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const validity = useRef(isValid);
  validity.current = isValid;
  const execution = {
    busy,
    acquire: () => {
      if (locked.current || validity.current?.() === false) return false;
      locked.current = true;
      setBusy(true);
      return true;
    },
    release: () => {
      locked.current = false;
      setBusy(false);
    },
  };
  const close = useRef(onClose);
  close.current = onClose;
  useMenuFocus(ref);
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const measure = () => {
      const bounds = menu.getBoundingClientRect();
      const viewport = window.visualViewport;
      setPosition(
        fitMenu(point, bounds, {
          width: viewport?.width ?? innerWidth,
          height: viewport?.height ?? innerHeight,
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [point.x, point.y]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("[data-harbor-context-layer]"))
        return;
      if (event.button === 0) {
        // Consume the dismissal gesture before the underlying card sees it.
        event.preventDefault();
        event.stopImmediatePropagation();
        const consumeClick = (click: MouseEvent) => {
          click.preventDefault();
          click.stopImmediatePropagation();
        };
        document.addEventListener("click", consumeClick, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener("click", consumeClick, true), 400);
      }
      close.current(false);
    };
    const keydown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const panel =
        active instanceof Element
          ? active.closest<HTMLElement>("[data-harbor-menu-panel]")
          : ref.current;
      if (
        active instanceof Element &&
        active.closest("[role='dialog']") &&
        panel?.hasAttribute("data-context-submenu")
      )
        return;
      if (event.key === "Tab") {
        // Restore the origin; the browser's native Tab then leaves it normally.
        event.stopImmediatePropagation();
        close.current(true);
        return;
      }
      if (event.key === "Escape") {
        if (panel?.hasAttribute("data-context-submenu")) {
          if (event.target === window && active instanceof HTMLElement) {
            event.preventDefault();
            event.stopImmediatePropagation();
            active.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
            );
          }
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current(true);
        return;
      }
      if (active instanceof Element && active.closest("input,textarea,[contenteditable='true']"))
        return;
      // Harbor's gamepad adapter dispatches at window rather than the focused
      // control. Re-target these keys so submenu and activation behavior match.
      if (
        event.target === window &&
        active instanceof HTMLElement &&
        panel &&
        ["Enter", " ", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Enter" || event.key === " ") active.click();
        else
          active.dispatchEvent(
            new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true }),
          );
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !panel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const items = menuItems(panel);
      if (!items.length) return;
      const index = items.indexOf(active as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[next].focus({ preventScroll: true });
      items[next].scrollIntoView({ block: "nearest" });
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", keydown, true);
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label={label}
      aria-busy={busy || undefined}
      data-harbor-context-layer
      data-harbor-menu-panel
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={{
        left: position.x,
        top: position.y,
        width,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100dvh - 16px)",
        zIndex: 2147482000,
      }}
      className="fixed flex flex-col overflow-y-auto rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] motion-safe:animate-popover-in"
    >
      <ExecutionContext.Provider value={execution}>{children}</ExecutionContext.Provider>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
