import harborStyleImg from "@/assets/onboarding/harborstyle.webp";
import traditionalStyleImg from "@/assets/onboarding/traditional.webp";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { PreviewImage } from "@/views/settings/preview-image";

export function LayoutStep() {
  const { settings, update } = useSettings();
  const t = useT();
  const choice = settings.homeMode;
  const options: Array<{
    id: "harbor" | "classic";
    label: string;
    sub: string;
    img: string;
  }> = [
    {
      id: "harbor",
      label: t("Harbor curated"),
      sub: t("Hero, Top 10, Trending, In Theaters, per-service rails. Your addons append underneath."),
      img: harborStyleImg,
    },
    {
      id: "classic",
      label: t("Classic Stremio"),
      sub: t("Continue Watching, then your addon catalogs in install order. No hero, no Harbor rails."),
      img: traditionalStyleImg,
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[26px] font-medium leading-tight tracking-tight text-ink">
          {t("Pick a home layout")}
        </h2>
        <p className="text-[14px] leading-relaxed text-ink-muted">
          {t("You can switch later in Settings under Library & metadata.")}
        </p>
      </div>
      <div role="radiogroup" aria-label={t("Pick a home layout")} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((opt) => {
          const selected = choice === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ homeMode: opt.id })}
              className="group flex flex-col gap-3 rounded-2xl text-start"
            >
              <span
                className={`block overflow-hidden rounded-xl border-2 bg-canvas transition-colors duration-200 ease-out ${
                  selected ? "border-ink" : "border-edge-soft group-hover:border-edge"
                }`}
              >
                <PreviewImage
                  src={opt.img}
                  className="block aspect-[16/10] w-full select-none object-cover object-top"
                />
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                      selected ? "border-ink" : "border-edge"
                    }`}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-ink" />}
                  </span>
                  <span
                    className={`text-[15px] tracking-tight transition-colors duration-200 ${
                      selected ? "font-semibold text-ink" : "font-medium text-ink-muted group-hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </span>
                </span>
                <span className="ps-[26px] text-[12.5px] leading-relaxed text-ink-subtle">
                  {opt.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
