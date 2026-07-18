import { useMemo } from "react";
import { AwardLogo } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import type { Meta } from "@/lib/cinemeta";
import type { AwardType } from "@/lib/providers/wikidata";
import { useT } from "@/lib/i18n";

const SLOTS = 10;

export function AwardHero({ type, tint, films }: { type: AwardType; tint: string; films: Meta[] }) {
  const t = useT();
  const meta = AWARD_CATALOG[type];

  const tiles = useMemo(() => {
    const imgs: string[] = [];
    for (const f of films) {
      const u = f.background ?? f.poster;
      if (u && !imgs.includes(u)) imgs.push(u);
      if (imgs.length >= SLOTS) break;
    }
    if (imgs.length < 3) return [];
    return Array.from({ length: SLOTS }, (_, i) => imgs[i % imgs.length]);
  }, [films]);

  const baseGradient = `radial-gradient(ellipse at 16% 26%, ${tint}24 0%, transparent 56%), radial-gradient(ellipse at 84% 72%, ${tint}18 0%, transparent 60%), linear-gradient(180deg, var(--color-canvas) 0%, color-mix(in oklab, var(--color-elevated) 62%, var(--color-canvas)) 100%)`;

  return (
    <header
      data-tauri-drag-region
      className="harbor-bleed-stremio relative flex h-[52vh] min-h-[460px] items-end overflow-hidden border-b border-edge-soft pb-14 pt-32"
      style={{ backgroundImage: baseGradient }}
    >
      {tiles.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-5 grid-rows-2 gap-2 p-2"
          style={{
            WebkitMaskImage: "linear-gradient(to right, transparent 8%, black 60%)",
            maskImage: "linear-gradient(to right, transparent 8%, black 60%)",
          }}
        >
          {tiles.map((src, i) => (
            <div key={i} className="overflow-hidden rounded-xl ring-1 ring-inset ring-white/[0.06]">
              <img
                src={src}
                alt=""
                draggable={false}
                className="h-full w-full object-cover opacity-[0.82]"
              />
            </div>
          ))}
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas via-canvas/75 to-canvas/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/10 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse at 14% 34%, ${tint}1f 0%, transparent 52%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          backgroundImage:
            "radial-gradient(38% 64% at 87% 64%, rgba(0,0,0,0.42) 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] items-end justify-between gap-12 px-12">
        <div className="flex max-w-2xl flex-col gap-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.36em] text-ink-subtle">
            {meta.shorthand}
          </span>
          <h1 className="font-display text-[68px] font-medium leading-[0.96] tracking-tight text-ink drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
            {meta.title}
          </h1>
          {meta.founded > 0 && (
            <p className="text-[13.5px] font-medium tabular-nums text-ink-muted">
              {t("Founded {year}", { year: meta.founded })}
              <span className="mx-3 opacity-40">·</span>
              <span style={{ color: tint }}>
                {t("{n} years", { n: new Date().getFullYear() - meta.founded })}
              </span>
            </p>
          )}
        </div>
        <div
          className="hidden items-center justify-center drop-shadow-[0_6px_28px_rgba(0,0,0,0.55)] lg:flex"
          style={{ color: tint }}
        >
          <Laurel size={210}>
            <AwardLogo type={type} size={86} />
          </Laurel>
        </div>
      </div>
    </header>
  );
}
