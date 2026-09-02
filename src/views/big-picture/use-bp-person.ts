import { useEffect, useMemo, useState } from "react";
import { mergeBundledPersonAwards } from "@/lib/awards-history";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";
import {
  creditToMeta,
  tmdbPerson,
  tmdbPersonCached,
  type PersonCredit,
  type PersonDetail,
} from "@/lib/providers/tmdb/tmdb-people";
import { awardSummary, useAwards, type AwardType } from "@/lib/providers/wikidata";
import { useRankings } from "@/lib/rankings";
import { useSettings } from "@/lib/settings";
import type { Collaborator } from "@/views/person/collaborator-rank";
import {
  applyMinRating,
  rankByRating,
  sortFilmography,
  TOP_PERFORMANCE_COUNT,
  TOP_PERFORMANCE_MIN,
  type FilmographySort,
} from "@/views/person/filmography-rank";
import { useCollaborators } from "@/views/person/use-collaborators";
import {
  dedupe,
  dedupeByMedia,
  DIRECTOR_JOBS,
  isCameoOrGuest,
  notableScore,
  PRODUCER_JOBS,
  WRITER_JOBS,
} from "@/views/person/person-utils";
import { seedBpMeta, unpinBpMeta } from "./bp-focus-meta";

export type BpFilmSectionId =
  | "movies"
  | "shows"
  | "directing"
  | "writing"
  | "producing"
  | "otherCrew";

export type BpFilmSection = { id: BpFilmSectionId; credits: PersonCredit[] };

export type BpPersonAward = { type: AwardType; wins: number; nominations: number };

export type BpPersonState = {
  person: PersonDetail | null;
  loading: boolean;
  hasKey: boolean;
  knownFor: PersonCredit[];
  topRated: PersonCredit[];
  collaborators: Collaborator[];
  awards: BpPersonAward[];
  deptRank: number | undefined;
  sections: BpFilmSection[];
  total: number;
  shownTotal: number;
  sort: FilmographySort;
  setSort: (next: FilmographySort) => void;
  minRating: number;
  setMinRating: (next: number) => void;
};

// The cap lives here, not in the row, so the section headings and the
// "{n} of {total}" readout report what is actually reachable on screen.
const SECTION_CAP = 48;
const KNOWN_FOR_COUNT = 12;
const OTHER_CREW_MIN = 4;
const OTHER_CREW_MAX = 24;

function byPopularity(a: PersonCredit, b: PersonCredit): number {
  return b.popularity - a.popularity;
}

export function useBpPerson(personId: number): BpPersonState {
  const { settings } = useSettings();
  const [person, setPerson] = useState<PersonDetail | null>(
    () => tmdbPersonCached(personId) ?? null,
  );
  const [loading, setLoading] = useState(!person);
  const [sort, setSort] = useState<FilmographySort>("popularity");
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    const cached = tmdbPersonCached(personId);
    if (cached) {
      setPerson(cached);
      setLoading(false);
      return;
    }
    let alive = true;
    setPerson(null);
    setLoading(true);
    tmdbPerson(settings.tmdbKey, personId)
      .then((p) => {
        if (alive) setPerson(p);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [personId, settings.tmdbKey]);

  const cast = useMemo(() => (person ? dedupe(person.cast).sort(byPopularity) : []), [person]);
  const crew = useMemo(() => (person ? person.crew.slice().sort(byPopularity) : []), [person]);

  const knownFor = useMemo(() => {
    if (!person) return [];
    const dept = person.knownForDepartment;
    const pool =
      dept === "Acting" || !dept
        ? cast.filter((c) => !isCameoOrGuest(c))
        : dedupeByMedia(crew.filter((c) => c.department === dept));
    return pool
      .slice()
      .sort((a, b) => notableScore(b) - notableScore(a))
      .slice(0, KNOWN_FOR_COUNT);
  }, [person, cast, crew]);

  const topRated = useMemo(() => {
    const ranked = rankByRating(
      cast.filter((c) => !isCameoOrGuest(c)),
      TOP_PERFORMANCE_COUNT,
    );
    return ranked.length >= TOP_PERFORMANCE_MIN ? ranked : [];
  }, [cast]);

  // The desktop hook, not a fork. Forking the ranking would let the two front
  // ends disagree about who a person's collaborators are, and the localStorage
  // cache is shared, so a person already opened on desktop costs the TV nothing.
  // It gates itself on requestIdleCallback, so the credit-rating burst this page
  // already fires drains before it asks for anything.
  const collaborators = useCollaborators(person);

  const liveAwards = useAwards(person?.imdbId ?? undefined);
  const awardsV = useBundledAwardsVersion();
  const awards = useMemo(
    () =>
      awardSummary(mergeBundledPersonAwards(liveAwards, person?.name)).filter(
        (a) => a.wins > 0 || a.nominations > 0,
      ),
    [awardsV, liveAwards, person?.name],
  );

  const { rank } = useRankings();
  const deptRank = person ? rank(person.id, person.knownForDepartment || "Acting") : undefined;

  // Arriving from a cast card leaves the previous title's art pinned behind the
  // page, so a person sat under a film they may have nothing to do with until a
  // credit card took focus. unpin then seed is the same handshake bp-movies and
  // bp-shows use; the seed loses to the first card that publishes, by design.
  const seed = useMemo(() => {
    const credit = knownFor.find((c) => c.background) ?? knownFor[0];
    return credit ? creditToMeta(credit) : null;
  }, [knownFor]);

  useEffect(() => {
    unpinBpMeta();
  }, [personId]);

  useEffect(() => {
    seedBpMeta(seed);
  }, [seed?.id]);

  const film = useMemo(() => {
    const crewIn = (jobs: Set<string>) => dedupe(crew.filter((c) => jobs.has(c.job ?? "")));
    const other = dedupe(
      crew.filter(
        (c) =>
          !DIRECTOR_JOBS.has(c.job ?? "") &&
          !WRITER_JOBS.has(c.job ?? "") &&
          !PRODUCER_JOBS.has(c.job ?? ""),
      ),
    );
    const raw: BpFilmSection[] = [
      { id: "movies", credits: cast.filter((c) => c.mediaType === "movie") },
      { id: "shows", credits: cast.filter((c) => c.mediaType === "tv") },
      { id: "directing", credits: crewIn(DIRECTOR_JOBS) },
      { id: "writing", credits: crewIn(WRITER_JOBS) },
      { id: "producing", credits: crewIn(PRODUCER_JOBS) },
      { id: "otherCrew", credits: other.length > OTHER_CREW_MIN ? other.slice(0, OTHER_CREW_MAX) : [] },
    ];
    const shaped = raw.map((s) => ({
      id: s.id,
      credits: sortFilmography(applyMinRating(s.credits, minRating), sort).slice(0, SECTION_CAP),
    }));
    const count = (list: BpFilmSection[]) => list.reduce((n, s) => n + s.credits.length, 0);
    return {
      sections: shaped.filter((s) => s.credits.length > 0),
      total: count(raw),
      shownTotal: count(shaped),
    };
  }, [cast, crew, sort, minRating]);

  return {
    person,
    loading,
    hasKey: Boolean(settings.tmdbKey),
    knownFor,
    topRated,
    collaborators,
    awards,
    deptRank,
    sections: film.sections,
    total: film.total,
    shownTotal: film.shownTotal,
    sort,
    setSort,
    minRating,
    setMinRating,
  };
}
