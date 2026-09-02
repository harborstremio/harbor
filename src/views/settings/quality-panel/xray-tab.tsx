import { AlertTriangle } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { Section, ToggleRow, useSettingsActiveContext } from "../shared";

export function XrayTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const { setActive } = useSettingsActiveContext();
  return (
    <Section
      title={t("X-Ray (experimental)")}
      subtitle={t("Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and everything they have been in. On-device face matching to show who is on screen is coming next. Off by default.")}
    >
      <ToggleRow
        label={t("Enable X-Ray")}
        sub={t("Adds an X-Ray button in the player to see the full cast with photos and tap through to any actor. Needs a TMDB key for photos and filmographies.")}
        value={settings.xrayEnabled}
        onChange={(v) => update({ xrayEnabled: v })}
      />
      {settings.xrayEnabled && (
        <ToggleRow
          label={t("Scan who is on screen while playing")}
          sub={t("Periodically match faces in the current frame against the cast to show who is on screen now. On-device, nothing leaves your machine. Uses a little more CPU while playing.")}
          value={settings.xrayLiveScan}
          onChange={(v) => update({ xrayLiveScan: v })}
        />
      )}
      {settings.xrayEnabled && settings.xrayLiveScan && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3.5 py-3 text-start">
          <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12.5px] font-semibold text-amber-200">{t("Performance notice")}</span>
            <span className="text-[12px] leading-relaxed text-amber-200/85">
              {t(
                "Live face scanning loads on-device AI models and can significantly increase RAM, CPU, and GPU usage while playback is active. Turn it off if Harbor slows down or your device gets hot.",
              )}
            </span>
          </div>
        </div>
      )}
      {settings.xrayEnabled && !settings.tmdbKey.trim() && (
        <SettingRow
          label={t("X-Ray needs a TMDB key")}
          warn={t("X-Ray reads the cast and their photos from TMDB. Without a TMDB key there is no cast to match against. Add your free key under Library & metadata.")}
        >
          <button
            type="button"
            onClick={() => setActive("library")}
            className="harbor-press-pop h-9 shrink-0 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Library & metadata")}
          </button>
        </SettingRow>
      )}
    </Section>
  );
}
