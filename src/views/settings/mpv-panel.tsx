import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import { isTauri } from "./player-panel/internals";
import { QualityProfile } from "./mpv-panel/profile";
import { PictureDialsSection, ColorHdrSection } from "./mpv-panel/dials";
import { AdvancedMpvSection } from "./mpv-panel/advanced";

export function MpvPanel() {
  const { settings, update } = useSettings();
  const t = useT();

  if (!isTauri) {
    return (
      <Section
        title={t("Desktop only")}
        subtitle={t(
          "These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.",
        )}
      >
        <span className="text-[13px] text-ink-subtle">
          {t("Download the desktop app to use video tuning.")}
        </span>
      </Section>
    );
  }

  return (
    <>
      <Section
        title={t("Picture quality")}
        subtitle={t(
          "One choice that sets how hard your computer works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.",
        )}
      >
        <QualityProfile />
      </Section>

      <Section
        title={t("Hardware acceleration")}
        subtitle={t(
          "Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.",
        )}
      >
        <Segmented
          value={settings.mpvHwdec ?? "auto"}
          options={[
            { value: "auto", label: "Auto" },
            { value: "on", label: "Force on" },
            { value: "off", label: "Off (use CPU)" },
          ]}
          onChange={(v) => update({ mpvHwdec: v })}
        />
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-subtle">
          {settings.mpvHwdec === "off"
            ? t(
                "The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.",
              )
            : settings.mpvHwdec === "on"
              ? t(
                  "Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.",
                )
              : t(
                  "Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.",
                )}
        </p>
      </Section>

      <PictureDialsSection />

      <ColorHdrSection />

      <Section
        title={t("Slow or unstable connection")}
        subtitle={t(
          "If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.",
        )}
      >
        <ToggleRow
          label={t("Build a bigger buffer")}
          sub={t(
            "Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.",
          )}
          value={settings.mpvBufferBoost}
          onChange={(v) => update({ mpvBufferBoost: v })}
        />
      </Section>

      <Section
        title={t("Audio")}
        subtitle={t(
          "For laptop speakers and headphones. Movies mixed for 5.1 or 7.1 surround can sound hollow or have quiet dialogue on two speakers. This folds them down properly.",
        )}
      >
        <ToggleRow
          label={t("Mix surround sound down to stereo")}
          sub={t(
            "Turn on if you watch on a laptop or headphones and dialogue feels too quiet next to the effects. Leave off if you have a real surround setup or a soundbar.",
          )}
          value={settings.mpvDownmixStereo}
          onChange={(v) => update({ mpvDownmixStereo: v })}
        />
      </Section>

      <AdvancedMpvSection />
    </>
  );
}
