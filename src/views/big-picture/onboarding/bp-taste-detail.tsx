import type { Meta } from "@/lib/cinemeta";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { useSettings } from "@/lib/settings";
import { useMemo } from "react";
import { BpOnboardAside } from "./bp-onboard-aside";

export function BpTasteDetail({ meta }: { meta: Meta | null }) {
  const { settings } = useSettings();
  const slides = useMemo(() => (meta ? [meta] : []), [meta?.id]);
  const logos = useHeroLogos(slides, settings);
  if (!meta) return null;

  const logo = meta.logo ?? logos[meta.id];
  const art = meta.background ?? meta.poster;
  const facts = [meta.releaseInfo, meta.genres?.[0]].filter(Boolean) as string[];
  const rating = meta.imdbRating?.trim();

  return (
    <BpOnboardAside>
      <div
        key={meta.id}
        className="flex flex-col gap-[clamp(9px,1.2vh,18px)] [animation:bp-step-in_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      >
        {art && (
          <span
            className="relative block w-full overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge)]"
            style={{ aspectRatio: "16 / 9" }}
          >
            <img
              src={art}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <span
              className="absolute inset-0"
              style={{
                background: "linear-gradient(0deg, var(--bp-void) 6%, transparent 58%)",
              }}
            />
          </span>
        )}

        {logo ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-[clamp(28px,4vh,58px)] w-auto max-w-[70%] self-start object-contain"
          />
        ) : (
          <span className="font-display text-[clamp(17px,2.4vh,32px)] font-semibold leading-tight text-ink">
            {meta.name}
          </span>
        )}

        {(rating || facts.length > 0) && (
          <span className="flex flex-wrap items-center gap-x-[clamp(8px,0.9vw,15px)] gap-y-[clamp(3px,0.4vh,7px)] text-[clamp(10px,1.35vh,15px)] font-semibold text-ink-subtle">
            {rating && (
              <span className="flex items-center gap-[clamp(5px,0.5vw,9px)] text-ink">
                <ImdbIcon className="h-[1.45em] w-auto shrink-0" />
                {rating}
              </span>
            )}
            {facts.map((f, i) => (
              <span key={f} className="flex items-center gap-[clamp(8px,0.9vw,15px)]">
                {(rating || i > 0) && (
                  <span aria-hidden className="opacity-40">
                    •
                  </span>
                )}
                {f}
              </span>
            ))}
          </span>
        )}

        {meta.description && (
          <span className="line-clamp-3 max-w-[46ch] text-[clamp(10.5px,1.4vh,16px)] leading-relaxed text-ink-subtle">
            {meta.description}
          </span>
        )}
      </div>
    </BpOnboardAside>
  );
}
