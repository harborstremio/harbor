import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import type { AioService, AioStatusSnapshot } from "@/lib/streams/aiostatus";

const PALETTE: Record<AioService["status"], { dot: string; text: string }> = {
  expired: { dot: "bg-rose-300", text: "text-rose-200" },
  expiring: { dot: "bg-amber-300", text: "text-amber-200" },
  active: { dot: "bg-emerald-300", text: "text-emerald-200" },
  unknown: { dot: "bg-ink-subtle", text: "text-ink-subtle" },
};

export function AioStatusModal({
  snapshot,
  onClose,
}: {
  snapshot: AioStatusSnapshot;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label={t("Service status")}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative flex max-h-[80vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] animate-popover-in"
      >
        <header className="flex items-center justify-between gap-3 border-b border-edge-soft/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {snapshot.addonLogo && (
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
                <img
                  src={snapshot.addonLogo}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  draggable={false}
                />
              </span>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-semibold text-ink">
                {snapshot.addonName}
              </span>
              <span className="text-[11.5px] text-ink-subtle">{t("Service status")}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-2">
          {snapshot.services.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-ink-muted">
              {t("No services reported.")}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {snapshot.services.map((s) => (
                <ServiceRow key={s.id} service={s} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ServiceRow({ service }: { service: AioService }) {
  const t = useT();
  const pal = PALETTE[service.status];
  const label =
    service.status === "expired"
      ? t("Expired")
      : service.daysLeft != null
        ? t("{n}d left", { n: service.daysLeft })
        : service.status === "active"
          ? t("Active")
          : service.status === "expiring"
            ? t("Expiring")
            : t("Unknown");
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink/5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-medium text-ink">{service.name}</span>
        <span className="truncate text-[11.5px] text-ink-subtle">{service.rawLine}</span>
      </div>
      <span
        className={`flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold ${pal.text}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${pal.dot}`} />
        {label}
        {service.quotaUsedPercent != null && (
          <span className="text-ink-subtle">· {service.quotaUsedPercent}%</span>
        )}
      </span>
    </li>
  );
}
