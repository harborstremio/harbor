import { useT } from "@/lib/i18n";
import { THEME_PRESETS } from "@/lib/theme";
import { ROW_ACTION } from "@/views/settings/kit";
import { useSettingsActiveContext } from "@/views/settings/shared";
import { Fit } from "@/views/settings/theme-panel/custom-themes-section/community-store/market/fit";
import { PaletteSeam } from "@/views/settings/theme-panel/custom-themes-section/community-store/market/palette-seam";

const PREVIEW_THEMES = [THEME_PRESETS.nord, THEME_PRESETS["tokyo-night"]];

export function AccountThemeCta() {
  const t = useT();
  const { openPage } = useSettingsActiveContext();

  return (
    <div className="grid items-center gap-6 border-t border-edge-soft py-7 min-[1100px]:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="grid w-full max-w-[480px] grid-cols-2 gap-3">
        {PREVIEW_THEMES.map((theme) => (
          <figure key={theme.id} className="min-w-0">
            <div className="overflow-hidden rounded-[10px] bg-elevated">
              <div className="aspect-[16/10] overflow-hidden">
                <Fit kind="theme" cover={theme.previewImage} />
              </div>
              <PaletteSeam swatch={theme.swatch} />
            </div>
            <figcaption className="mt-2 text-[15px] font-medium leading-[22px] text-ink">
              {theme.name}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-[22px] font-semibold leading-[28px] tracking-[-0.4px] text-ink">
            {t("Share your style")}
          </h3>
          <p className="max-w-[45ch] text-[15.5px] leading-[23px] text-ink-muted">
            {t("Create a theme or share one you've made with the Harbor community.")}
          </p>
        </div>
        <button
          type="button"
          className={ROW_ACTION}
          onClick={() => openPage("theme", "library")}
        >
          {t("Your themes")}
        </button>
      </div>
    </div>
  );
}
