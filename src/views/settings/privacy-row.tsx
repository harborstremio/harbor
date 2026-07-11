import { useT } from "@/lib/i18n";
import { blockedTrackerCount, subscribeBlockedTrackers } from "@/lib/privacy/blocklist";
import { useSettings } from "@/lib/settings";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { ToggleRow } from "./shared";

export function PrivacyRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const [count, setCount] = useState(() => blockedTrackerCount());
  useEffect(() => subscribeBlockedTrackers(() => setCount(blockedTrackerCount())), []);

  const sub = settings.blockTrackers
    ? count > 0
      ? t("{count} tracker request blocked this session. Harbor itself sends zero telemetry.", {
          count: count.toLocaleString(),
        })
      : t("Watching for ad, analytics, and tracking requests. Harbor itself sends zero telemetry.")
    : t("Ad, analytics, and tracking requests pass through untouched.");

  return (
    <ToggleRow
      label={t("Block ads & trackers")}
      sub={sub}
      leading={<ShieldCheck size={18} strokeWidth={2} className="text-ink-muted" />}
      value={settings.blockTrackers}
      onChange={(v) => update({ blockTrackers: v })}
    />
  );
}
