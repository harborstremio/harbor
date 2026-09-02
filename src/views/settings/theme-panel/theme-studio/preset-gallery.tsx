import { THEME_PRESETS, type ThemePreset } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Fit } from "../custom-themes-section/community-store/market/fit";
import { tokensFromPreset } from "../custom-themes-section/community-store/market/fit-palette";
import { PaletteSeam } from "../custom-themes-section/community-store/market/palette-seam";

export function PresetGallery({ onSeed }: { onSeed: (t: ThemePreset) => void }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Object.values(THEME_PRESETS).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSeed(p)}
          title={t(p.name)}
          className="group/card flex flex-col overflow-hidden rounded-md bg-canvas text-start outline-none transition-colors duration-200 hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-raised">
            <Fit kind="theme" tokens={tokensFromPreset(p)} cover={p.previewImage ?? null} />
            <div className="absolute inset-x-0 bottom-0">
              <PaletteSeam swatch={p.swatch} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 px-3 pb-2.5 pt-2">
            <span className="truncate text-[12.5px] font-semibold text-ink">{t(p.name)}</span>
            {p.blurb && (
              <span className="truncate text-[11.5px] text-ink-subtle">{t(p.blurb)}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
