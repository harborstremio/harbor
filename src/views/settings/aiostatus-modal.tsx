import { X } from "./icons";
import { useModalExit } from "@/components/modal-shell";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { captureFocusReturn } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import type { AioService, AioStatusSnapshot } from "@/lib/streams/aiostatus";

const PALETTE: Record<AioService["status"], { dot: string; text: string }> = {
  expired: { dot: "bg-danger", text: "text-danger" },
  expiring: { dot: "bg-accent", text: "text-accent" },
  active: { dot: "bg-success", text: "text-success" },
  unknown: { dot: "bg-ink-subtle", text: "text-ink-subtle" },
};

export function AioStatusModal({
  snapshot,
  onClose,
}: {
  snapshot: AioStatusSnapshot;
  onClose: () => void;
}) {
  const { closing, close } = useModalExit(onClose);
  const t = useT();
  useEffect(() => captureFocusReturn(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[240] flex items-center justify-center p-6`}
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-label={t("Service status")}
        onMouseDown={(e) => e.stopPropagation()}
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface harbor-float`}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-5 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {snapshot.addonLogo && (
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas">
                <img
                  src={snapshot.addonLogo}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  draggable={false}
                />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="harbor-settings-label">
                {t("Service status")}
              </span>
              <span className="truncate text-[19px] font-semibold leading-[26px] tracking-tight text-ink">
                {snapshot.addonName}
              </span>
            </div>
          </div>
          <button
            onClick={close}
            aria-label={t("Close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {snapshot.services.length === 0 ? (
            <p className="rounded-md bg-canvas px-3 py-10 text-center text-[15.5px] text-ink-muted">
              {t("No services reported.")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
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
    <li className="flex items-center gap-3 rounded-md bg-canvas px-3.5 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">{service.name}</span>
        <span className="truncate text-[15.5px] leading-[22px] text-ink-subtle">{service.rawLine}</span>
      </div>
      <span className={`flex shrink-0 items-center gap-2 text-[15px] font-semibold ${pal.text}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${pal.dot}`} />
        {label}
        {service.quotaUsedPercent != null && (
          <span className="text-ink-subtle">· {service.quotaUsedPercent}%</span>
        )}
      </span>
    </li>
  );
}
