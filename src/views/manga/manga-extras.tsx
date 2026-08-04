import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { t, useT } from "@/lib/i18n";
import { RailChevron } from "@/components/nav-arrow";
import { mangaAdaptation, similarManga, type MangaAdaptation } from "@/lib/manga/related";
import type { MangaChapter } from "@/lib/manga/api";
import type { MangaUpdatesInfo } from "@/lib/manga/mangaupdates";
import type { MangaSummary } from "@/lib/manga/model";
import { Poster } from "@/components/poster";
import { useView } from "@/lib/view";
import { AnimeCoverage, coverageOf } from "./anime-coverage";

function formatLabel(format?: string): string {
  if (!format) return t("Anime");
  const map: Record<string, string> = {
    TV: t("TV Series"),
    TV_SHORT: t("TV Short"),
    MOVIE: t("Movie"),
    OVA: t("OVA"),
    ONA: t("ONA"),
    SPECIAL: t("Special"),
    MUSIC: t("Music"),
  };
  return map[format] ?? format.replace(/_/g, " ");
}

export function MangaAdaptationCard({
  title,
  info,
  chapters,
  onReadChapter,
  heroBg,
}: {
  title: string;
  info?: MangaUpdatesInfo | null;
  chapters?: MangaChapter[];
  onReadChapter?: (index: number) => void;
  heroBg?: string | null;
}) {
  const { openMeta } = useView();
  const t = useT();
  const [adaptation, setAdaptation] = useState<MangaAdaptation | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAdaptation(null);
    void mangaAdaptation(title).then((a) => {
      if (!cancelled) setAdaptation(a);
    });
    return () => {
      cancelled = true;
    };
  }, [title]);

  const coverage = info && chapters ? coverageOf(info, chapters) : null;
  if (!adaptation && !coverage) return null;

  const bg =
    adaptation?.banner && adaptation.banner !== heroBg
      ? adaptation.banner
      : (adaptation?.cover ?? adaptation?.banner);
  const open = () => {
    if (!adaptation) return;
    openMeta({
      id: "anilist:" + adaptation.anilistId,
      type: adaptation.format === "MOVIE" ? "movie" : "series",
      name: adaptation.title,
      poster: adaptation.cover,
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{t("Anime Adaptation")}</h2>
      {adaptation ? (
        <div className="group relative overflow-hidden rounded-2xl ring-1 ring-edge-soft/60 transition-shadow duration-300 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] hover:ring-edge">
          {bg && (
            <img
              src={bg}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-canvas/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/85 to-transparent" />
          <div className="relative flex min-h-[190px] flex-col justify-end gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:min-w-0 sm:flex-1">
              <div className="flex flex-col gap-2">
                <span className="w-fit rounded-full bg-elevated/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted ring-1 ring-edge-soft/60 backdrop-blur-sm">
                  {formatLabel(adaptation.format)}
                </span>
                <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">
                  {adaptation.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={open}
                className="flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-canvas shadow-lg transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] motion-reduce:transition-none"
              >
                <Play size={16} strokeWidth={2.6} className="fill-canvas" />
                {t("Watch the anime")}
              </button>
            </div>
            {coverage && onReadChapter && (
              <AnimeCoverage
                coverage={coverage}
                onReadChapter={onReadChapter}
                className="sm:max-w-[48%] sm:shrink-0"
              />
            )}
          </div>
        </div>
      ) : (
        coverage &&
        onReadChapter && <AnimeCoverage coverage={coverage} onReadChapter={onReadChapter} />
      )}
    </section>
  );
}

export function MangaRecommendedRail({
  title,
  onOpen,
}: {
  title: string;
  onOpen: (mangaId: string) => void;
}) {
  const t = useT();
  const [items, setItems] = useState<MangaSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    void similarManga(title).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [title]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const nudge = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 420, behavior: "smooth" });

  if (items && items.length === 0) return null;

  return (
    <section className="group/rail relative flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{t("Recommended")}</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "x proximity" }}
        >
          {items === null
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-36 shrink-0 animate-pulse">
                  <div className="aspect-[2/3] w-full rounded-xl bg-elevated" />
                  <div className="mt-2 h-3.5 w-4/5 rounded bg-elevated" />
                </div>
              ))
            : items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpen(m.id)}
                  style={{ scrollSnapAlign: "start" }}
                  className="group flex w-36 shrink-0 flex-col gap-2 text-start"
                >
                  <div className="w-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5">
                    <Poster
                      src={m.cover}
                      seed={m.id}
                      ratio="portrait"
                      className="harbor-card-ring rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]"
                    />
                  </div>
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                    {m.title}
                  </p>
                </button>
              ))}
        </div>
        {items && items.length > 5 && (
          <>
            <RailChevron side="left" visible onClick={() => nudge(-1)} outset={44} nudgeY={-12} />
            <RailChevron side="right" visible onClick={() => nudge(1)} outset={44} nudgeY={-12} />
          </>
        )}
      </div>
    </section>
  );
}
