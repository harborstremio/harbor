import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { LanguagesPicker } from "@/views/settings/streaming-panel";

export function SubtitlesStep() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 4 · Subtitles")}
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
          {t("Pick your subtitle languages")}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {t(
            "When playback starts, Harbor finds and loads a subtitle in one of these languages automatically. The first available match wins, so put your main language first.",
          )}
        </p>
      </div>
      <LanguagesPicker value={settings.preferredSubLangs} onChange={(langs) => update({ preferredSubLangs: langs })} />
    </div>
  );
}
