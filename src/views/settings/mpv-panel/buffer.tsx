import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  BUFFER_SIZES,
  bufferProfileFor,
  bufferSizeFor,
  formatBufferMemory,
  type BufferSizeId,
} from "@/lib/player/buffer-profile";
import { Section, Segmented } from "../shared";
import { SettingRow } from "../kit";

const LABELS: Record<BufferSizeId, string> = {
  auto: "Auto",
  small: "Small",
  medium: "Medium",
  large: "Large",
  max: "Maximum",
};

const DESCRIPTIONS: Record<BufferSizeId, string> = {
  auto: "Adjusts buffering to the video and available resources. Recommended for most connections.",
  small:
    "Uses less memory and starts quickly. Best for a stable connection.",
  medium:
    "Reads up to two minutes ahead to cover brief connection drops.",
  large:
    "Reads up to ten minutes ahead. Uses more memory to help with an unstable connection.",
  max: "Reads up to thirty minutes ahead. Uses the most memory and may take longer to start.",
};

export function BufferSizeSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const value = bufferSizeFor(settings);
  const profile = bufferProfileFor(value);
  const adaptive = t("Adaptive");
  const duration = (secs: number) =>
    secs >= 60 ? t("{n} min", { n: Math.round(secs / 60) }) : t("{n} sec", { n: secs });
  const stats = [
    {
      caption: t("Reads ahead"),
      desc: t("Target amount downloaded ahead, within the memory limit."),
      readout: profile ? duration(profile.readaheadSecs) : adaptive,
    },
    {
      caption: t("Memory cap"),
      desc: t("Maximum memory used for buffered video."),
      readout: profile ? formatBufferMemory(profile.maxBytes) : adaptive,
    },
    {
      caption: t("Wait before playing"),
      desc: t("Amount of video buffered before playback starts. This is not a fixed loading delay."),
      readout: !profile
        ? adaptive
        : profile.pauseWaitSecs > 0
          ? duration(profile.pauseWaitSecs)
          : t("None"),
    },
  ];

  return (
    <Section
      title={t("Slow or unstable connection")}
      subtitle={t("Download more of a video ahead of playback to help prevent pauses on an unstable connection.")}
      newId="mpv:buffer-size"
    >
      <SettingRow
        wide
        label={t("Buffer size")}
        desc={t(DESCRIPTIONS[value])}
        warn={
          profile && value === "max"
            ? t("Holds up to {size} in memory while a video plays.", {
                size: formatBufferMemory(profile.maxBytes),
              })
            : undefined
        }
      >
        <Segmented
          value={value}
          options={BUFFER_SIZES.map((id) => ({ value: id, label: LABELS[id] }))}
          onChange={(v) => update({ mpvBufferSize: v })}
        />
      </SettingRow>
      {stats.map((s) => (
        <SettingRow key={s.caption} label={s.caption} desc={s.desc}>
          <span className="text-[15.5px] leading-[22px] tabular-nums text-ink-muted">
            {s.readout}
          </span>
        </SettingRow>
      ))}
    </Section>
  );
}
