import { AwardDetailModal } from "@/components/award-detail-modal";
import { BackToTop } from "@/components/back-to-top";
import { Poster } from "@/components/poster";
import { mergeBundledPersonAwards } from "@/lib/awards-history";
import { useT } from "@/lib/i18n";
import { creditToMeta, tmdbPerson, tmdbPersonCached, type PersonDetail } from "@/lib/providers/tmdb";
import { awardSummary, type AwardType, useAwards } from "@/lib/providers/wikidata";
import { useRankings } from "@/lib/rankings";
import { useSettings } from "@/lib/settings";
import { useTopRankModal, type TopRankDept } from "@/lib/top-rank-modal";
import { useScrollMemory, useView } from "@/lib/view";
import { useEffect, useMemo, useRef, useState } from "react";

import { AwardLaurelStrip } from "./person/award-laurel-strip";
import { Bio } from "./person/bio";
import { FilmRow } from "./person/film-row";
import { BirthdayLink, PlaceLink } from "./person/person-meta-links";
import {
  calcAge,
  dedupe,
  dedupeByMedia,
  DIRECTOR_JOBS,
  fmtDate,
  isCameoOrGuest,
  notableScore,
  PRODUCER_JOBS,
  WRITER_JOBS,
} from "./person/person-utils";

export function PersonView({ personId }: { personId: number }) {
  const t = useT();
  const { settings } = useSettings();
  const { rank } = useRankings();
  const { openMeta } = useView();
  const { open: openTopRank } = useTopRankModal();
  const initialCached = tmdbPersonCached(personId);
  const [person, setPerson] = useState<PersonDetail | null>(initialCached ?? null);
  const [loading, setLoading] = useState(!initialCached);
  const scrollRef = useRef<HTMLElement>(null);
  const personRank = rank(personId, person?.knownForDepartment ?? "Acting");
  const liveAwards = useAwards(person?.imdbId ?? undefined);
  const awardEntries = useMemo(() => mergeBundledPersonAwards(liveAwards, person?.name), [liveAwards, person?.name]);
  const awardChips = useMemo(() => awardSummary(awardEntries), [awardEntries]);
  const [openAward, setOpenAward] = useState<{ type: AwardType; anchor: DOMRect } | null>(null);
  const openAwardEntries = useMemo(
    () => (openAward && awardEntries ? awardEntries.filter((e) => e.type === openAward.type) : []),
    [openAward, awardEntries],
  );
  useScrollMemory(`person:${personId}`, scrollRef);

  useEffect(() => {
    let cancelled = false;
    const cached = tmdbPersonCached(personId);
    if (cached) {
      setPerson(cached);
      setLoading(false);
      return;
    }
    setPerson(null);
    setLoading(true);
    tmdbPerson(settings.tmdbKey, personId).then((p) => {
      if (cancelled) return;
      setPerson(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId, settings.tmdbKey]);

  const sortedCast = useMemo(
    () => (person ? dedupe(person.cast).sort((a, b) => b.popularity - a.popularity) : []),
    [person],
  );
  const sortedCrew = useMemo(
    () => (person ? person.crew.slice().sort((a, b) => b.popularity - a.popularity) : []),
    [person],
  );

  const knownFor = useMemo(() => {
    if (!person) return [];
    const dept = person.knownForDepartment;
    const pool =
      dept === "Acting" || !dept
        ? sortedCast.filter((c) => !isCameoOrGuest(c))
        : dedupeByMedia(sortedCrew.filter((c) => c.department === dept));
    return pool
      .slice()
      .sort((a, b) => notableScore(b) - notableScore(a))
      .slice(0, 12);
  }, [sortedCast, sortedCrew, person]);
  const movies = sortedCast.filter((c) => c.mediaType === "movie");
  const shows = sortedCast.filter((c) => c.mediaType === "tv");
  const directing = dedupe(sortedCrew.filter((c) => DIRECTOR_JOBS.has(c.job ?? "")));
  const writing = dedupe(sortedCrew.filter((c) => WRITER_JOBS.has(c.job ?? "")));
  const producing = dedupe(sortedCrew.filter((c) => PRODUCER_JOBS.has(c.job ?? "")));
  const otherCrew = dedupe(
    sortedCrew.filter(
      (c) => !DIRECTOR_JOBS.has(c.job ?? "") && !WRITER_JOBS.has(c.job ?? "") && !PRODUCER_JOBS.has(c.job ?? ""),
    ),
  );

  const photo = person?.profilePath ? `https://image.tmdb.org/t/p/h632${person.profilePath}` : undefined;
  const backdrop = knownFor.find((c) => c.background)?.background;

  const age = person?.birthday ? calcAge(person.birthday, person.deathday) : null;

  return (
    <main ref={scrollRef} className="absolute inset-0 z-40 overflow-y-auto bg-canvas">
      <div className="relative isolate">
        {backdrop && (
          <div
            aria-hidden
            className="harbor-bleed-stremio pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] overflow-hidden"
          >
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${backdrop})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(80px) saturate(1.3)",
                opacity: 0.45,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/70 to-canvas" />
          </div>
        )}

        <div className="relative flex flex-col gap-12 px-12 pb-12 pt-28 lg:flex-row lg:items-center lg:gap-14">
          <div className="w-64 shrink-0 lg:w-72">
            <div className="overflow-hidden rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
              <Poster src={photo} seed={String(personId)} ratio="portrait" />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5 pb-2">
            <div className="flex items-center gap-3">
              {person?.knownForDepartment && (
                <span className="text-[12.5px] font-medium uppercase tracking-[0.22em] text-ink-subtle">
                  {t(person.knownForDepartment)}
                </span>
              )}
              {personRank && (
                <button
                  type="button"
                  onClick={() => openTopRank((person?.knownForDepartment as TopRankDept) ?? "Acting")}
                  className="flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-accent transition-all hover:scale-105 hover:border-accent/60 hover:bg-accent/20"
                  title={t("Open Top 100 {dept}", { dept: t(person?.knownForDepartment ?? "Actors") })}
                >
                  {t("Top {n}", { n: personRank })}
                </button>
              )}
            </div>
            <h1 className="font-display text-[88px] font-medium leading-[0.95] tracking-tight text-ink">
              {person?.name ?? (loading ? "" : t("Unknown"))}
            </h1>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-muted">
              {person?.birthday && <BirthdayLink birthday={person.birthday} age={age} />}
              {person?.deathday && <span>{t("Died {date}", { date: fmtDate(person.deathday) })}</span>}
              {person?.placeOfBirth && <PlaceLink place={person.placeOfBirth} />}
            </div>

            {awardChips.length > 0 && (
              <AwardLaurelStrip chips={awardChips} onOpen={(type, rect) => setOpenAward({ type, anchor: rect })} />
            )}

            {person?.biography && (
              <Bio
                text={person.biography}
                credits={person ? [...person.cast, ...person.crew] : []}
                onOpenCredit={(c) => openMeta(creditToMeta(c))}
              />
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-14 px-12 pb-24 pt-6">
        {loading && <div className="h-[260px] animate-pulse rounded-2xl border border-edge-soft bg-elevated/30" />}

        {knownFor.length > 0 && <FilmRow title={t("Known For")} credits={knownFor} showRole={false} />}
        {movies.length > 0 && <FilmRow title={t("Movies · {n}", { n: movies.length })} credits={movies} showRole />}
        {shows.length > 0 && <FilmRow title={t("TV Shows · {n}", { n: shows.length })} credits={shows} showRole />}
        {directing.length > 0 && <FilmRow title={t("Directing")} credits={directing} showRole />}
        {writing.length > 0 && <FilmRow title={t("Writing")} credits={writing} showRole />}
        {producing.length > 0 && <FilmRow title={t("Producing")} credits={producing} showRole />}
        {otherCrew.length > 0 && otherCrew.length > 4 && (
          <FilmRow title={t("Other Work")} credits={otherCrew.slice(0, 24)} showRole />
        )}

        {!loading && person && sortedCast.length === 0 && sortedCrew.length === 0 && (
          <div className="rounded-2xl border border-dashed border-edge px-6 py-12 text-center text-[14px] text-ink-muted">
            {t("No filmography on record.")}
          </div>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
      {openAward && (
        <AwardDetailModal
          type={openAward.type}
          entries={openAwardEntries}
          anchor={openAward.anchor}
          onClose={() => setOpenAward(null)}
        />
      )}
    </main>
  );
}
