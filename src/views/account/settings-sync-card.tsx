import { UploadCloud } from "@/views/settings/icons";
import { SettingGroup, SettingRow } from "@/views/settings/kit";
import { SButton } from "@/views/settings/ui";
import { useT } from "@/lib/i18n";
import { useSyncStatus } from "@/lib/profile-sync/use-sync-status";
import { requestSyncPull } from "@/lib/profile-sync/scheduler";

export function SettingsSyncCard() {
  const t = useT();
  const status = useSyncStatus();
  const ready = status.armed && status.everPulled;
  const message = status.lastError
    ? "Sync is unavailable right now. Your settings remain saved on this device."
    : status.phase === "no-refresh"
      ? "Sign in again to resume settings sync."
      : status.queued > 0
        ? "Settings are waiting to sync."
        : ready
          ? "Your preferences sync automatically through your Harbor account."
          : "Connect this Harbor account to start syncing your preferences.";

  return (
    <SettingGroup label={t("Cloud settings sync")}>
      <SettingRow
        icon={<UploadCloud size={18} strokeWidth={2} />}
        label={t("Preferences across devices")}
        desc={t(message)}
        warn={t("Syncs language, subtitle, playback, and browsing preferences. Passwords, API keys, local paths, and hardware-specific controls stay on this device.")}
      >
        <SButton
          onClick={requestSyncPull}
          disabled={!status.armed || status.phase === "pulling" || status.phase === "pushing"}
        >
          {status.phase === "pulling" || status.phase === "pushing" ? t("Syncing…") : t("Sync now")}
        </SButton>
      </SettingRow>
    </SettingGroup>
  );
}
