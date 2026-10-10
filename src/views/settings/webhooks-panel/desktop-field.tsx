import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ensureDesktopNotifyPermission } from "@/lib/calendar";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_PRIMARY } from "../kit";
import { ToggleRow } from "../shared";
import { StatusBadge, type FieldStatus } from "./webhook-field";

export function DesktopNotifyField({
  enabled,
  onChange,
  onTest,
  status,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  onTest: () => void;
  status: FieldStatus;
}) {
  const t = useT();
  const [blocked, setBlocked] = useState(false);
  const busy = status.state === "busy";

  const toggle = async (v: boolean) => {
    if (!v) {
      setBlocked(false);
      onChange(false);
      return;
    }
    const granted = await ensureDesktopNotifyPermission();
    if (!granted) {
      setBlocked(true);
      onChange(false);
      return;
    }
    setBlocked(false);
    onChange(true);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <ToggleRow
        label={t("Desktop notifications")}
        sub={t("Get a system notification on this device when something you follow drops.")}
        value={enabled}
        onChange={(v) => void toggle(v)}
        warn={
          blocked
            ? t(
                "Notifications are blocked for Harbor. Enable them in your system settings, then turn this back on.",
              )
            : undefined
        }
      />
      {enabled && (
        <div className="flex flex-wrap items-center gap-3 ps-1">
          <button
            type="button"
            onClick={busy ? undefined : onTest}
            aria-disabled={busy}
            className={`${ROW_ACTION_PRIMARY}${busy ? " pointer-events-none opacity-40" : ""}`}
          >
            {busy && <Loader2 size={17} strokeWidth={2.4} className="shrink-0 animate-spin" />}
            {t("Send test")}
          </button>
          <StatusBadge status={status} />
        </div>
      )}
    </div>
  );
}
