import { Music } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import type { ProfileAudioMode } from "@/lib/settings/types";
import { Section, Segmented } from "./shared";
import { SettingRow } from "./kit";

const MODES: ReadonlyArray<{ value: ProfileAudioMode; label: string }> = [
  { value: "auto", label: "Play automatically" },
  { value: "click", label: "Only when I press play" },
  { value: "off", label: "Never" },
];

export function ProfileAudioSetting() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <Section
      title={t("Profile songs")}
      subtitle={t("People can pin a track to their profile. This controls what happens when you visit one.")}
    >
      <SettingRow
        icon={<Music size={16} strokeWidth={2} />}
        label={t("When you open a profile")}
        desc={
          settings.profileAudio === "off"
            ? t("Profile songs stay hidden and never play.")
            : t("You can always mute or stop a song from the card itself.")
        }
      >
        <Segmented
          value={settings.profileAudio}
          options={MODES.map((o) => ({ ...o, label: t(o.label) }))}
          onChange={(v) => update({ profileAudio: v })}
        />
      </SettingRow>
    </Section>
  );
}
