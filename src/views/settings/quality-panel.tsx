import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { listMpvAudioDevices, type MpvAudioDevice } from "@/lib/player/mpv";
import { PlayModePanel, PlayerEnginePanel } from "./player-panel";
import { Section, Segmented, ToggleRow, useSettingsActiveContext } from "./shared";
import { CROP_PRESETS } from "@/views/player/hooks/use-video-fill";
import { useT } from "@/lib/i18n";
import { clampStillWatchingThreshold } from "@/lib/still-watching";

export function QualityPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const { setActive } = useSettingsActiveContext();
  return (
    <>
      <Section
        title={t("Play button behavior")}
        subtitle={t(
          "Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.",
        )}
      >
        <PlayModePanel />
      </Section>

      <Section
        title={t("Player engine")}
        subtitle={t(
          "HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.",
        )}
      >
        <PlayerEnginePanel />
      </Section>

      <Section
        title={t("Stream quality in player")}
        subtitle={t("Show what you're actually watching, under the title in the player.")}
      >
        <ToggleRow
          label={t("Show stream quality under the title")}
          sub={t(
            "Displays the resolution, HDR format and audio (e.g. 4K · Dolby Vision · TrueHD 7.1) under the movie or episode title while playing. Off by default.",
          )}
          value={settings.showQualityInfo}
          onChange={(v) => update({ showQualityInfo: v })}
        />
      </Section>

      <Section
        title={t("Aspect ratio")}
        subtitle={t(
          "Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.",
        )}
      >
        <Segmented
          value={settings.cropMode}
          options={CROP_PRESETS.map((m) => ({ value: m.id, label: m.label }))}
          onChange={(v) => update({ cropMode: v })}
        />
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t(
            "Want to change the ratio mid-playback? The live aspect button is hidden by default to keep the player tidy.",
          )}{" "}
          <button
            type="button"
            onClick={() => setActive("playerLayout")}
            className="font-semibold text-ink underline-offset-4 transition-colors hover:underline"
          >
            {t("Turn it on in Player layout")}
          </button>
        </p>
      </Section>

      <Section
        title={t("Audio")}
        subtitle={t(
          "Shape the sound without touching your system EQ. Applies on the mpv engine; the HTML5 engine plays audio untouched.",
        )}
      >
        <ToggleRow
          label={t("Normalize loudness")}
          sub={t("Evens out quiet dialogue and loud action scenes with a dynamic normalizer.")}
          value={settings.audioNormalize}
          onChange={(v) => update({ audioNormalize: v })}
        />
        <div>
          <Segmented
            value={settings.audioProfile}
            options={[
              { value: "off", label: "Flat" },
              { value: "bass", label: "Bass boost" },
              { value: "voice", label: "Vocal clarity" },
              { value: "bass-reduce", label: "Less bass" },
              { value: "night", label: "Night mode" },
            ]}
            onChange={(v) => update({ audioProfile: v })}
          />
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Night mode gently compresses loud moments for late-night watching. Profiles take effect when the next track loads and stack with the normalizer.",
            )}
          </p>
        </div>
        <AudioOutputRow />
      </Section>

      <Section
        title={t("Skip intros & credits")}
        subtitle={t(
          "Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.",
        )}
      >
        <ToggleRow
          label={t("Show the Skip button")}
          sub={t(
            "Show a Skip Intro / Skip Credits button when Harbor detects one. Turn this off to never show it. You can also tap the X on the button to dismiss a wrong one for the rest of the episode.",
          )}
          value={settings.showSkipButton}
          onChange={(v) => update({ showSkipButton: v })}
        />
        <ToggleRow
          label={t("Auto-skip intros")}
          sub={t(
            "Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.",
          )}
          value={settings.autoSkipIntro}
          onChange={(v) => update({ autoSkipIntro: v })}
        />
        <ToggleRow
          label={t("Auto-skip recaps")}
          sub={t("Automatically jump past recap segments.")}
          value={settings.autoSkipRecap}
          onChange={(v) => update({ autoSkipRecap: v })}
        />
        <ToggleRow
          label={t("Auto-skip credit outros")}
          sub={t(
            "Automatically skip ending credits and trigger the next episode countdown immediately.",
          )}
          value={settings.autoSkipOutro}
          onChange={(v) => update({ autoSkipOutro: v })}
        />
        {settings.showSkipButton && (
          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-medium text-ink">
              {t("Auto-hide the Skip button after")}
            </span>
            <Segmented
              value={String(settings.skipButtonHideSec)}
              options={[
                { value: "0", label: t("Off") },
                { value: "5", label: t("5s") },
                { value: "10", label: t("10s") },
                { value: "15", label: t("15s") },
                { value: "30", label: t("30s") },
              ]}
              onChange={(v) => update({ skipButtonHideSec: Number(v) })}
            />
            <span className="text-[12.5px] leading-relaxed text-ink-subtle">
              {t(
                "Hides the button on its own after a few seconds so a wrong one doesn't sit there the whole episode.",
              )}
            </span>
          </div>
        )}
      </Section>

      <Section
        title={t("Next episode prompt")}
        subtitle={t(
          "When the Up Next pill appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.",
        )}
      >
        <Segmented
          value={nextEpLeadKey(settings.nextEpisodeLeadSec)}
          options={NEXT_EP_LEADS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) =>
            update({ nextEpisodeLeadSec: NEXT_EP_LEADS.find((o) => o.value === v)?.sec ?? -1 })
          }
        />
        <ToggleRow
          label={t("Auto-play next episode")}
          sub={t(
            "When an episode ends, automatically start the next one. Off lets the episode finish and stop.",
          )}
          value={settings.autoPlayNextEpisode}
          onChange={(v) => update({ autoPlayNextEpisode: v })}
        />
        {settings.autoPlayNextEpisode && (
          <ToggleRow
            label={t("Ask if you're still watching")}
            sub={t(
              "After several episodes advance automatically without input, pause before starting another episode.",
            )}
            value={settings.stillWatching}
            onChange={(v) => update({ stillWatching: v })}
          />
        )}
        {settings.autoPlayNextEpisode && settings.stillWatching && (
          <label className="flex items-center justify-between gap-4 border-t border-edge-soft pt-3.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-medium text-ink">
                {t("Automatic advances before asking")}
              </span>
              <span className="text-[12px] leading-relaxed text-ink-subtle">
                {t("Choose from 1 to 10 uninterrupted episode advances.")}
              </span>
            </span>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={settings.stillWatchingAfter}
              onChange={(event) =>
                update({
                  stillWatchingAfter: clampStillWatchingThreshold(Number(event.target.value)),
                })
              }
              className="h-9 w-20 shrink-0 rounded-lg border border-edge bg-raised px-2.5 text-center text-[13px] text-ink outline-none transition-colors focus:border-ink"
            />
          </label>
        )}
        <ToggleRow
          label={t("Queue drives Next/Previous")}
          sub={t(
            "When the current title is in your queue, Next and Previous follow the items around it.",
          )}
          value={settings.queueDrivesNav}
          onChange={(v) => update({ queueDrivesNav: v })}
        />
        <ToggleRow
          label={t("Show controls when pausing with keyboard")}
          sub={t(
            "Show the player controls when you pause or resume using the keyboard. Turn off to keep them hidden so they don't cover subtitles.",
          )}
          value={settings.keyboardPauseShowsControls}
          onChange={(v) => update({ keyboardPauseShowsControls: v })}
        />
      </Section>
    </>
  );
}

const NEXT_EP_LEADS = [
  { value: "auto", label: "Auto", sec: -1 },
  { value: "off", label: "Off", sec: 0 },
  { value: "30", label: "30s", sec: 30 },
  { value: "45", label: "45s", sec: 45 },
  { value: "60", label: "1 min", sec: 60 },
  { value: "90", label: "1.5 min", sec: 90 },
  { value: "120", label: "2 min", sec: 120 },
] as const;

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
    <div className="flex items-center justify-between gap-3 border-t border-edge-soft pt-3.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13.5px] font-medium text-ink">{t("Output device")}</span>
        <span className="text-[12px] leading-relaxed text-ink-subtle">
          {loading
            ? t("Detecting devices...")
            : t(
                "Send audio to specific speakers, headphones or a receiver. System default follows Windows.",
              )}
        </span>
      </div>
      <select
        value={settings.audioDevice}
        onChange={(e) => update({ audioDevice: e.target.value })}
        className="h-9 max-w-[200px] shrink-0 rounded-lg border border-edge bg-raised px-2.5 text-[12.5px] text-ink outline-none transition-colors focus:border-ink"
      >
        <option value="">{t("System default")}</option>
        {devices.map((d) => (
          <option key={d.name} value={d.name}>
            {d.description || d.name}
          </option>
        ))}
        {!known && <option value={settings.audioDevice}>{settings.audioDevice}</option>}
      </select>
    </div>
  );
}

function nextEpLeadKey(sec: number): string {
  return NEXT_EP_LEADS.find((o) => o.sec === sec)?.value ?? "auto";
}
