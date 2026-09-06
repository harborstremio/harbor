import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, Loader2, X } from "../../../../icons";
import { useT } from "@/lib/i18n";
import { advanceFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useNotifications } from "./use-notifications";
import { NotificationItem } from "./notification-item";

const PANEL_WIDTH = 380;
const PANEL_GAP = 8;
const PANEL_MARGIN = 12;

type PanelBox = { top: number; left: number; width: number; maxHeight: number; dropUp: boolean };

function measurePanel(anchor: HTMLElement): PanelBox {
  const rect = anchor.getBoundingClientRect();
  const scroller = anchor.closest(".hset-main");
  const scrollRect = scroller?.getBoundingClientRect();
  const topLimit = Math.max(PANEL_MARGIN, scrollRect ? scrollRect.top : 0);
  const bottomLimit = Math.min(
    window.innerHeight - PANEL_MARGIN,
    scrollRect ? scrollRect.bottom : window.innerHeight,
  );
  const preferred = Math.min(460, (bottomLimit - topLimit) * 0.9);
  const above = Math.max(0, rect.top - topLimit - PANEL_GAP);
  const below = Math.max(0, bottomLimit - rect.bottom - PANEL_GAP);
  const dropUp = below < preferred && above > below;
  const width = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
  const rtl = getComputedStyle(document.documentElement).direction === "rtl";
  const left = Math.min(
    Math.max(PANEL_MARGIN, rtl ? rect.left : rect.right - width),
    window.innerWidth - width - PANEL_MARGIN,
  );
  const maxHeight = Math.max(180, Math.min(preferred, dropUp ? above : below));
  const rawTop = dropUp ? rect.top - PANEL_GAP - maxHeight : rect.bottom + PANEL_GAP;
  const top = Math.min(
    Math.max(PANEL_MARGIN, rawTop),
    Math.max(PANEL_MARGIN, window.innerHeight - PANEL_MARGIN - maxHeight),
  );
  return { top, left, width, maxHeight, dropUp };
}

export function NotificationBell({ onOpenTheme }: { onOpenTheme: (themeId: string) => void }) {
  const t = useT();
  const { items, unread, loading, authed, refresh, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<PanelBox | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
    const trigger = btnRef.current;
    if (trigger) advanceFocus(trigger);
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const place = () => {
      if (btnRef.current) setBox(measurePanel(btnRef.current));
    };
    place();
    let raf: number | null = requestAnimationFrame(() => {
      raf = null;
      place();
    });
    const schedule = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        place();
      });
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.stopPropagation();
        closePanel();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, refresh, closePanel]);

  if (!authed) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) markAllRead();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={t("Notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <Bell size={18} strokeWidth={2.1} />
        {unread > 0 && (
          <span className="harbor-pop absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[13px] font-bold leading-[17px] text-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("Notifications")}
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
            }}
            className={`z-[10000] flex flex-col overflow-hidden rounded-xl border border-edge bg-elevated harbor-float ${
              box.dropUp ? "animate-menu-in-up" : "animate-menu-in"
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge-soft px-4 py-2">
              <span className="harbor-settings-label">{t("Notifications")}</span>
              <span className="flex shrink-0 items-center gap-0.5">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[15.5px] font-semibold text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Check size={16} strokeWidth={2.2} /> {t("Mark all read")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label={t("Close")}
                  className="-me-2 grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
              {loading && items.length === 0 ? (
                <div className="flex justify-center py-10 text-ink-subtle">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-[15.5px] leading-[22px] text-ink-subtle">
                  {t("No notifications yet. Publish a theme and watch it climb.")}
                </p>
              ) : (
                items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onOpen={() => {
                      setOpen(false);
                      onOpenTheme(n.themeId);
                    }}
                  />
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
