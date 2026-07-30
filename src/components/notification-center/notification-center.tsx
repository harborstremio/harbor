import { ArrowLeft, Bell, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { currentAuthor } from "@/lib/theme-auth";
import type { CenterNotif } from "@/lib/social/notifications";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { subscribeNotificationOpen } from "@/lib/social/notification-open";
import { requestOpenGroup } from "@/lib/social/open-group";
import { openDiagnosticsConsent } from "@/lib/social/diagnostics-open";
import { useNotificationCenter } from "@/lib/social/use-notification-center";
import { useT } from "@/lib/i18n";
import { FeedRow, NotificationDetail, RequestRow } from "./notification-rows";

export function NotificationCenter({ trigger = true }: { trigger?: boolean } = {}) {
  const nc = useNotificationCenter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CenterNotif | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => subscribeNotificationOpen(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) setDetail(null);
  }, [open]);

  useEffect(() => {
    if (open && !wasOpen.current) void nc.refresh();
    if (!open && wasOpen.current) void nc.markRead();
    wasOpen.current = open;
  }, [open, nc]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detail) setDetail(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, detail]);

  if (!nc.authed) return null;

  const toProfile = (handle: string) => {
    setOpen(false);
    requestOpenProfile(handle);
  };

  const openNotif = (notif: CenterNotif) => {
    if (notif.kind === "diagnostics-request") {
      setOpen(false);
      const requestId = typeof notif.data?.requestId === "string" ? notif.data.requestId : undefined;
      if (requestId) openDiagnosticsConsent(requestId);
      return;
    }
    const groupKind = notif.kind === "group-added" || notif.kind === "group-post";
    const groupMention = notif.kind === "mention" && notif.entityType === "group";
    if ((groupKind || groupMention) && notif.targetId) {
      setOpen(false);
      requestOpenGroup(notif.targetId);
      return;
    }
    setDetail(notif);
  };

  const badge = nc.badge;

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Notifications")}
          className="harbor-navbtn relative grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
        >
          <Bell size={17} strokeWidth={2} />
          {badge > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-canvas">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[210] bg-canvas/40"
            style={{ animation: "nc-scrim-in 160ms ease both" }}
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="harbor-together-surface absolute end-4 top-[88px] flex max-h-[74vh] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-edge shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
              style={{ animation: "nc-pop-in 200ms cubic-bezier(0.32,0.72,0.24,1) both" }}
            >
              <div className="flex items-center justify-between border-b border-edge-soft px-4 py-3">
                {detail ? (
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="-ms-1.5 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                  >
                    <ArrowLeft size={16} strokeWidth={2.2} /> {t("Back")}
                  </button>
                ) : (
                  <span className="text-[14px] font-semibold tracking-tight text-ink">{t("Notifications")}</span>
                )}
                <div className="flex items-center gap-1">
                  {nc.loading && !detail && <Loader2 size={14} className="animate-spin text-ink-subtle" />}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-7 w-7 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
                    aria-label={t("Close")}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {detail ? (
                <NotificationDetail
                  notif={detail}
                  onBack={() => setDetail(null)}
                  onOpenProfile={toProfile}
                  ownHandle={currentAuthor()?.handle}
                />
              ) : (
                <>
              {nc.items.length > 0 && (
                <div className="flex items-center gap-2 border-b border-edge-soft px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void nc.markRead()}
                    disabled={nc.unread === 0}
                    className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink disabled:cursor-default disabled:opacity-40"
                  >
                    {t("Mark all read")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void nc.clearAll()}
                    className="ms-auto rounded-md px-1.5 py-0.5 text-[12px] font-medium text-ink-subtle transition-colors hover:text-danger"
                  >
                    {t("Clear all")}
                  </button>
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                {nc.pending.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="px-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                      {t("Friend requests")}
                    </span>
                    {nc.pending.map((r) => (
                      <RequestRow
                        key={r.edgeId}
                        request={r}
                        busy={false}
                        onAccept={() => nc.accept(r.edgeId)}
                        onDecline={() => nc.decline(r.edgeId)}
                        onOpen={toProfile}
                      />
                    ))}
                  </div>
                )}

                {nc.items.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {nc.pending.length > 0 && (
                      <span className="px-1 pb-0.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                        {t("Earlier")}
                      </span>
                    )}
                    {nc.items.map((n, i) => (
                      <FeedRow key={n.id} notif={n} index={i} onDismiss={nc.dismiss} onOpen={openNotif} />
                    ))}
                  </div>
                ) : (
                  nc.pending.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-elevated/60 text-ink-subtle">
                        <Bell size={20} strokeWidth={1.8} />
                      </span>
                      <span className="text-[13px] text-ink-muted">{t("You are all caught up.")}</span>
                    </div>
                  )
                )}
              </div>
                </>
              )}
            </div>
            <style>{`
              @keyframes nc-scrim-in { from { opacity: 0 } to { opacity: 1 } }
              @keyframes nc-pop-in { from { opacity: 0; transform: translateY(-8px) scale(0.98) } to { opacity: 1; transform: none } }
            `}</style>
          </div>,
          document.body,
        )}
    </>
  );
}
