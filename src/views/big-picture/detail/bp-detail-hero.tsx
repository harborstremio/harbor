import { Text } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { LibraryItem } from "@/lib/stremio";
import type { TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import type { PlayEpisode } from "@/lib/view";
import { MetaAwardsCorner } from "@/components/meta-awards-corner";
import { useSettings } from "@/lib/settings";
import { BpDetailActions } from "../bp-detail-actions";
import { useBpT } from "../bp-i18n";
import { BpScoreChips } from "../bp-score-chips";
import { bpFacts } from "../bp-spotlight";
import type { BpCardBadge } from "../use-bp-card-badges";
import type { BpDetailAction } from "../use-bp-detail-actions";
import { BpHeroMarks, BpTmdbKeyNote } from "./bp-hero-notes";
import { BpSynopsis, useBpSynopsis } from "./bp-synopsis";
import type { MediaServerConnection } from "@/lib/media-server/types";

export function BpDetailHero({
  meta,
  detail,
  heroLogo,
  badges,
  imdbId,
  inLibrary,
  homeServers,
  mark,
  cwEntry,
  actions,
  onPlay,
}: {
  meta: Meta;
  detail: TmdbDetail | null;
  heroLogo?: string;
  badges: readonly BpCardBadge[];
  imdbId: string | null;
  inLibrary: boolean;
  homeServers: readonly MediaServerConnection[];
  mark: { ep?: PlayEpisode; resumed: boolean };
  cwEntry?: LibraryItem | null;
  actions: BpDetailAction[];
  onPlay: () => void;
}) {
  const t = useBpT();
  const { settings } = useSettings();

  const logo = heroLogo ?? detail?.logo ?? meta.logo;
  const overview = detail?.overview || meta.description || "";
  const synopsis = useBpSynopsis(overview);
  const offset = cwEntry?.state?.timeOffset ?? 0;
  const duration = cwEntry?.state?.duration ?? 0;
  const playLabel =
    mark.resumed && mark.ep
      ? t("Resume S{s}:E{e}", {
          s: mark.ep.imdbSeason ?? mark.ep.season,
          e: mark.ep.imdbEpisode ?? mark.ep.episode,
        })
      : offset > 60000
        ? t("Resume")
        : t("Play");

  return (
    <div className="relative flex min-h-[clamp(420px,58vh,760px)] flex-col justify-end px-[var(--bp-gutter)] pb-[clamp(16px,2.2vh,38px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]">
      {logo ? (
        <img
          src={logo}
          alt={meta.name}
          data-bp-detail-logo
          className="max-h-[clamp(107px,16.7vh,160px)] w-auto max-w-[min(28vw,320px)] self-start object-contain drop-shadow-[0_5px_22px_rgba(0,0,0,0.7)]"
        />
      ) : (
        <h1 className="line-clamp-2 max-w-[min(36vw,410px)] font-display text-[clamp(52px,8.1vh,84px)] font-semibold leading-[1.06] tracking-[-0.028em] text-ink">
          {meta.name}
        </h1>
      )}

      {detail?.tagline && (
        <p
          data-bp-detail-tagline
          className="mt-[12px] max-w-[min(36vw,410px)] text-[13.4px] font-medium italic leading-snug text-ink-muted"
        >
          {detail.tagline}
        </p>
      )}

      <div
        data-bp-hero-meta
        className="mt-[13px] flex flex-wrap items-center gap-x-[16px] gap-y-[6px] text-[13.4px] font-semibold tracking-[0.015em] text-ink-subtle"
      >
        {/* showDetailRatings and every per-provider detail flag are resolved
            inside useBpCardBadges, so an empty set here means the user turned
            them off, not that the hero forgot to ask. */}
        <BpScoreChips badges={badges} />
        {bpFacts(meta, detail).map((f) => (
          <span key={f} className="flex items-center">
            {f}
          </span>
        ))}
        <BpHeroMarks meta={meta} inLibrary={inLibrary} homeServers={homeServers} />
      </div>

      <div className="mt-[14px]">
        <BpDetailActions
          playLabel={playLabel}
          onPlay={onPlay}
          actions={actions}
          progress={duration > 0 ? offset / duration : 0}
          trailing={
            synopsis.canExpand
              ? {
                  key: "synopsis",
                  label: synopsis.expanded ? t("Show less") : t("Read more"),
                  icon: Text,
                  active: synopsis.expanded,
                  onPress: synopsis.toggle,
                }
              : undefined
          }
        />
      </div>

      <BpSynopsis text={overview} state={synopsis} />
      {!settings.tmdbKey && <BpTmdbKeyNote />}

      <div
        data-bp-detail-awards
        className="pointer-events-none absolute inset-y-0 start-0 end-[calc(var(--bp-gutter)_-_40px)]"
      >
        <MetaAwardsCorner meta={meta} imdbId={imdbId} />
      </div>
    </div>
  );
}
