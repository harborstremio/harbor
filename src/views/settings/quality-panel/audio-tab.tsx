import { Dropdown } from "@/components/dropdown";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { listMpvAudioDevices, type MpvAudioDevice } from "@/lib/player/mpv";
import { SettingRow } from "../kit";
import { Section, Segmented, ToggleRow } from "../shared";
import { AudioProfilePreview } from "./audio-profile-preview";
import { VolumeBoostPreview } from "./volume-boost-preview";

const VOLUME_BOOST_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "1", label: "100%" },
  { value: "1.5", label: "150%" },
  { value: "2", label: "200%" },
  { value: "3", label: "300%" },
  { value: "4", label: "400%" },
  { value: "6", label: "600%" },
];

export function AudioTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Audio")}
      subtitle={t("Shape the sound without touching your system EQ. Applies on the mpv engine; the HTML5 engine plays audio untouched.")}
    >
      <ToggleRow
        label={t("Normalize loudness")}
        sub={t("Evens out quiet dialogue and loud action scenes with a dynamic normalizer.")}
        value={settings.audioNormalize}
        onChange={(v) => update({ audioNormalize: v })}
      />
      <ToggleRow
        label={t("Mix surround sound down to stereo")}
        sub={t("Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.")}
        value={settings.mpvDownmixStereo}
        onChange={(v) => update({ mpvDownmixStereo: v })}
      />
      <SettingRow
        wide
        label={t("Sound profile")}
        desc={t("Night mode gently compresses loud moments for late-night watching. Profiles take effect when the next track loads and stack with the normalizer.")}
      >
        <div className="flex w-full flex-col gap-3">
          <Segmented
            value={settings.audioProfile}
            options={[
              { value: "off", label: t("Flat") },
              { value: "bass", label: t("Bass boost") },
              { value: "voice", label: t("Vocal clarity") },
              { value: "bass-reduce", label: t("Less bass") },
              { value: "night", label: t("Night mode") },
            ]}
            onChange={(v) => update({ audioProfile: v })}
          />
          <AudioProfilePreview profile={settings.audioProfile} />
        </div>
      </SettingRow>
      <SettingRow
        wide
        label={t("Maximum volume boost")}
        desc={t("How far you can boost past 100 percent on the volume bar. Higher settings can get very loud.")}
      >
        <div className="flex w-full flex-col gap-3">
          <Segmented
            value={String(settings.volumeBoostMax)}
            options={VOLUME_BOOST_OPTIONS}
            onChange={(v) => update({ volumeBoostMax: Number(v) })}
          />
          <VolumeBoostPreview max={settings.volumeBoostMax} />
        </div>
      </SettingRow>
      <AudioOutputRow />
    </Section>
  );
}

function AudioOutputRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const [devices, setDevices] = useState<MpvAudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    listMpvAudioDevices()
      .then((d) => alive && setDevices(d))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  const known = settings.audioDevice === "" || devices.some((d) => d.name === settings.audioDevice);
  return (
    <SettingRow
      wide
      label={t("Output device")}
      desc={
        loading
          ? t("Detecting devices...")
          : t("Send audio to specific speakers, headphones or a receiver. System default follows your system's audio output.")
      }
    >
      <div className="w-full max-w-[420px]">
        <Dropdown
          size="md"
          value={settings.audioDevice}
          onChange={(v) => update({ audioDevice: v })}
          options={[
            { value: "", label: t("System default") },
            ...devices.map((d) => ({ value: d.name, label: d.description || d.name })),
            ...(known ? [] : [{ value: settings.audioDevice, label: settings.audioDevice }]),
          ]}
        />
      </div>
    </SettingRow>
  );
}
