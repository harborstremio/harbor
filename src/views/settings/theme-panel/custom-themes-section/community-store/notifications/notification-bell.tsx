import { useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useNotifications } from "./use-notifications";
import { NotificationItem } from "./notification-item";

export function NotificationBell({ onOpenTheme }: { onOpenTheme: (themeId: string) => void }) {
  const t = useT();
  const { items, unread, loading, authed, refresh, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, refresh]);

  if (!authed) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) markAllRead();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("Notifications")}
        className="relative grid h-9 w-9 place-items-center rounded-full bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <Bell size={16} strokeWidth={2.1} />
        {unread > 0 && (
          <span className="harbor-pop absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10.5px] font-bold text-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 absolute end-0 top-11 z-50 w-[340px] overflow-hidden rounded-sm bg-elevated harbor-float motion-reduce:animate-none">
          <div className="flex items-center justify-between border-b border-edge-soft px-4 py-3">
            <span className="text-[13px] font-semibold text-ink">{t("Notifications")}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11.5px] text-ink-subtle transition-colors hover:text-ink"
              >
                <Check size={12} /> {t("Mark all read")}
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto [scrollbar-width:thin]">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8 text-ink-subtle">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] leading-relaxed text-ink-subtle">
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
        </div>
      )}
    </div>
  );
}
