import { Bookmark } from "lucide-react";
import { memo, useMemo } from "react";
import { awardSourceMeta, findTopAward, parseAwardYear } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import { useContextMenu } from "@/lib/context-menu";
import {
  hoverPreviewBlur,
  hoverPreviewEnter,
  hoverPreviewFocus,
  hoverPreviewLeave,
} from "@/lib/hover-preview/store";
import { useT } from "@/lib/i18n";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useInWatchlist } from "@/lib/watchlist";
import { Poster, usePosterChain } from "./poster";

function AwardDot({ name, year }: { name: string; year?: number }) {
  const win = findTopAward(name, year);
  if (!win) return null;
  const src = awardSourceMeta(win.source);
  return (
    <span
      className="pointer-events-none absolute start-1.5 top-1.5 flex h-6 items-center gap-1 rounded-md bg-canvas/90 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink ring-1 ring-edge-soft/60 backdrop-blur-sm"
      title={`${src.name} · ${win.categoryName} (${win.year})`}
    >
      <img
        src={src.iconSmall}
        alt=""
        width={10}
        height={10}
        className={`h-2.5 w-2.5 shrink-0 object-contain ${win.source === "animation_kobe" ? "brightness-0 invert" : ""}`}
        draggable={false}
      />
      <span className="whitespace-nowrap">{win.year}</span>
    </span>
  );
}

function WatchlistDot() {
  const t = useT();
  return (
    <span
      className="pointer-events-none absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-canvas/85 text-ink ring-1 ring-edge-soft/70 backdrop-blur-sm"
      title={t("In your watchlist")}
      aria-label={t("In watchlist")}
    >
      <Bookmark size={11} strokeWidth={2.6} fill="currentColor" />
    </span>
  );
}

export const TopRankCard = memo(function TopRankCard({ meta, rank }: { meta: Meta; rank: number }) {
  const { openMeta } = useView();
  const { open: openContextMenu } = useContextMenu();
  const { settings } = useSettings();
  const resolvedImdb = useTmdbImdbId(meta.id);
  const altIds = useMemo(() => [resolvedImdb], [resolvedImdb]);
  const inWatchlist = useInWatchlist(meta.id, altIds);
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      onClick={() => openMeta(meta)}
      onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta })}
      onFocus={(e) => hoverPreviewFocus(meta, e.currentTarget)}
      onBlur={(e) => hoverPreviewBlur(e.currentTarget)}
      className="group relative w-full min-w-0"
      style={{ aspectRatio: "228 / 268", containerType: "inline-size" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -start-[3%] top-0 font-bold leading-[0.85] text-transparent"
        style={{
          fontFamily: '"Fraunces", "Iowan Old Style", "Georgia", serif',
          fontSize: "calc(100cqw * 240 / 228)",
          letterSpacing: "-0.05em",
          WebkitTextStroke: "2.4px var(--color-ink-muted)",
        }}
      >
        {rank}
      </span>
      <div
        data-preview-anchor
        onPointerEnter={(e) => hoverPreviewEnter(meta, e.currentTarget, e.buttons)}
        onPointerLeave={(e) => hoverPreviewLeave(e.currentTarget)}
        className="absolute end-0 top-0 z-10 w-[60%] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-2"
      >
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={meta.id}
          ratio="portrait"
          className="harbor-card-ring rounded-xl shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 group-hover:shadow-[0_24px_44px_-14px_rgba(0,0,0,0.6)]"
        />
        {inWatchlist && <WatchlistDot />}
        <AwardDot name={meta.name} year={parseAwardYear(meta.releaseInfo)} />
      </div>
      <p className="absolute bottom-0 end-0 w-[63%] truncate text-[12px] text-ink-subtle">
        {meta.name}
      </p>
    </button>
  );
});

export const AnimeRankCard = memo(function AnimeRankCard({
  meta,
  rank,
}: {
  meta: Meta;
  rank: number;
}) {
  const { openMeta } = useView();
  const { open: openContextMenu } = useContextMenu();
  const { settings } = useSettings();
  const resolvedImdb = useTmdbImdbId(meta.id);
  const altIds = useMemo(() => [resolvedImdb], [resolvedImdb]);
  const inWatchlist = useInWatchlist(meta.id, altIds);
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      onClick={() => openMeta(meta)}
      onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta })}
      onFocus={(e) => hoverPreviewFocus(meta, e.currentTarget)}
      onBlur={(e) => hoverPreviewBlur(e.currentTarget)}
      className="group relative w-full min-w-0"
      style={{ aspectRatio: "228 / 268", containerType: "inline-size" }}
    >
      <span
        aria-hidden
        className="font-anime pointer-events-none absolute -start-[3%] top-0 font-bold leading-[0.85] text-transparent"
        style={{
          fontSize: "calc(100cqw * 240 / 228)",
          letterSpacing: "-0.02em",
          WebkitTextStroke: "2.6px var(--color-ink-muted)",
        }}
      >
        {rank}
      </span>
      <div
        data-preview-anchor
        onPointerEnter={(e) => hoverPreviewEnter(meta, e.currentTarget, e.buttons)}
        onPointerLeave={(e) => hoverPreviewLeave(e.currentTarget)}
        className="absolute end-0 top-0 z-10 w-[60%] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-2"
      >
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={meta.id}
          ratio="portrait"
          className="harbor-card-ring rounded-xl shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 group-hover:shadow-[0_24px_44px_-14px_rgba(0,0,0,0.6)]"
        />
        {inWatchlist && <WatchlistDot />}
        <AwardDot name={meta.name} year={parseAwardYear(meta.releaseInfo)} />
      </div>
      <p className="absolute bottom-0 end-0 w-[63%] truncate text-[12px] text-ink-subtle">
        {meta.name}
      </p>
    </button>
  );
});
