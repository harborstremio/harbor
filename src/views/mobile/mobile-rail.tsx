import { ChevronRight, Star } from "lucide-react";
import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { Poster } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { usePosterChain } from "@/components/poster";
import { findTopAward, awardSourceMeta, parseAwardYear } from "@/lib/anime-awards";
import { resolveAwardIcon, useAwardPacks } from "@/lib/award-icons";
import { useMobileRemote } from "./mobile-remote";
import { mergePreferredMeta } from "@/lib/preferred-meta";
import { usePreferredMeta } from "@/lib/use-preferred-meta";

type OpenDetail = (m: Meta) => void;

export function MobileRail({
  title,
  metas,
  onSeeAll,
  onOpenDetail,
  variant = "poster",
}: {
  title: string;
  metas: Meta[];
  onSeeAll?: () => void;
  onOpenDetail?: OpenDetail;
  variant?: "poster" | "landscape";
}) {
  if (metas.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onSeeAll}
        disabled={!onSeeAll}
        className="flex items-center gap-1 px-4 text-start disabled:cursor-default"
      >
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
        {onSeeAll && <ChevronRight size={19} strokeWidth={2.4} className="text-ink-subtle" />}
      </button>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {metas.map((m) =>
          variant === "poster" ? (
            <PosterTile key={m.id} meta={m} onOpenDetail={onOpenDetail} />
          ) : (
            <LandscapeTile key={m.id} meta={m} onOpenDetail={onOpenDetail} />
          ),
        )}
      </div>
    </section>
  );
}

export function MobileRankRail({
  title,
  metas,
  onSeeAll,
  onOpenDetail,
}: {
  title: string;
  metas: Meta[];
  onSeeAll?: () => void;
  onOpenDetail?: OpenDetail;
}) {
  if (metas.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onSeeAll}
        disabled={!onSeeAll}
        className="flex items-center gap-1 px-4 text-start disabled:cursor-default"
      >
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
        {onSeeAll && <ChevronRight size={19} strokeWidth={2.4} className="text-ink-subtle" />}
      </button>
      <div className="flex gap-1 overflow-x-auto ps-4 pe-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {metas.slice(0, 10).map((m, i) => (
          <RankTile key={m.id} meta={m} rank={i + 1} onOpenDetail={onOpenDetail} />
        ))}
      </div>
    </section>
  );
}

function useOpen(onOpenDetail?: OpenDetail) {
  const { openOnHost } = useMobileRemote();
  return (meta: Meta) => (onOpenDetail ? onOpenDetail(meta) : openOnHost(meta));
}

function useDisplayMeta(meta: Meta): Meta {
  const preferred = usePreferredMeta(meta);
  return useMemo(() => mergePreferredMeta(meta, preferred), [meta, preferred]);
}

function RankTile({ meta, rank, onOpenDetail }: { meta: Meta; rank: number; onOpenDetail?: OpenDetail }) {
  const { settings } = useSettings();
  const open = useOpen(onOpenDetail);
  const displayMeta = useDisplayMeta(meta);
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      type="button"
      onClick={() => open(displayMeta)}
      className="w-[150px] shrink-0 text-start transition-transform duration-150 active:scale-[0.97]"
    >
      <div className="relative w-full" style={{ aspectRatio: "150 / 176" }}>
        <span
          aria-hidden
          className="pointer-events-none absolute -start-[4%] top-0 font-medium leading-[0.82] text-transparent"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: rank >= 10 ? "118px" : "158px",
            letterSpacing: "-0.05em",
            WebkitTextStroke: "2.2px var(--color-ink-muted)",
          }}
        >
          {rank}
        </span>
        <div className="absolute end-0 top-0 w-[62%]">
          <Poster src={src} onError={onError} seed={meta.id} ratio="portrait" lazy className="rounded-[12px]" />
        </div>
      </div>
      <p className="mt-1.5 line-clamp-1 ps-[38%] text-[12px] font-medium text-ink-muted">{displayMeta.name}</p>
    </button>
  );
}

export function PosterTile({ meta, onOpenDetail }: { meta: Meta; onOpenDetail?: OpenDetail }) {
  const { settings } = useSettings();
  const open = useOpen(onOpenDetail);
  const displayMeta = useDisplayMeta(meta);
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  const award = findTopAward(meta.name, parseAwardYear(meta.releaseInfo));
  return (
    <button
      type="button"
      onClick={() => open(displayMeta)}
      className="w-[124px] shrink-0 text-start transition-transform duration-150 active:scale-[0.96]"
    >
      <Poster src={src} onError={onError} seed={meta.id} ratio="portrait" lazy className="rounded-[14px]">
        {award && <AwardCorner award={award} />}
        {!settings.rpdbKey && meta.imdbRating && (
          <span className="pointer-events-none absolute bottom-1.5 end-1.5 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
            <Star size={9} strokeWidth={0} fill="#f5c518" className="text-[#f5c518]" />
            {meta.imdbRating}
          </span>
        )}
      </Poster>
      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-ink-muted">{displayMeta.name}</p>
    </button>
  );
}

function AwardCorner({ award }: { award: ReturnType<typeof findTopAward> }) {
  useAwardPacks();
  if (!award) return null;
  const src = awardSourceMeta(award.source);
  const custom = resolveAwardIcon(award.source);
  return (
    <span className="pointer-events-none absolute end-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
      <img
        src={custom ?? src.iconSmall}
        alt=""
        width={10}
        height={10}
        className={`h-2.5 w-2.5 object-contain ${!custom && award.source === "animation_kobe" ? "brightness-0 invert" : ""}`}
      />
      {award.year}
    </span>
  );
}

function LandscapeTile({ meta, onOpenDetail }: { meta: Meta; onOpenDetail?: OpenDetail }) {
  const open = useOpen(onOpenDetail);
  const displayMeta = useDisplayMeta(meta);
  const bg = meta.background ?? meta.poster;
  return (
    <button
      type="button"
      onClick={() => open(displayMeta)}
      className="w-[240px] shrink-0 text-start transition-transform duration-150 active:scale-[0.97]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[14px] bg-surface ring-1 ring-edge-soft/50">
        {bg && (
          <img src={bg} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-[13px] font-medium text-ink-muted">{displayMeta.name}</p>
    </button>
  );
}
