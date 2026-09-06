import { Ban } from "../icons";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SettingRow } from "../kit";
import { LanguagesPicker } from "../streaming-panel";

export function AudioLanguageTab() {
  const { settings, update } = useSettings();
  const t = useT();
  const [blockDraft, setBlockDraft] = useState(settings.trackBlockWords.join(", "));
  return (
    <>
      <Section
        title={t("Audio languages")}
        subtitle={t("When a release ships multiple audio tracks, Harbor selects the first match from this list.")}
      >
        <LanguagesPicker
          value={settings.preferredAudioLangs}
          onChange={(langs) => update({ preferredAudioLangs: langs })}
        />
      </Section>

      <Section
        title={t("Skip these tracks")}
        subtitle={t("Applies to both audio and subtitle tracks. You can still pick a skipped track by hand in the player.")}
      >
        <SettingRow
          wide
          icon={<Ban size={18} strokeWidth={2} />}
          label={t("Never auto-select tracks containing")}
          desc={t("Tracks whose name contains one of these words are skipped.")}
          tip={t("Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.")}
        >
          <div className="flex w-full flex-col gap-2.5">
            <input
              type="text"
              value={blockDraft}
              onChange={(e) => {
                setBlockDraft(e.target.value);
                update({
                  trackBlockWords: e.target.value
                    .split(",")
                    .map((w) => w.trim())
                    .filter(Boolean),
                });
              }}
              placeholder={t("commentary, descriptive")}
              className="h-11 w-full min-w-0 max-w-[520px] rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {settings.trackBlockWords.length > 0 && (
              <div className="flex w-full max-w-[520px] flex-wrap gap-2">
                {settings.trackBlockWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center rounded-[6px] bg-elevated px-2.5 py-1 text-[15.5px] font-medium leading-[22px] text-ink-muted"
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SettingRow>
      </Section>
    </>
  );
}
