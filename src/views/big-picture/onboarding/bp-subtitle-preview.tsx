import { flagSrc } from "@/components/flag";
import { useBpT } from "../bp-i18n";
import { BpOnboardAside } from "./bp-onboard-aside";

const STILL = "https://image.tmdb.org/t/p/w780/eGX66zonvc4bXg3rM08RUxdYSDx.jpg";

export function BpSubtitlePreview({ languages }: { languages: string[] }) {
  const t = useBpT();
  const marks = languages.map(flagSrc).filter((s): s is string => s !== null);

  return (
    <BpOnboardAside>
      <div
        className="relative w-full overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge)]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <img
          src={STILL}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-70"
        />
        <span
          className="absolute inset-0"
          style={{ background: "linear-gradient(0deg, var(--bp-void) 4%, transparent 46%)" }}
        />
        <span className="absolute inset-x-0 bottom-[9%] flex justify-center px-[8%]">
          <span
            className="text-center text-[clamp(10px,1.5vh,19px)] font-semibold leading-snug text-ink"
            style={{ textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}
          >
            {t("This is how a subtitle will look.")}
          </span>
        </span>
      </div>

      {marks.length > 0 && (
        <div className="flex items-center gap-[clamp(6px,0.6vw,11px)]">
          {marks.slice(0, 6).map((src, i) => (
            <span
              key={src}
              className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--bp-edge)]"
              style={{ width: "clamp(24px, 2.7vw, 42px)", aspectRatio: "1" }}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[clamp(8px,1vh,12px)] font-bold text-ink"
                  style={{ background: "color-mix(in oklab, var(--bp-void) 62%, transparent)" }}
                >
                  1
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </BpOnboardAside>
  );
}
