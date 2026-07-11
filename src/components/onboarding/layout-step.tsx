import harborStyleImg from "@/assets/onboarding/harborstyle.png";
import traditionalStyleImg from "@/assets/onboarding/traditional.png";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {options.map((opt) => {
          const selected = choice === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ homeMode: opt.id })}
              className={`group relative h-[200px] overflow-hidden rounded-2xl border bg-canvas text-start transition-all ${
                selected ? "border-ink shadow-[0_0_0_3px_rgba(255,255,255,0.04)]" : "border-edge-soft hover:border-edge"
              }`}
            >
              <img
                src={opt.img}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-canvas/95 via-canvas/45 to-transparent"
              />
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 bg-canvas/82 transition-opacity duration-300 ease-out ${
                  selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              />
              <span
                className={`absolute end-3 top-3 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-canvas/85 transition-colors ${
                  selected ? "border-ink" : "border-edge"
                }`}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
              </span>
              <span
                className={`absolute bottom-4 start-5 z-10 text-[15px] font-semibold tracking-tight text-ink drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${
                  selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"
                }`}
              >
                {opt.label}
              </span>
              <div
                className={`absolute inset-5 z-10 flex flex-col justify-center gap-2 transition-opacity duration-300 ${
                  selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <span className="text-[16px] font-semibold tracking-tight text-ink">{opt.label}</span>
                <span className="max-w-[88%] text-[12.5px] leading-relaxed text-ink-muted">{opt.sub}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
