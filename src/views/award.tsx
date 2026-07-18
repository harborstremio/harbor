import { LayoutGrid, List } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { laurelColorFor } from "@/components/icons/award-logo";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import {
  awardFilmTotal,
  EMPTY_PEOPLE,
  loadAwardFilms,
  loadAwardPeople,
  type AwardPeople,
} from "@/lib/awards/award-page";
import type { Meta } from "@/lib/cinemeta";
import type { AwardType } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { AwardHero } from "./award/award-hero";
import { AwardList } from "./award/award-list";
import { FilmGrid } from "./award/film-grid";
import { PeopleRail } from "./award/people-rail";

const PREVIEW = 18;
const PAGE = 24;
const MODE_KEY = "harbor.award.viewmode";
type AwardMode = "gallery" | "list";

function readMode(): AwardMode {
  try {
    return localStorage.getItem(MODE_KEY) === "list" ? "list" : "gallery";
  } catch {
    return "gallery";
  }
}

export function AwardView({ awardType }: { awardType: AwardType }) {
  const t = useT();
  const meta = AWARD_CATALOG[awardType];
  const { settings } = useSettings();
  const scrollRef = useRef<HTMLElement>(null);

  const [mode, setMode] = useState<AwardMode>(readMode);
  const [films, setFilms] = useState<Meta[]>([]);
  const [filmsDone, setFilmsDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [people, setPeople] = useState<AwardPeople>(EMPTY_PEOPLE);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const targetRef = useRef(PREVIEW);

  useScrollMemory(`award:${awardType}`, scrollRef);

  const selectMode = useCallback((m: AwardMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFilms([]);
    setFilmsDone(false);
    setExpanded(false);
    setLoadingFilms(true);
    setLoadingMore(false);
    setPeople(EMPTY_PEOPLE);
    setLoadingPeople(true);
    targetRef.current = PREVIEW;
    loadAwardFilms(settings.tmdbKey, awardType, PREVIEW)
      .then(({ films, done }) => {
        if (cancelled) return;
        setFilms(films);
        setFilmsDone(done);
        setLoadingFilms(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingFilms(false);
      });
    loadAwardPeople(settings.tmdbKey, awardType)
      .then((p) => {
        if (cancelled) return;
        setPeople(p);
        setLoadingPeople(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingPeople(false);
      });
    return () => {
      cancelled = true;
    };
  }, [awardType, settings.tmdbKey]);

  const loadMore = useCallback(() => {
    if (loadingMore || loadingFilms || filmsDone || !settings.tmdbKey) return;
    setLoadingMore(true);
    targetRef.current += PAGE;
    loadAwardFilms(settings.tmdbKey, awardType, targetRef.current)
      .then(({ films, done }) => {
        setFilms(films);
        setFilmsDone(done);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [awardType, settings.tmdbKey, loadingMore, loadingFilms, filmsDone]);

  const onViewAll = useCallback(() => {
    setExpanded(true);
    loadMore();
  }, [loadMore]);

  const tint = laurelColorFor(awardType) ?? "#E8AA6C";
  const hasKey = !!settings.tmdbKey;
  const isEmpty =
    !loadingFilms &&
    !loadingPeople &&
    films.length === 0 &&
    people.actors.length === 0 &&
    people.directors.length === 0 &&
    people.writers.length === 0;

  return (
    <main ref={scrollRef} className="relative h-full overflow-y-auto bg-canvas">
      <AwardHero type={awardType} tint={tint} films={films} />

      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-12 px-12 pb-32 pt-14">
        <section className="flex max-w-3xl flex-col gap-3">
          <p className="text-[16.5px] leading-[1.65] text-ink-muted">{meta.description}</p>
          {meta.tagline && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {meta.tagline}
            </p>
          )}
        </section>

        <ModeToggle mode={mode} onSelect={selectMode} tint={tint} />

        {mode === "list" ? (
          <AwardList awardType={awardType} tint={tint} />
        ) : !hasKey ? (
          <p className="rounded-2xl border border-edge-soft bg-elevated/30 p-6 text-[14px] leading-relaxed text-ink-muted">
            {t("Add a TMDB key in Settings to unlock posters and the artists behind this award.")}
          </p>
        ) : (
          <div className="flex flex-col gap-16">
            <FilmGrid
              films={films}
              total={awardFilmTotal(awardType)}
              loading={loadingFilms}
              loadingMore={loadingMore}
              expanded={expanded}
              done={filmsDone}
              onViewAll={onViewAll}
              onLoadMore={loadMore}
              scrollRoot={scrollRef}
              tint={tint}
            />
            <PeopleRail
              title={t("Celebrated actors")}
              people={people.actors}
              loading={loadingPeople}
              tint={tint}
            />
            <PeopleRail
              title={t("Acclaimed directors")}
              people={people.directors}
              loading={loadingPeople}
              tint={tint}
            />
            <PeopleRail
              title={t("Honored writers")}
              people={people.writers}
              loading={loadingPeople}
              tint={tint}
            />
            {isEmpty && (
              <p className="rounded-2xl border border-edge-soft bg-elevated/30 p-6 text-[14px] leading-relaxed text-ink-muted">
                {t("No winners are catalogued for this award yet.")}
              </p>
            )}
          </div>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function ModeToggle({
  mode,
  onSelect,
  tint,
}: {
  mode: AwardMode;
  onSelect: (m: AwardMode) => void;
  tint: string;
}) {
  const t = useT();
  return (
    <div className="flex w-fit items-center gap-1 self-start rounded-full border border-edge-soft bg-elevated/40 p-1">
      <button
        type="button"
        onClick={() => onSelect("gallery")}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
          mode === "gallery" ? "text-canvas" : "text-ink-muted hover:text-ink"
        }`}
        style={mode === "gallery" ? { backgroundColor: tint } : undefined}
      >
        <LayoutGrid size={15} strokeWidth={2.2} />
        {t("Gallery")}
      </button>
      <button
        type="button"
        onClick={() => onSelect("list")}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
          mode === "list" ? "text-canvas" : "text-ink-muted hover:text-ink"
        }`}
        style={mode === "list" ? { backgroundColor: tint } : undefined}
      >
        <List size={15} strokeWidth={2.2} />
        {t("Full list")}
      </button>
    </div>
  );
}
