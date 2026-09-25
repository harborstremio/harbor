import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { fitMenu } from "@/lib/context-actions";
import { menuReveal, menuRevealStyle, type MenuReveal } from "./menu-placement";
import { contextMenuPresentation } from "./menu-presentation";
import { useMenuPopout } from "./use-menu-popout";
import { focusMenuCommand } from "@/lib/menu-interaction";

const ExecutionContext = createContext<{
  busy: boolean;
  closing: boolean;
  pendingCount: number;
  acquire: (id?: string, independent?: boolean) => boolean;
  release: (id?: string) => void;
} | null>(null);
export function useMenuExecution() {
  return useContext(ExecutionContext);
}

function consumeDismissalGesture(start: PointerEvent) {
  const owner = (start.target as Element).ownerDocument;
  const view = owner.defaultView;
  let released = false;
  const matches = (event: PointerEvent) => event.pointerId === start.pointerId;
  const cleanup = () => {
    owner.removeEventListener("pointerdown", nextGesture, true);
    owner.removeEventListener("pointerup", release, true);
    owner.removeEventListener("pointercancel", cancel, true);
    owner.removeEventListener("click", click, true);
    view?.removeEventListener("blur", cleanup);
  };
  const nextGesture = (event: PointerEvent) => {
    if (event !== start && matches(event) && event.button === 0) cleanup();
  };
  const release = (event: PointerEvent) => {
    if (!matches(event) || event.button !== 0) return;
    released = true;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const cancel = (event: PointerEvent) => {
    if (matches(event)) cleanup();
  };
  const click = (event: MouseEvent) => {
    if (!released || event.button !== 0 || event.detail === 0) return;
    // Older WebViews emit MouseEvent clicks; newer ones retain pointer identity.
    if ("pointerId" in event && (event as PointerEvent).pointerId !== start.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cleanup();
  };
  // These listeners outlive the disappearing menu, but only own this gesture.
  owner.addEventListener("pointerdown", nextGesture, true);
  owner.addEventListener("pointerup", release, true);
  owner.addEventListener("pointercancel", cancel, true);
  owner.addEventListener("click", click, true);
  view?.addEventListener("blur", cleanup);
}

export const menuItemClass = "context-menu-item";

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
  return Array.from(
    panel.querySelectorAll<HTMLElement>("[role^='menuitem']:not(:disabled), [data-context-search]"),
  ).filter((item) => item.closest("[data-harbor-menu-panel]") === panel);
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
    if (focusOnOpen.current)
      (
        previous.find((item) => !item.closest("[data-context-quick]")) ??
        previous[0] ??
        panel
      ).focus({ preventScroll: true });
    const observer = new MutationObserver(() => {
      const current = menuItems(panel);
      const active = document.activeElement;
      // A dialog or another submenu owns its own focus. Only repair focus lost
      // by an action disappearing or becoming unavailable in this panel.
      if (focused && (active === focused || active === document.body || active === panel)) {
        const next = selectMenuFocusTarget(previous, current, focused) ?? panel;
        if (next !== active) {
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
        }
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
  quickActions,
  phase = "open",
  onExitComplete,
}: {
  point: { x: number; y: number };
  children: ReactNode;
  onClose: (restoreFocus?: boolean) => void;
  label?: string;
  width?: number;
  isValid?: () => boolean;
  quickActions?: ReactNode;
  phase?: "open" | "closing";
  onExitComplete?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const popout = contextMenuPresentation === "popout";
  const [position, setPosition] = useState(point);
  const [reveal, setReveal] = useState<MenuReveal | null>(null);
  const opening = useRef<MenuReveal | null>(null);
  const latestReveal = useRef<MenuReveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const legacyAction = useRef(Symbol("legacy menu action"));
  const running = useRef(new Map<string | symbol, boolean>());
  const validity = useRef(isValid);
  validity.current = () => phase === "open" && isValid?.() !== false;
  const exitComplete = useRef(onExitComplete);
  exitComplete.current = onExitComplete;
  useMenuPopout(motionRef, {
    enabled: popout,
    ready: reveal != null,
    closing: phase === "closing",
    getOrigin: () =>
      latestReveal.current
        ? { x: latestReveal.current.originX, y: latestReveal.current.originY }
        : undefined,
    onExitComplete: () => exitComplete.current?.(),
  });
  useEffect(() => {
    if (popout || phase !== "closing") return;
    const timer = window.setTimeout(
      () => exitComplete.current?.(),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120,
    );
    return () => window.clearTimeout(timer);
  }, [phase, popout]);
  const execution = {
    busy: busy || phase === "closing",
    closing: phase === "closing",
    pendingCount,
    acquire: (id?: string, independent = false) => {
      const key = id ?? legacyAction.current;
      if (
        running.current.has(key) ||
        [...running.current.values()].some(Boolean) ||
        (!independent && running.current.size > 0) ||
        validity.current?.() === false
      )
        return false;
      running.current.set(key, !independent);
      setBusy(!independent);
      setPendingCount(running.current.size);
      return true;
    },
    release: (id?: string) => {
      running.current.delete(id ?? legacyAction.current);
      setBusy([...running.current.values()].some(Boolean));
      setPendingCount(running.current.size);
    },
  };
  const close = useRef(onClose);
  close.current = onClose;
  useMenuFocus(ref, reveal != null);
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    opening.current = null;
    const measure = () => {
      const bounds = menu.getBoundingClientRect();
      const viewport = window.visualViewport;
      const fitted = fitMenu(point, bounds, {
        width: viewport?.width ?? innerWidth,
        height: viewport?.height ?? innerHeight,
      });
      setPosition(fitted);
      if (popout) latestReveal.current = menuReveal(point, fitted, bounds);
      if (opening.current == null) {
        opening.current = menuReveal(point, fitted, bounds);
        setReveal(opening.current);
      }
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
  }, [point.x, point.y, popout]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("[data-harbor-context-layer]"))
        return;
      if (event.button === 0) {
        // Consume the dismissal gesture before the underlying card sees it.
        event.preventDefault();
        event.stopImmediatePropagation();
        consumeDismissalGesture(event);
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
        if (
          (panel && active instanceof Element && active.closest("[data-context-confirmation]")) ||
          panel?.hasAttribute("data-context-submenu")
        ) {
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
      if (
        active instanceof HTMLElement &&
        active.matches("[data-context-search]") &&
        event.target === window
      ) {
        if (["Enter", "ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          active.dispatchEvent(
            new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true }),
          );
        }
        return;
      }
      if (active instanceof Element && active.closest("input,textarea,[contenteditable='true']"))
        return;
      if (event.repeat && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const strip =
        active instanceof HTMLElement &&
        !active.closest(".context-menu-confirmation,.context-menu-action-feedback")
          ? active.closest<HTMLElement>("[data-context-quick]")
          : null;
      if (strip && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const items = Array.from(
          strip.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)"),
        ).filter(
          (item) => !item.closest(".context-menu-confirmation,.context-menu-action-feedback"),
        );
        const rtl = getComputedStyle(strip).direction === "rtl";
        const delta = (event.key === "ArrowRight") !== rtl ? 1 : -1;
        const next =
          items[(items.indexOf(active as HTMLElement) + delta + items.length) % items.length];
        if (next) focusMenuCommand(next);
        return;
      }
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
      const primary = items.filter((item) => !item.closest("[data-context-quick]"));
      if (strip && primary.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        const target = event.key === "ArrowDown" ? primary[0] : primary[primary.length - 1];
        focusMenuCommand(target);
        target.scrollIntoView({ block: "nearest" });
        return;
      }
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      focusMenuCommand(items[next]);
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
      data-menu-phase={phase}
      data-menu-presentation={popout ? "popout" : undefined}
      data-menu-positioned={reveal != null || undefined}
      onClickCapture={(event) => {
        if (phase === "closing") {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={
        {
          left: position.x,
          top: position.y,
          width,
          maxWidth: "calc(100vw - 16px)",
          maxHeight: "calc(100dvh - 16px)",
          zIndex: 2147482000,
          visibility: reveal == null ? "hidden" : undefined,
          ...menuRevealStyle(reveal),
        } as CSSProperties
      }
      className="fixed flex flex-col context-menu-position"
    >
      <div ref={motionRef} className="context-menu-motion context-menu-scroll context-menu-surface">
        <ExecutionContext.Provider value={execution}>
          {quickActions}
          {children}
        </ExecutionContext.Provider>
      </div>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
