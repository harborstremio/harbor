import { ChevronLeft, Star } from "lucide-react";
import { narrowMediaType, type Meta } from "@/lib/cinemeta";
import { Poster, usePosterChain } from "@/components/poster";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { HeroAwardsCorner } from "@/views/detail/hero-awards";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import { LocalLibraryBrand } from "@/components/local-library-brand";
import { MediaServerBrand, mediaServerProviderName } from "@/components/media-server-brand";
import type { MediaServerProvider } from "@/lib/media-server/types";
import { Pill } from "./ui";

type HeroSummary = { type: string; wins: number; nominations: number }[];

export function Hero({
  meta,
  detail,
  title,
  logo,
  backdrop,
  year,
  rating,
  isImdb,
  runtime,
  genres,
  awardSummary,
  availability,
  onBack,
}: {
  meta: Meta;
  detail: TmdbDetail | null;
  title: string;
  logo?: string;
  backdrop?: string;
  year: string;
  rating?: string;
  isImdb: boolean;
  runtime?: string;
  genres: string[];
  awardSummary: HeroSummary;
  availability: { local: boolean; providers: MediaServerProvider[] };
  onBack: () => void;
}) {
  const t = useT();
  return (
    <div className="relative">
      <div className="relative aspect-[3/4] max-h-[62vh] w-full overflow-hidden bg-surface">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/45 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
      </div>

      <button
        type="button"
        onClick={onBack}
        aria-label={t("Back")}
        className="absolute start-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform active:scale-95 motion-reduce:transition-none"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <ChevronLeft size={22} strokeWidth={2.4} />
      </button>

      {awardSummary.length > 0 && (
        <div
          className="absolute end-3 z-10"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
        >
          <HeroAwardsCorner
            summary={awardSummary}
            inline
            onDark
            className="max-w-[58vw] text-end"
          />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 px-5 pb-1">
        <HeroPoster meta={meta} detail={detail} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pb-1">
          {logo ? (
            <img
              src={logo}
              alt={title}
              className="max-h-[54px] max-w-[86%] object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <h1 className="font-display text-[24px] font-medium leading-[1.05] tracking-tight text-ink">
              {title}
            </h1>
          )}
          <MetaPills
            year={year}
            rating={rating}
            isImdb={isImdb}
            runtime={runtime}
            genres={genres}
            availability={availability}
          />
        </div>
      </div>
    </div>
  );
}

function HeroPoster({ meta, detail }: { meta: Meta; detail: TmdbDetail | null }) {
  const { settings } = useSettings();
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster || detail?.poster,
    narrowMediaType(meta.type),
  );
  return (
    <div className="w-[92px] shrink-0">
      <Poster
        src={src}
        onError={onError}
        seed={meta.id}
        ratio="portrait"
        className="rounded-xl shadow-[0_12px_32px_-14px_rgba(0,0,0,0.7)] ring-1 ring-edge-soft/70"
      />
    </div>
  );
}

function MetaPills({
  year,
  rating,
  isImdb,
  runtime,
  genres,
  availability,
}: {
  year: string;
  rating?: string;
  isImdb: boolean;
  runtime?: string;
  genres: string[];
  availability: { local: boolean; providers: MediaServerProvider[] };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      {year && <Pill>{year}</Pill>}
      {availability.local && (
        <Pill>
          <span aria-label="In your local library">
            <LocalLibraryBrand className="h-[18px] w-[18px]" />
          </span>
        </Pill>
      )}
      {availability.providers.map((provider) => (
        <Pill key={provider}>
          <span aria-label={`Available in ${mediaServerProviderName(provider)}`}>
            <MediaServerBrand
              provider={provider}
              name={mediaServerProviderName(provider)}
              compact
            />
          </span>
        </Pill>
      ))}
      {rating && (
        <Pill>
          <span className="flex items-center gap-1.5">
            {isImdb ? (
              <ImdbIcon className="h-[14px] w-auto rounded-[3px]" />
            ) : (
              <Star size={12} strokeWidth={0} fill="currentColor" className="text-accent" />
            )}
            <span className="font-semibold text-ink">{rating}</span>
          </span>
        </Pill>
      )}
      {runtime && <Pill>{runtime}</Pill>}
      {genres.slice(0, 3).map((g) => (
        <Pill key={g}>{g}</Pill>
      ))}
    </div>
  );
}
