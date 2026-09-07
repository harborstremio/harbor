import { useId } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { SettingRow } from "./kit";
import { Section } from "./shared";

const CHOICES = [15, 30, 45, 60, 90] as const;

export function AddonTimeoutSetting() {
  const t = useT();
  const id = useId();
  const { settings, update } = useSettings();
  const raw = settings.addonTimeoutSec ?? 30;
  const current = Number.isFinite(raw) ? Math.max(8, Math.min(120, raw)) : 30;
  const choices = [...new Set<number>([...CHOICES, current])].sort((a, b) => a - b);

  return (
    <Section title={t("Addon wait time")}>
      <SettingRow
        label={t("Addon wait time")}
        desc={t("How long Harbor waits for each addon to return results.")}
      >
        <select
          id={id}
          aria-label={t("Addon wait time")}
          value={current}
          onChange={(event) => update({ addonTimeoutSec: Number(event.target.value) })}
          className="h-11 min-w-[190px] rounded-[8px] border border-edge-soft bg-elevated px-3 text-[15px] text-ink"
        >
          {choices.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds === 30 ? t("30 seconds (default)") : t("{seconds} seconds", { seconds })}
            </option>
          ))}
        </select>
      </SettingRow>
      <p className="max-w-[68ch] text-[15px] leading-[22px] text-ink-muted">
        {t("Results appear as they arrive. Increase the wait time if an addon often needs a refresh before its results appear.")}
      </p>
    </Section>
  );
}
