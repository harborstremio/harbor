import { Check, Copy } from "lucide-react";
import { getThemeById, type ThemePreset } from "@/lib/theme";
import { useT } from "@/lib/i18n";

export function ActiveBanner({
  theme,
  onExport,
  onCustomize,
}: {
  theme: ThemePreset | null;
  onExport: () => void;
  onCustomize: () => void;
}) {
  const t = useT();
  if (!theme) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] bg-elevated px-5 py-4">
        <div className="min-w-0">
          <span className="harbor-settings-label">{t("Now using")}</span>
          <h3 className="mt-1 text-[16.5px] font-semibold leading-[24px] text-ink">
            {t("Custom palette")}
          </h3>
          <p className="mt-0.5 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t("Hand-tuned colors. Edit them in the section above.")}
          </p>
        </div>
        <button
          type="button"
          onClick={onCustomize}
          className="harbor-press-pop h-11 shrink-0 rounded-[8px] bg-ink px-4 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("Edit colors")}
        </button>
      </div>
    );
  }
  const localizedBlurb =
    theme.blurb && getThemeById(theme.id)?.blurb === theme.blurb ? t(theme.blurb) : theme.blurb;
  const bg =
    theme.background?.image ?? `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
  return (
    <div className="relative overflow-hidden rounded-[10px] harbor-float">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{ background: bg, zIndex: 0 }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-canvas/[0.88] via-canvas/[0.74] to-canvas/[0.56]"
        aria-hidden
        style={{ zIndex: 1 }}
      />
      <div
        className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-5"
        style={{ zIndex: 2 }}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px] text-ink-muted">
            <Check size={14} strokeWidth={2.6} />
            {t("Now using")}
          </div>
          <h3
            className="text-[22px] font-semibold tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {theme.name}
          </h3>
          {localizedBlurb && (
            <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
              {localizedBlurb}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip>{t(labelForLayout(theme.layout))}</Chip>
            <Chip>{t(labelForCard(theme.cardStyle))}</Chip>
            {theme.bokeh && <Chip>{t("Bokeh")}</Chip>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onCustomize}
            className="harbor-press-pop flex h-11 items-center gap-2 rounded-[8px] bg-ink/[0.08] px-4 text-[15.5px] font-semibold text-ink transition-colors hover:bg-ink/[0.14]"
          >
            {t("Edit colors")}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="harbor-press-pop flex h-11 items-center gap-2 rounded-[8px] bg-ink px-4 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Copy size={18} strokeWidth={2.2} />
            {t("Copy theme")}
          </button>
        </div>
      </div>
    </div>
  );
}

function labelForLayout(l?: string): string {
  switch (l) {
    case "topdock":
      return "Top dock";
    case "rail":
      return "Side rail";
    case "stremio":
      return "Stremio rail";
    case "minui":
      return "Floating dock";
    case "dracula":
      return "Dracula sidebar";
    case "nord":
      return "Nord sidebar";
    case "forest":
      return "Forest sidebar";
    case "royal":
      return "Royal top bar";
    case "cinematic":
      return "Cinematic overlay";
    case "custom":
      return "Custom chrome";
    default:
      return "Sidebar layout";
  }
}

function labelForCard(c?: string): string {
  switch (c) {
    case "glass":
      return "Glass cards";
    case "stremio":
      return "Stremio cards";
    case "minui":
      return "Hairline cards";
    case "crunch":
      return "Crunch cards";
    case "noir":
      return "Noir cards";
    case "custom":
      return "Custom cards";
    default:
      return "Flat cards";
  }
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-ink/[0.10] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink">
      {children}
    </span>
  );
}
