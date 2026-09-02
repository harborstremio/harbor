import { Star } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { SaveIcon, SkipIcon, ThumbsDownIcon } from "@/components/icons/harbor-glyphs";
import tideInfo from "@/assets/tide-info.png";
import type { FeedItem } from "@/lib/feed";
import { useT } from "@/lib/i18n";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useView } from "@/lib/view";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { useLiveImdbRating } from "@/lib/live-imdb";
import { ImdbIcon } from "./icons/imdb-icon";
import { MetaAwardsCorner } from "./meta-awards-corner";
import { Poster } from "./poster";

export function FeedHero({
  item,
  position,
  total,
  onSkip,
  onNotInterested,
}: {
  item: FeedItem;
  position: number;
  total: number;
  onSkip: () => void;
  onNotInterested?: () => void;
}) {
  const { settings } = useSettings();
  const { openMeta, openPicker } = useView();
  const t = useT();
  const meta = item.meta;
  const description = useLocalizedOverview(meta);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const live = useLiveImdbRating(meta);
  const saved = useInWatchlist(meta.id, [resolvedImdb]);
  const backdrop = meta.background
    ? meta.background.replace(/\/t\/p\/w\d+\//, "/t/p/w1280/")
    : meta.poster;
  const positionLabel = `${String(position + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <article className="harbor-feed-hero relative h-full overflow-hidden rounded-2xl border border-edge-soft bg-canvas">
      <div className="absolute inset-0">
        <Poster
          src={backdrop}
          fallbacks={[meta.poster]}
          seed={meta.id}
          ratio="wide"
          className="h-full w-full rounded-none"
        />
      </div>
        <div
          aria-hidden
          className="harbor-feed-scrim-b pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, oklch(0.10 0.02 260 / 0.97) 0%, oklch(0.10 0.02 260 / 0.86) 12%, oklch(0.10 0.02 260 / 0.6) 26%, oklch(0.10 0.02 260 / 0.33) 40%, oklch(0.10 0.02 260 / 0.12) 54%, oklch(0.10 0.02 260 / 0.0) 70%)",
          }}
        />
        <div
          aria-hidden
          className="harbor-feed-scrim-s pointer-events-none absolute inset-y-0 start-0 w-[58%] bg-gradient-to-r from-[oklch(0.10_0.02_260_/_0.62)] to-transparent rtl:bg-gradient-to-l"
        />

        <MetaAwardsCorner meta={meta} imdbId={resolvedImdb} />

        <div className="absolute inset-0 flex flex-col justify-between px-6 pt-5 pb-7 sm:px-10 sm:pb-9">
          <div className="flex shrink-0 items-center justify-between gap-4">
            <span className="harbor-feed-pos text-[12px] font-semibold uppercase tracking-[0.22em] text-ink/85">
              {positionLabel}
            </span>
            <button
              type="button"
              onClick={() => openMeta(meta)}
              aria-label={t("See details")}
              className="harbor-feed-info group relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/90 transition-colors duration-200 ease-out hover:text-ink"
            >
              <span
                aria-hidden
                className="absolute inset-0 scale-75 rounded-full bg-ink/10 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none"
              />
              <span
                aria-hidden
                className="relative block h-7 w-7 transition-transform duration-200 ease-out group-hover:scale-[1.08] group-active:scale-95 motion-reduce:transform-none [filter:drop-shadow(0_2px_7px_rgba(0,0,0,0.7))]"
                style={{
                  backgroundColor: "currentColor",
                  maskImage: `url(${tideInfo})`,
                  WebkitMaskImage: `url(${tideInfo})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            </button>
          </div>

          <div className="flex max-w-[760px] shrink-0 flex-col gap-3.5">
            <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.22em]">
              <span className="harbor-feed-tag rounded-full bg-accent/90 px-3 py-1 text-canvas">
                {item.tag}
              </span>
              {meta.type === "series" && item.tag.toLowerCase() !== "series" && (
                <span className="harbor-feed-tag-alt rounded-full border border-ink/30 px-3 py-1 text-ink/85">
                  {t("Series")}
                </span>
              )}
            </div>
            <h1 className="harbor-feed-title font-display text-[clamp(34px,4.2vw,52px)] font-medium leading-[1.05] tracking-tight text-ink drop-shadow-[0_2px_28px_rgba(0,0,0,0.55)] line-clamp-2 pb-[0.12em]">
              {meta.name}
            </h1>
          <div className="harbor-feed-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink/85">
            {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
            {meta.runtime && (
              <>
                <Dot />
                <span>{meta.runtime}</span>
              </>
            )}
            {live.value && (
              <>
                <Dot />
                <span className="inline-flex items-center gap-1.5">
                  {live.isImdb ? (
                    <ImdbIcon className="h-[12px] w-auto rounded-[2px]" />
                  ) : (
                    <Star className="h-[12px] w-[12px] text-amber-400" fill="currentColor" strokeWidth={0} />
                  )}
                  {live.value}
                </span>
              </>
            )}
            {meta.genres && meta.genres.length > 0 && (
              <>
                <Dot />
                <span>{meta.genres.slice(0, 3).join(", ")}</span>
              </>
            )}
          </div>
          {description && (
            <p className="harbor-feed-desc max-w-[68ch] text-[15.5px] leading-[1.55] text-ink/80 line-clamp-2">
              {description}
            </p>
          )}
          <div className="harbor-feed-actions mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={() => openPicker(meta, smartPlayEpisode(meta), { autoPlay: settings.instantPlay })}
              className="harbor-feed-cta flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas shadow-[0_2px_10px_-4px_rgba(0,0,0,0.4)] transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-ink/90 hover:shadow-[0_10px_26px_-10px_rgba(0,0,0,0.55)]"
            >
              <Play size={18} fill="currentColor" />
              <span>{t("Play tonight")}</span>
            </button>
            <SecondaryAction
              icon={<SaveIcon size={18} />}
              label={saved ? t("Saved") : t("Save")}
              onClick={() =>
                toggleWatchlist({
                  id: meta.id,
                  type: meta.type,
                  name: meta.name,
                  poster: meta.poster,
                  imdbId: resolvedImdb,
                  addonOrigin: meta.addonOrigin,
                  videos: meta.videos,
                })
              }
              active={saved}
            />
            <SecondaryAction
              icon={<SkipIcon size={18} />}
              label={t("Skip")}
              onClick={onSkip}
            />
            {onNotInterested && (
              <SecondaryAction
                icon={<ThumbsDownIcon size={18} />}
                label={t("Not interested")}
                onClick={onNotInterested}
              />
            )}
          </div>
          </div>
        </div>
    </article>
  );
}

function Dot() {
  return <span aria-hidden className="text-ink/40">·</span>;
}

function SecondaryAction({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`harbor-feed-chip flex h-12 items-center gap-2 rounded-full border px-5 text-[14px] font-medium transition-colors duration-200 ${
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-ink/15 bg-canvas/30 text-ink/85 hover:border-ink/30 hover:bg-canvas/55 hover:text-ink"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

