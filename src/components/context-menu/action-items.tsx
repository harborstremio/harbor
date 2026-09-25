import { ChevronRight } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HoverTooltip } from "@/components/hover-tooltip";
import {
  executeContextAction,
  findAction,
  filterContextActions,
  type ActionSource,
  type ContextAction,
} from "@/lib/context-actions";
import {
  menuItemClass,
  menuItems,
  selectMenuFocusTarget,
  useMenuExecution,
  useMenuFocus,
} from "./menu-surface";
import { t } from "@/lib/i18n";
import { menuRevealStyle, submenuPlacement, type MenuReveal } from "./menu-placement";
import { ActionCommand, MenuIcon, type ActionRunState } from "./action-command";
import { emitListToast } from "@/components/lists/list-toast";
import { contextMenuPresentation } from "./menu-presentation";
import { settledMenuAnchor } from "./menu-popout";
import { useMenuPopout } from "./use-menu-popout";

export { MenuIcon } from "./action-command";

function retainPendingActions(
  current: ContextAction[],
  previous: ContextAction[],
  states: Record<string, ActionRunState>,
): ContextAction[] {
  const result = current.map((action) => ({
    ...action,
    children:
      action.children &&
      retainPendingActions(
        action.children,
        previous.find((old) => old.id === action.id)?.children ?? [],
        states,
      ),
  }));
  previous.forEach((action, index) => {
    if (result.some((next) => next.id === action.id)) return;
    const retainedChildren = action.children && retainPendingActions([], action.children, states);
    const state = states[action.id];
    if (state?.phase === "pending" || (action.confirmation && state) || retainedChildren?.length)
      result.splice(Math.min(index, result.length), 0, { ...action, children: retainedChildren });
  });
  return result;
}

export function restoreMenuAction(actionId: string, childId?: string) {
  const find = (id: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-context-action]")).find(
      (button) => button.dataset.contextAction === id && !button.disabled,
    );
  const trigger = find(actionId);
  if (!trigger) return false;
  trigger.focus({ preventScroll: true });
  if (childId) {
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: document.documentElement.dir === "rtl" ? "ArrowLeft" : "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    requestAnimationFrame(() => {
      if (!trigger.isConnected) return;
      const child = find(childId);
      child?.focus({ preventScroll: true });
      child?.scrollIntoView({ block: "nearest" });
    });
  }
  return true;
}

export function ActionItems({
  source,
  onClose,
  variant = "list",
  className,
  children,
}: {
  source: ActionSource;
  onClose: (restoreFocus?: boolean) => void;
  variant?: "list" | "quick" | "inline";
  className?: string;
  children?: ReactNode;
}) {
  const [states, setStates] = useState<Record<string, ActionRunState>>({});
  const pending = useRef(new Set<string>());
  const alive = useRef(true);
  const previous = useRef<ContextAction[]>([]);
  const execution = useMenuExecution();
  const [, refresh] = useState(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (source.subscribe) return source.subscribe(() => refresh((value) => value + 1));
    const timer = window.setInterval(() => refresh((value) => value + 1), 300);
    return () => clearInterval(timer);
  }, [source.subscribe]);
  const actions = retainPendingActions(source.actions(), previous.current, states);
  previous.current = actions;
  const run = async (id: string, confirmationKey?: string) => {
    const action = findAction(source.actions(), id);
    const independent = action?.dismiss === "keep-open" && !action.confirmation;
    if (pending.current.has(id) || (execution && !execution.acquire(id, independent))) return;
    pending.current.add(id);
    setStates((value) => ({ ...value, [id]: { phase: "pending" } }));
    try {
      const result = await executeContextAction(source, id, { confirmationKey });
      if (alive.current) {
        setStates((value) => ({ ...value, [id]: { phase: "success" } }));
        if (result.dismiss === "on-success") onClose(result.restoreFocus);
      } else if (action?.checked !== undefined || action?.confirmation) {
        emitListToast(action.confirmation?.successLabel ?? t("Saved"));
      }
    } catch (cause) {
      const error =
        cause instanceof Error ? t(cause.message) : t("The action could not be completed.");
      if (alive.current) setStates((value) => ({ ...value, [id]: { phase: "error", error } }));
      else emitListToast(error, "error");
    } finally {
      pending.current.delete(id);
      execution?.release(id);
    }
  };
  return (
    <Rows
      actions={actions}
      run={run}
      states={states}
      busy={execution?.busy ? "pending" : null}
      pendingCount={execution?.pendingCount ?? pending.current.size}
      quick={variant === "quick"}
      inMenu={variant !== "inline"}
      className={className}
      triggerContent={children}
    />
  );
}

/** Ordinary row buttons share the same confirmation and execution policy. */
export function ConfirmableAction({
  source,
  actionId,
  className,
  children,
}: {
  source: ActionSource;
  actionId: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <ActionItems
      source={{
        ...source,
        actions: () => {
          const action = findAction(source.actions(), actionId);
          return action ? [action] : [];
        },
      }}
      onClose={() => {}}
      variant="inline"
      className={className}
    >
      {children}
    </ActionItems>
  );
}

export function QuickActions(props: {
  source: ActionSource;
  onClose: (restoreFocus?: boolean) => void;
}) {
  return <ActionItems {...props} variant="quick" />;
}

function Rows({
  actions,
  run,
  busy,
  states,
  pendingCount,
  quick = false,
  inMenu = true,
  className,
  triggerContent,
}: {
  actions: ContextAction[];
  run: (id: string, confirmationKey?: string) => Promise<void>;
  busy: string | null;
  states: Record<string, ActionRunState>;
  pendingCount: number;
  quick?: boolean;
  inMenu?: boolean;
  className?: string;
  triggerContent?: ReactNode;
}) {
  return (
    <div
      className={quick ? "context-menu-quick" : undefined}
      data-context-quick={quick || undefined}
      style={quick ? ({ "--context-quick-count": actions.length } as CSSProperties) : undefined}
    >
      {actions.map((action, index) => (
        <div
          key={action.id}
          style={quick ? ({ "--context-quick-index": index + 1 } as CSSProperties) : undefined}
        >
          {!quick &&
            index > 0 &&
            (action.sectionLabel || actions[index - 1].sectionLabel
              ? action.sectionLabel !== actions[index - 1].sectionLabel
              : action.group !== actions[index - 1].group) && (
              <div role="separator" className="context-menu-separator" />
            )}
          {!quick &&
            action.sectionLabel &&
            action.sectionLabel !== actions[index - 1]?.sectionLabel && (
              <div className="context-menu-section-label">{action.sectionLabel}</div>
            )}
          {action.children?.length ? (
            <Submenu
              action={action}
              run={run}
              busy={busy}
              states={states}
              pendingCount={pendingCount}
            />
          ) : (
            <ActionCommand
              action={action}
              run={run}
              state={states[action.id]}
              quick={quick}
              blocked={
                busy != null ||
                (pendingCount > 0 && (action.dismiss !== "keep-open" || !!action.confirmation))
              }
              inMenu={inMenu}
              className={className}
            >
              {triggerContent}
            </ActionCommand>
          )}
        </div>
      ))}
    </div>
  );
}

function Submenu({
  action,
  run,
  busy,
  states,
  pendingCount,
}: {
  action: ContextAction;
  run: (id: string, confirmationKey?: string) => Promise<void>;
  busy: string | null;
  states: Record<string, ActionRunState>;
  pendingCount: number;
}) {
  const execution = useMenuExecution();
  const [open, setOpen] = useState(false);
  const popout = contextMenuPresentation === "popout";
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [position, setPosition] = useState({ x: 8, y: 8 });
  const [revealOrigin, setRevealOrigin] = useState<MenuReveal | null>(null);
  const openingOrigin = useRef<MenuReveal | null>(null);
  const latestReveal = useRef<MenuReveal | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const keyboard = useRef(false);
  const rtl = document.documentElement.dir === "rtl";
  const children = filterContextActions(action.children ?? [], query);
  const cancel = () => window.clearTimeout(timer.current);
  const visuallyClosing = closing || !!execution?.closing || (popout && busy === "closing");
  useMenuPopout(motionRef, {
    enabled: popout,
    ready: open && revealOrigin != null,
    closing: visuallyClosing,
    getOrigin: () =>
      latestReveal.current
        ? { x: latestReveal.current.originX, y: latestReveal.current.originY }
        : undefined,
    onExitComplete: () => {
      setOpen(false);
      setClosing(false);
    },
  });
  const dismiss = () => {
    cancel();
    setClosing(true);
    if (popout) return;
    timer.current = window.setTimeout(
      () => {
        setOpen(false);
        setClosing(false);
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 100,
    );
  };
  useMenuFocus(panel, open && revealOrigin != null, keyboard.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (action.disabled || busy != null) cancel();
    if (action.disabled) setOpen(false);
  }, [action.disabled, busy]);
  useLayoutEffect(() => {
    if (!open) {
      openingOrigin.current = null;
      setRevealOrigin(null);
      return;
    }
    if (!trigger.current || !panel.current) return;
    const button = trigger.current;
    const menu = panel.current;
    const parent = button.closest<HTMLElement>("[data-harbor-menu-panel]");
    const previousParentItems = parent ? menuItems(parent) : [];
    const measure = () => {
      const visualRect = button.getBoundingClientRect();
      const parentBounds = parent?.getBoundingClientRect();
      const parentSurface = parent?.querySelector<HTMLElement>(":scope > .context-menu-motion");
      const rect =
        popout && parentBounds && parentSurface
          ? settledMenuAnchor(visualRect, parentSurface.getBoundingClientRect(), parentBounds)
          : visualRect;
      if (parentBounds && (rect.bottom <= parentBounds.top || rect.top >= parentBounds.bottom)) {
        setOpen(false);
        return;
      }
      const bounds = menu.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      const placement = submenuPlacement(rect, bounds, { width, height }, rtl);
      latestReveal.current = placement.reveal;
      setSide(placement.side);
      setPosition({ x: placement.x, y: placement.y });
      if (openingOrigin.current == null) {
        openingOrigin.current = placement.reveal;
        setRevealOrigin(placement.reveal);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(button);
    observer.observe(menu);
    if (parent) observer.observe(parent);
    const mutations = new MutationObserver(measure);
    if (parent)
      mutations.observe(parent, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
      });
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      if (menu.contains(document.activeElement))
        queueMicrotask(() => {
          if (parent?.isConnected && document.activeElement === document.body)
            (selectMenuFocusTarget(previousParentItems, menuItems(parent), button) ?? parent).focus(
              { preventScroll: true },
            );
        });
    };
  }, [open, rtl, popout]);
  const leave = () => {
    cancel();
    timer.current = window.setTimeout(() => {
      if (!panel.current?.contains(document.activeElement)) dismiss();
    }, 240);
  };
  return (
    <div
      onMouseEnter={() => {
        cancel();
        if (action.disabled || busy != null) return;
        keyboard.current = false;
        setClosing(false);
        timer.current = window.setTimeout(() => setOpen(true), 160);
      }}
      onMouseLeave={leave}
    >
      <HoverTooltip
        label={action.reason ?? action.label}
        disabled={!action.reason || open || busy != null}
        contextMenu
        className="context-menu-command-wrap"
      >
        <button
          ref={trigger}
          role="menuitem"
          data-context-action={action.id}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-disabled={action.disabled || busy != null || undefined}
          disabled={action.disabled}
          className={menuItemClass}
          onClick={() => {
            if (action.disabled || busy != null) return;
            cancel();
            keyboard.current = true;
            if (open) dismiss();
            else {
              setClosing(false);
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) {
              event.preventDefault();
              event.stopPropagation();
              if (action.disabled || busy != null) return;
              keyboard.current = true;
              cancel();
              setClosing(false);
              if (open && panel.current)
                (menuItems(panel.current)[0] ?? panel.current).focus({ preventScroll: true });
              setOpen(true);
            }
          }}
        >
          <MenuIcon action={action} />
          <span className="min-w-0 flex-1 whitespace-normal">{action.label}</span>
          <ChevronRight
            size={14}
            className="context-menu-chevron rtl:rotate-180"
            aria-hidden="true"
          />
        </button>
      </HoverTooltip>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            tabIndex={-1}
            aria-label={action.label}
            data-harbor-context-layer
            data-harbor-menu-panel
            data-context-submenu
            data-menu-phase={visuallyClosing ? "closing" : "open"}
            data-menu-presentation={popout ? "popout" : undefined}
            data-menu-side={side}
            data-menu-variant={action.submenuVariant}
            data-menu-positioned={revealOrigin != null || undefined}
            onMouseEnter={() => {
              cancel();
              setClosing(false);
            }}
            onMouseLeave={leave}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" || event.key === (rtl ? "ArrowRight" : "ArrowLeft")) {
                event.preventDefault();
                event.stopPropagation();
                dismiss();
                trigger.current?.focus();
              }
            }}
            style={
              {
                left: position.x,
                top: position.y,
                zIndex: 2147482001,
                maxHeight:
                  action.submenuVariant === "navigation"
                    ? undefined
                    : "min(22.5rem, calc(100dvh - 16px))",
                visibility: revealOrigin == null ? "hidden" : undefined,
                ...menuRevealStyle(revealOrigin),
              } as CSSProperties
            }
            className="context-menu-position fixed flex w-64 max-w-[calc(100vw-16px)] flex-col"
          >
            <div
              ref={motionRef}
              className="context-menu-motion context-menu-scroll context-menu-surface"
            >
              {action.searchable && (
                <div className="sticky top-0 z-10 bg-elevated p-1">
                  <input
                    data-context-search
                    aria-label={action.searchPlaceholder ?? t("Search destinations")}
                    placeholder={action.searchPlaceholder ?? t("Search destinations")}
                    value={query}
                    readOnly={!editing}
                    onClick={() => setEditing(true)}
                    onBlur={() => setEditing(false)}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        event.stopPropagation();
                        const items = panel.current
                          ? menuItems(panel.current).filter(
                              (item) => !item.hasAttribute("data-context-search"),
                            )
                          : [];
                        const next = event.key === "ArrowDown" ? items[0] : items[items.length - 1];
                        next?.focus({ preventScroll: true });
                        next?.scrollIntoView({ block: "nearest" });
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        setEditing(true);
                      } else if (
                        !editing &&
                        event.key.length === 1 &&
                        !event.ctrlKey &&
                        !event.metaKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        setEditing(true);
                        setQuery((value) => value + event.key);
                      }
                    }}
                    className="h-9 w-full rounded-lg border border-edge bg-raised px-2.5 text-[13px] text-ink outline-none focus-visible:border-accent"
                  />
                </div>
              )}
              {query && !children.some((child) => child.group !== "create") && (
                <p role="status" className="px-3 py-2 text-[12px] text-ink-muted">
                  {t("No destinations found")}
                </p>
              )}
              <Rows
                actions={children}
                run={run}
                busy={(popout ? visuallyClosing : closing) ? "closing" : busy}
                states={states}
                pendingCount={pendingCount}
              />
            </div>
          </div>,
          document.fullscreenElement ?? document.body,
        )}
    </div>
  );
}
