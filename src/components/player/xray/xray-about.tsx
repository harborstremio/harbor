import { useMemo, useState, type ReactNode } from "react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { useT } from "@/lib/i18n";

const YT_THUMB = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

type Video = { ytId: string; name: string };

function collectVideos(details: TmdbDetail | null, title: string): Video[] {
  const seen = new Set<string>();
  const out: Video[] = [];
  const push = (ytId: string | null | undefined, name: string) => {
    if (!ytId || seen.has(ytId)) return;
    seen.add(ytId);
    out.push({ ytId, name });
  };
  push(details?.trailerYtId, `${title} trailer`);
  for (const v of details?.extraVideos ?? []) push(v.ytId, v.name || v.type || title);
  return out;
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

export function XrayAbout({
  meta,
  details,
  onPlayVideo,
}: {
  meta: Meta;
  details: TmdbDetail | null;
  onPlayVideo?: (ytId: string, name: string) => void;
}) {
  const t = useT();
  const title = details?.title || meta.name;
  const logo = details?.logo || meta.logo;
  const tagline = details?.tagline;
  const overview = details?.overview || meta.description || "";
  const genres = (details?.genres?.length ? details.genres : meta.genres) ?? [];
  const year = details?.year || meta.releaseInfo;
  const runtime = details?.runtime || meta.runtime;
  const rating = details?.rating || meta.imdbRating;
  const votes = details?.voteCount ?? 0;
  const status = details?.status;
  const network = details?.networks?.[0] ?? details?.productionCompanies?.[0];
  const language = details?.spokenLanguages?.[0] ?? details?.originalLanguage;
  const country = details?.productionCountries?.[0];
  const helmers = details?.directors?.length
    ? { label: t("Director"), people: details.directors }
    : details?.creators?.length
      ? { label: t("Creator"), people: details.creators }
      : null;
  const writers = details?.writers ?? [];
  const hasFacts = !!(helmers || writers.length || network || language || country);

  const backdrops = useMemo(() => {
    const list = details?.gallery.backdrops ?? [];
    const base = details?.backdrop || meta.background;
    const merged = base ? [base, ...list.filter((b) => b !== base)] : list;
    return [...new Set(merged)];
  }, [details, meta.background]);
  const videos = useMemo(() => collectVideos(details, title), [details, title]);

  const [hero, setHero] = useState(backdrops[0]);
  const shown = hero ?? backdrops[0];
  const stripBackdrops = backdrops.slice(0, Math.max(0, 9 - videos.length));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
          {shown ? (
            <img
              key={shown}
              src={shown}
              alt=""
              className="aspect-[16/9] w-full object-cover animate-in fade-in duration-300 motion-reduce:animate-none"
            />
          ) : (
            <div className="aspect-[16/9] w-full bg-white/[0.04]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {logo && (
            <img
              src={logo}
              alt={title}
              className="absolute bottom-4 left-5 max-h-[52px] max-w-[52%] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
            />
          )}
        </div>
        {(videos.length > 0 || stripBackdrops.length > 1) && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {videos.map((v) => (
              <Thumb key={v.ytId} src={YT_THUMB(v.ytId)} label={v.name} play onClick={() => onPlayVideo?.(v.ytId, v.name)} />
            ))}
            {stripBackdrops.map((b) => (
              <Thumb key={b} src={b} active={b === shown} onClick={() => setHero(b)} />
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <h2 className="font-display text-[22px] font-bold leading-tight text-white">{title}</h2>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] font-medium text-white/65">
          {rating && (
            <span className="flex items-center gap-1.5">
              <ImdbIcon className="h-[17px] w-[34px] shrink-0" />
              <span className="text-[14px] font-bold text-white">{rating}</span>
              {votes > 0 && <span className="text-white/40">{fmtVotes(votes)}</span>}
            </span>
          )}
          {year && <MetaDot>{year}</MetaDot>}
          {runtime && <MetaDot>{runtime}</MetaDot>}
          {status && <MetaDot>{status}</MetaDot>}
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span key={g} className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11.5px] font-medium text-white/70">
                {g}
              </span>
            ))}
          </div>
        )}

        {tagline && <p className="text-[14px] italic leading-snug text-white/55">{tagline}</p>}

        {overview && (
          <p className="max-h-[10rem] overflow-y-auto pe-2 text-[14px] leading-relaxed text-white/80 [scrollbar-width:thin]">
            {overview}
          </p>
        )}

        {hasFacts && (
          <div className="mt-1 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/10 pt-4">
            {helmers && <FactPeople label={helmers.label} people={helmers.people} />}
            {writers.length > 0 && <FactPeople label={t("Writers")} people={writers} />}
            {network && <FactText label={t("Network")} value={network} />}
            {language && <FactText label={t("Language")} value={language} />}
            {country && <FactText label={t("Country")} value={country} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaDot({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 before:block before:h-[3px] before:w-[3px] before:rounded-full before:bg-white/30">
      {children}
    </span>
  );
}

function FactPeople({ label, people }: { label: string; people: Array<{ name: string }> }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 truncate text-[13px] text-white/85">
        {people.slice(0, 3).map((p) => p.name).join(", ")}
      </div>
    </div>
  );
}

function FactText({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 truncate text-[13px] text-white/85">{value}</div>
    </div>
  );
}

function Thumb({
  src,
  label,
  active,
  play,
  onClick,
}: {
  src: string;
  label?: string;
  active?: boolean;
  play?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={play ? `${t("Play")} ${label ?? ""}` : t("Show image")}
      className={`group relative aspect-video w-full overflow-hidden rounded-lg ring-1 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${
        active ? "ring-2 ring-accent" : "ring-white/12 hover:ring-white/35"
      }`}
    >
      <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
      {play && (
        <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/40">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-black shadow-lg">
            <Play size={12} strokeWidth={2.6} className="ms-0.5" fill="currentColor" />
          </span>
        </span>
      )}
      {play && label && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-start text-[9.5px] font-medium text-white/85">
          {label}
        </span>
      )}
    </button>
  );
}
