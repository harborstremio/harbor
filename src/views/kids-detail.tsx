import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbDetails, type TmdbDetail } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { CollectionRow } from "./detail/collection-row";
import { dropAdultContent, dropUnreleased, dropUnsafeGenres } from "./kids/kids-filter";
import { KidsEpisodes } from "./kids-detail/kids-episodes";

export function KidsDetailView({
  meta,
  episodeHint,
}: {
  meta: Meta;
  episodeHint?: { season: number; episode: number };
}) {
  const t = useT();
  const { settings } = useSettings();
  const { openPicker } = useView();
  const [base, setBase] = useState<Meta | null>(null);
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setBase(null);
    setDetail(null);
    scrollRef.current?.scrollTo({ top: 0 });
    fetchMeta(narrowMediaType(meta.type), meta.id)
      .then((full) => !cancelled && full && setBase(full))
      .catch(() => {});
    if (settings.tmdbKey) {
      tmdbDetails(settings.tmdbKey, meta)
        .then((d) => !cancelled && d && setDetail(d))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, settings.tmdbKey]);

  const backdrop = detail?.backdrop || base?.background || meta.background || meta.poster;
  const logo = detail?.logo || base?.logo || meta.logo;
  const overview =
    detail?.overview || base?.description || (meta.id.startsWith("tmdb:") ? "" : meta.description) || "";
  const genres = (detail?.genres?.length ? detail.genres : base?.genres) ?? [];
  const runtime = detail?.runtime;
  const year = meta.releaseInfo || base?.releaseInfo;
  const recs = dropAdultContent(
    dropUnsafeGenres(
      dropUnreleased(
        dedupe([...(detail?.recommendations ?? []), ...(detail?.similar ?? [])], meta.id),
      ),
    ),
  );

  const onPlay = () => {
    const isSeries = meta.type === "series";
    const hint = episodeHint ?? (isSeries ? { season: 1, episode: 1 } : undefined);
    openPicker(meta, hint, { autoPlay: true, resume: true });
  };

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto bg-canvas">
      <section className="relative h-[66vh] min-h-[460px] w-full overflow-hidden">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/35 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-5 px-12 pb-9">
          {logo ? (
            <img
              src={logo}
              alt={meta.name}
              draggable={false}
              className="max-h-32 w-auto max-w-[60%] object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <h1 className="font-display text-[clamp(34px,5vw,60px)] font-semibold leading-none tracking-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.55)]">
              {meta.name}
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {year && <Chip>{year}</Chip>}
            {runtime && <Chip>{runtime}</Chip>}
            {genres.slice(0, 2).map((g) => (
              <Chip key={g}>{t(g)}</Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={onPlay}
            className="group inline-flex h-16 items-center gap-3 rounded-full bg-[#1f8f88] ps-6 pe-9 text-white shadow-[0_18px_40px_-14px_rgba(20,90,90,0.7)] transition-transform duration-200 hover:scale-[1.05] active:scale-[0.97]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/25 transition-transform duration-200 group-hover:rotate-6">
              <Play size={26} strokeWidth={0} fill="currentColor" className="ms-0.5" />
            </span>
            <span className="font-display text-[22px] font-extrabold tracking-tight">{t("Play")}</span>
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-10 px-12 pb-32 pt-3">
        {overview && (
          <p className="max-w-3xl text-[17px] font-medium leading-relaxed text-ink">{overview}</p>
        )}
        {meta.type === "series" && detail && detail.seasons.length > 0 && (
          <KidsEpisodes meta={meta} tvId={detail.id} seasons={detail.seasons} />
        )}
        {detail?.collection && (
          <CollectionRow collection={detail.collection} currentId={meta.id} />
        )}
        {recs.length > 0 && (
          <Row
            title={
              <span className="font-display text-[#0e3a43]">{t("More to explore")}</span>
            }
            titleClassName="text-[#0e3a43]"
            titleScale={1.28}
            min={148}
            shape="portrait"
            scrollKey={`kids-detail:${meta.id}`}
          >
            {recs.map((m) => (
              <PickCard key={m.id} meta={m} kids />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/75 px-3.5 py-1.5 text-[13.5px] font-bold text-[#0e3a43] ring-1 ring-white/60 backdrop-blur-sm">
      {children}
    </span>
  );
}

function dedupe(list: Meta[], excludeId: string): Meta[] {
  const seen = new Set<string>([excludeId]);
  const out: Meta[] = [];
  for (const m of list) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out.slice(0, 24);
}
