import {
  Check,
  ChevronDown,
  Ghost,
  Heart,
  MessageSquareWarning,
  Plus,
  ShieldAlert,
  Star,
  Swords,
  ThumbsUp,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PreviewData } from "@/lib/hover-preview/preview-data";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { markMetaWatched } from "@/lib/mark-watched";
import {
  harborImdbParental,
  harborImdbParentalCached,
  type ParentalCategory,
} from "@/lib/providers/harbor-imdb";
import { tmdbImdbCached } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { useT } from "@/lib/i18n";
import { PreviewBlock } from "./block";
import { CrownArt, PreviewCrown } from "./crown";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function useCrownLogo(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const [logo, setLogo] = useState<string | undefined>(
    () => meta.logo ?? peekCachedLogo(settings.tmdbKey, meta),
  );
  useEffect(() => {
    if (meta.logo) {
      setLogo(meta.logo);
      return;
    }
    const cached = peekCachedLogo(settings.tmdbKey, meta);
    if (cached) {
      setLogo(cached);
      return;
    }
    let alive = true;
    resolveLogo(settings.tmdbKey, meta)
      .then((l) => alive && l && setLogo(l))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [meta, settings.tmdbKey]);
  return logo;
}

const ADVISORY_SEV: Record<string, number> = { Mild: 1, Moderate: 2, Severe: 3 };
const ADVISORY_COLOR: Record<string, string> = {
  Severe: "text-red-300",
  Moderate: "text-amber-300",
  Mild: "text-ink-subtle",
};

function advisoryChip(category: string): { Icon: LucideIcon; label: string; builtIn: boolean } {
  const c = category.toLowerCase();
  if (c.includes("sex") || c.includes("nudity"))
    return { Icon: Heart, label: "Nudity", builtIn: true };
  if (c.includes("violence") || c.includes("gore"))
    return { Icon: Swords, label: "Violence", builtIn: true };
  if (c.includes("profanity"))
    return { Icon: MessageSquareWarning, label: "Language", builtIn: true };
  if (c.includes("alcohol") || c.includes("drug") || c.includes("smoking")) {
    return { Icon: Wine, label: "Substances", builtIn: true };
  }
  if (c.includes("frighten") || c.includes("intense"))
    return { Icon: Ghost, label: "Intense", builtIn: true };
  return { Icon: ShieldAlert, label: category, builtIn: false };
}

function useAdvisory(imdbId: string | undefined): ParentalCategory[] {
  const [cats, setCats] = useState<ParentalCategory[]>(() =>
    imdbId ? (harborImdbParentalCached(imdbId) ?? []) : [],
  );
  useEffect(() => {
    if (!imdbId) {
      setCats([]);
      return;
    }
    const cached = harborImdbParentalCached(imdbId);
    if (cached) {
      setCats(cached);
      return;
    }
    let alive = true;
    harborImdbParental(imdbId)
      .then((c) => alive && setCats(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [imdbId]);
  return cats;
}

function AdvisoryStrip({ imdbId }: { imdbId: string | undefined }) {
  const t = useT();
  const cats = useAdvisory(imdbId);
  const rated = cats
    .filter((c) => ADVISORY_SEV[c.severity])
    .sort((a, b) => (ADVISORY_SEV[b.severity] ?? 0) - (ADVISORY_SEV[a.severity] ?? 0))
    .slice(0, 4);
  if (rated.length === 0) return null;
  return (
    <div data-stagger="2" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {rated.map((c) => {
        const { Icon, label, builtIn } = advisoryChip(c.category);
        const displayLabel = builtIn ? t(label) : label;
        return (
          <span
            key={c.category}
            title={`${displayLabel} · ${t(c.severity)}`}
            className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${ADVISORY_COLOR[c.severity] ?? "text-ink-subtle"}`}
          >
            <Icon size={13} strokeWidth={2} />
            <span className="text-ink-muted">{displayLabel}</span>
          </span>
        );
      })}
    </div>
  );
}

function MarqueeCrown({ data, height }: { data: PreviewData; height: number }) {
  const logo = useCrownLogo(data.meta);
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <CrownArt art={data.art} seed={data.meta.id} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, color-mix(in oklab, var(--color-canvas) 80%, transparent) 0%, color-mix(in oklab, var(--color-canvas) 22%, transparent) 44%, transparent 70%)",
        }}
      />
      <div data-stagger="0" className="absolute inset-x-5 bottom-4 flex max-w-[72%] items-end">
        {logo ? (
          <img
            src={logo}
            alt={data.meta.name}
            draggable={false}
            className="max-h-[48px] w-auto max-w-full object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
          />
        ) : (
          <h3 className="line-clamp-2 font-display text-[21px] font-semibold leading-[1.12] tracking-[-0.01em] text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {data.meta.name}
          </h3>
        )}
      </div>
    </div>
  );
}

function CircleAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-[transform,background-color,border-color,color] duration-150 hover:scale-105 active:scale-95 ${
        active
          ? "border-ink bg-ink/10 text-ink"
          : "border-edge text-ink-muted hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function MarqueeBlock({
  data,
  onPlay,
  onDetails,
}: {
  data: PreviewData;
  onPlay: () => void;
  onDetails: () => void;
}) {
  const t = useT();
  const meta = data.meta;
  const alt = tmdbImdbCached(meta.id);
  const imdb = meta.id.startsWith("tt") ? meta.id : (alt ?? undefined);
  const altIds = useMemo(() => [alt ?? undefined], [alt]);
  const inList = useInWatchlist(meta.id, altIds);
  const [watched, setWatched] = useState(false);
  const genres = (meta.genres ?? []).slice(0, 3);
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-5 pt-3.5">
      <div data-stagger="1" className="flex items-center gap-2.5">
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("Play")}
          title={t("Play")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            stop(e);
            onPlay();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-canvas transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <Play size={20} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
        </button>
        <CircleAction
          label={inList ? t("Remove from watchlist") : t("Add to watchlist")}
          active={inList}
          onClick={(e) => {
            stop(e);
            toggleWatchlist({
              id: meta.id,
              type: meta.type,
              name: meta.name,
              poster: meta.poster,
              imdbId: alt ?? undefined,
              addonOrigin: meta.addonOrigin,
              videos: meta.videos,
            });
          }}
        >
          {inList ? <Check size={18} strokeWidth={2.7} /> : <Plus size={18} strokeWidth={2.7} />}
        </CircleAction>
        <CircleAction
          label={t("Mark watched")}
          active={watched}
          onClick={(e) => {
            stop(e);
            setWatched(true);
            void markMetaWatched(
              meta,
              imdb ?? null,
              meta.id.startsWith("tmdb:") ? meta.id.split(":")[2] : null,
            );
          }}
        >
          <ThumbsUp size={17} strokeWidth={2.3} fill={watched ? "currentColor" : "none"} />
        </CircleAction>
        <div className="ms-auto">
          <CircleAction
            label={t("More info")}
            onClick={(e) => {
              stop(e);
              onDetails();
            }}
          >
            <ChevronDown size={20} strokeWidth={2.6} />
          </CircleAction>
        </div>
      </div>
      <div
        data-stagger="2"
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] font-medium text-ink-muted"
      >
        {data.contentRating && (
          <span className="rounded-[4px] border border-edge px-1.5 py-px text-[11px] font-semibold tracking-[0.03em] text-ink-muted">
            {data.contentRating}
          </span>
        )}
        {data.rating && (
          <span className="inline-flex items-center gap-1 text-ink">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {data.rating.value}
          </span>
        )}
        {data.length ? (
          <span className="tabular-nums">{titleCase(data.length)}</span>
        ) : (
          data.year && <span className="tabular-nums">{data.year}</span>
        )}
      </div>
      <AdvisoryStrip imdbId={imdb} />
      {genres.length > 0 && (
        <div
          data-stagger="2"
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink"
        >
          {genres.map((g, i) => (
            <Fragment key={g}>
              {i > 0 && <span className="text-[7px] text-accent/70">{"●"}</span>}
              <span>{g}</span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreviewBody({
  data,
  crownH,
  marquee,
  onPlay,
  onDetails,
}: {
  data: PreviewData;
  crownH: number;
  marquee: boolean;
  onPlay: () => void;
  onDetails: () => void;
}) {
  if (marquee) {
    return (
      <>
        <MarqueeCrown data={data} height={crownH} />
        <MarqueeBlock data={data} onPlay={onPlay} onDetails={onDetails} />
      </>
    );
  }
  return (
    <>
      <PreviewCrown data={data} height={crownH} />
      <PreviewBlock data={data} onDetails={onDetails} />
    </>
  );
}
