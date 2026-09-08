import { ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  executeContextAction,
  fitMenu,
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

export function ActionItems({
  source,
  onClose,
}: {
  source: ActionSource;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const execution = useMenuExecution();
  const [error, setError] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    if (source.subscribe) return source.subscribe(() => refresh((value) => value + 1));
    const timer = window.setInterval(() => refresh((value) => value + 1), 300);
    return () => clearInterval(timer);
  }, [source.subscribe]);
  const run = async (id: string) => {
    if (pending.current || (execution && !execution.acquire())) return;
    pending.current = true;
    setBusy(id);
    setError("");
    try {
      const result = await executeContextAction(source, id);
      onClose(result.restoreFocus);
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("The action could not be completed."));
    } finally {
      pending.current = false;
      setBusy(null);
      execution?.release();
    }
  };
  return (
    <>
      <Rows
        actions={source.actions()}
        run={run}
        busy={busy ?? (execution?.busy ? "pending" : null)}
      />
      {error && (
        <p role="alert" className="max-w-72 px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}

function Rows({
  actions,
  run,
  busy,
}: {
  actions: ContextAction[];
  run: (id: string) => Promise<void>;
  busy: string | null;
}) {
  return (
    <>
      {actions.map((action, index) => (
        <div key={action.id}>
          {index > 0 && action.group !== actions[index - 1].group && (
            <div role="separator" className="my-1 h-px bg-edge-soft/60" />
          )}
          {action.children?.length ? (
            <Submenu action={action} run={run} busy={busy} />
          ) : (
            <button
              role="menuitem"
              data-context-action={action.id}
              aria-disabled={action.disabled || busy != null || undefined}
              disabled={action.disabled}
              title={action.reason}
              onClick={() => {
                if (!action.disabled && busy == null) void run(action.id);
              }}
              className={`${menuItemClass} ${action.danger ? "text-danger" : ""}`}
            >
              {action.icon && <span className="shrink-0 text-ink-muted">{action.icon}</span>}
              <span className="min-w-0 whitespace-normal">{action.label}</span>
            </button>
          )}
        </div>
      ))}
    </>
  );
}

function Submenu({
  action,
  run,
  busy,
}: {
  action: ContextAction;
  run: (id: string) => Promise<void>;
  busy: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 8, y: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const keyboard = useRef(false);
  const rtl = document.documentElement.dir === "rtl";
  const cancel = () => clearTimeout(timer.current);
  useMenuFocus(panel, open, keyboard.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (action.disabled || busy != null) cancel();
    if (action.disabled) setOpen(false);
  }, [action.disabled, busy]);
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const button = trigger.current;
    const menu = panel.current;
    const parent = button.closest<HTMLElement>("[data-harbor-menu-panel]");
    const previousParentItems = parent ? menuItems(parent) : [];
    const measure = () => {
      const rect = button.getBoundingClientRect();
      const parentBounds = parent?.getBoundingClientRect();
      if (parentBounds && (rect.bottom <= parentBounds.top || rect.top >= parentBounds.bottom)) {
        setOpen(false);
        return;
      }
      const bounds = menu.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      const x = rtl ? rect.left - bounds.width : rect.right;
      const fits = x >= 8 && x + bounds.width <= width - 8;
      setPosition(
        fitMenu(
          { x: fits ? x : rtl ? rect.right : rect.left - bounds.width, y: rect.top },
          bounds,
          { width, height },
        ),
      );
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
  }, [open, rtl]);
  const leave = () => {
    cancel();
    timer.current = window.setTimeout(() => {
      if (!panel.current?.contains(document.activeElement)) setOpen(false);
    }, 240);
  };
  return (
    <div
      onMouseEnter={() => {
        cancel();
        if (action.disabled || busy != null) return;
        keyboard.current = false;
        timer.current = window.setTimeout(() => setOpen(true), 160);
      }}
      onMouseLeave={leave}
    >
      <button
        ref={trigger}
        role="menuitem"
        data-context-action={action.id}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-disabled={action.disabled || busy != null || undefined}
        title={action.reason}
        disabled={action.disabled}
        className={menuItemClass}
        onClick={() => {
          if (action.disabled || busy != null) return;
          keyboard.current = true;
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) {
            event.preventDefault();
            event.stopPropagation();
            if (action.disabled || busy != null) return;
            keyboard.current = true;
            if (open && panel.current)
              (menuItems(panel.current)[0] ?? panel.current).focus({ preventScroll: true });
            setOpen(true);
          }
        }}
      >
        {action.icon}
        <span className="flex-1">{action.label}</span>
        <ChevronRight size={14} className="rtl:rotate-180" />
      </button>
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
            onMouseEnter={cancel}
            onMouseLeave={leave}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" || event.key === (rtl ? "ArrowRight" : "ArrowLeft")) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                trigger.current?.focus();
              }
            }}
            style={{
              left: position.x,
              top: position.y,
              zIndex: 2147482001,
              maxHeight: "calc(100dvh - 16px)",
            }}
            className="fixed w-64 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-edge bg-elevated p-1 shadow-xl"
          >
            <Rows actions={action.children ?? []} run={run} busy={busy} />
          </div>,
          document.fullscreenElement ?? document.body,
        )}
    </div>
  );
}
