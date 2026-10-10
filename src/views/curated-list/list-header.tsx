import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { formatAirDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import type { CuratedList } from "@/lib/curated/types";
import { openUrl } from "@/lib/window";

const SLOTS = 18;

const SOURCE_NAME: Partial<Record<CuratedList["source"]["kind"], string>> = {
  trakt: "Trakt",
  wikidata: "Wikidata",
};

const MOSAIC_MASK = [
  "linear-gradient(to right, transparent 6%, rgba(0,0,0,0.18) 30%, rgba(0,0,0,0.62) 56%, black 82%)",
  "linear-gradient(to bottom, transparent 0%, black 20%, black 66%, transparent 100%)",
  "radial-gradient(125% 135% at 86% 48%, black 26%, rgba(0,0,0,0.32) 76%, transparent 100%)",
].join(", ");

export function ListHeader({ list }: { list: CuratedList }) {
  const t = useT();
  const tiles = useMemo(() => {
    const imgs = list.head
      .slice(0, SLOTS)
      .map((item) => `https://images.metahub.space/background/medium/${item.imdb}/img`);
    if (imgs.length < 3) return [];
    return Array.from({ length: SLOTS }, (_, i) => imgs[i % imgs.length]);
  }, [list]);
  const sourceUrl = list.source.url;
  const sourceName = SOURCE_NAME[list.source.kind] ?? null;

  return (
    <header
      data-tauri-drag-region
      className="harbor-bleed-stremio relative flex min-h-[420px] items-end overflow-hidden border-b border-edge-soft pb-14 pt-32"
    >
      {tiles.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-6 grid-rows-3"
          style={{
            WebkitMaskImage: MOSAIC_MASK,
            maskImage: MOSAIC_MASK,
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
          }}
        >
          {tiles.map((src, i) => (
            <div key={`${src}-${i}`} className="overflow-hidden">
              <img
                src={src}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                className="h-full w-full scale-[1.04] object-cover"
                style={{ opacity: 0.72 }}
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

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-12">
        <span className="text-[11px] font-bold uppercase tracking-[0.36em] text-ink-subtle">
          {t(list.curator)}
        </span>
        <h1 className="max-w-3xl font-display text-[clamp(38px,4.6vw,60px)] font-medium leading-[1.02] tracking-tight text-ink drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
          {t(list.title)}
        </h1>
        <p className="max-w-2xl text-[16.5px] leading-[1.65] text-ink-muted">{t(list.blurb)}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-ink-subtle">
          {list.publishedYear != null && (
            <>
              <span className="tabular-nums">{list.publishedYear}</span>
              <span aria-hidden className="opacity-40">
                ·
              </span>
            </>
          )}
          <span className="tabular-nums">
            {t("{n} titles", { n: list.count.toLocaleString() })}
          </span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span>{t("Snapshot {date}", { date: formatAirDate(list.snapshotDate) })}</span>
          {sourceUrl && sourceName && (
            <>
              <span aria-hidden className="opacity-40">
                ·
              </span>
              <button
                type="button"
                onClick={() => openUrl(sourceUrl)}
                className="inline-flex items-center gap-1 rounded text-ink-subtle underline-offset-4 transition-colors hover:text-ink hover:underline focus:border-ink-subtle focus:outline-none focus:ring-1 focus:ring-inset focus:ring-ink-subtle"
              >
                {sourceName} <ExternalLink size={13} />
              </button>
            </>
          )}
        </p>
      </div>
    </header>
  );
}
