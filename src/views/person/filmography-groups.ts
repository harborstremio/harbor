import type { PersonCredit } from "@/lib/providers/tmdb";
import { applyMinRating, sortFilmography, type FilmographySort } from "./filmography-rank";
import {
  CINEMATOGRAPHY_JOBS,
  COSTUME_JOBS,
  DIRECTOR_JOBS,
  dedupe,
  EDITING_JOBS,
  isCameoOrGuest,
  PRODUCER_JOBS,
  PRODUCTION_DESIGN_JOBS,
  WRITER_JOBS,
} from "./person-utils";

export type FilmographyGroup =
  | "movies"
  | "shows"
  | "directing"
  | "writing"
  | "producing"
  | "cinematography"
  | "editing"
  | "productionDesign"
  | "costume"
  | "otherCrew";

export type Filmography = Record<FilmographyGroup, PersonCredit[]> & {
  total: number;
  shownTotal: number;
};

const CREDITED_JOBS: Set<string>[] = [
  DIRECTOR_JOBS,
  WRITER_JOBS,
  PRODUCER_JOBS,
  CINEMATOGRAPHY_JOBS,
  EDITING_JOBS,
  PRODUCTION_DESIGN_JOBS,
  COSTUME_JOBS,
];

const OTHER_CREW_MIN = 4;
const OTHER_CREW_MAX = 24;

const CRAFT_BY_DEPARTMENT: Record<string, Set<string>> = {
  Directing: DIRECTOR_JOBS,
  Writing: WRITER_JOBS,
  Production: PRODUCER_JOBS,
  Camera: CINEMATOGRAPHY_JOBS,
  Editing: EDITING_JOBS,
  Art: PRODUCTION_DESIGN_JOBS,
  "Costume & Make-Up": COSTUME_JOBS,
};

const ACTING_DEPARTMENTS = new Set(["", "Acting", "Actors"]);

export function signatureFilms(
  department: string | undefined,
  cast: PersonCredit[],
  crew: PersonCredit[],
): PersonCredit[] {
  if (ACTING_DEPARTMENTS.has(department ?? "")) {
    return cast.filter((c) => c.mediaType === "movie" && !isCameoOrGuest(c));
  }
  const jobs = CRAFT_BY_DEPARTMENT[department ?? ""];
  if (!jobs) return [];
  return dedupe(crew.filter((c) => c.mediaType === "movie" && jobs.has(c.job ?? "")));
}

export function buildFilmography(
  cast: PersonCredit[],
  crew: PersonCredit[],
  sort: FilmographySort,
  minRating: number,
): Filmography {
  const crewIn = (jobs: Set<string>) => dedupe(crew.filter((c) => jobs.has(c.job ?? "")));
  const otherAll = dedupe(crew.filter((c) => !CREDITED_JOBS.some((jobs) => jobs.has(c.job ?? ""))));
  const raw: Record<FilmographyGroup, PersonCredit[]> = {
    movies: cast.filter((c) => c.mediaType === "movie"),
    shows: cast.filter((c) => c.mediaType === "tv"),
    directing: crewIn(DIRECTOR_JOBS),
    writing: crewIn(WRITER_JOBS),
    producing: crewIn(PRODUCER_JOBS),
    cinematography: crewIn(CINEMATOGRAPHY_JOBS),
    editing: crewIn(EDITING_JOBS),
    productionDesign: crewIn(PRODUCTION_DESIGN_JOBS),
    costume: crewIn(COSTUME_JOBS),
    otherCrew: otherAll.length > OTHER_CREW_MIN ? otherAll.slice(0, OTHER_CREW_MAX) : [],
  };
  const shape = (list: PersonCredit[]) => sortFilmography(applyMinRating(list, minRating), sort);
  const shown = Object.fromEntries(Object.entries(raw).map(([g, l]) => [g, shape(l)])) as Record<
    FilmographyGroup,
    PersonCredit[]
  >;
  const count = (lists: PersonCredit[][]) => lists.reduce((n, l) => n + l.length, 0);
  return {
    ...shown,
    total: count(Object.values(raw)),
    shownTotal: count(Object.values(shown)),
  };
}
