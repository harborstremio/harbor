import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { fetchCalendar, loadColleges } from "@/lib/jl/sports/college-data";
import { useFollowedColleges } from "@/lib/jl/sports/college-follows";
import {
  DIVISIONS,
  conferencesFor,
  divisionLabel,
  filterColleges,
  type College,
  type CollegeDivision,
} from "@/lib/jl/sports/colleges";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { isLiveNow, type SchoolEvent } from "@/lib/jl/sports/sidearm";
import { useView } from "@/lib/view";
import {
  Chip,
  CollegeCard,
  GameCard,
  Note,
  PageShell,
  SectionTitle,
  Shelf,
  Spinner,
  useLoad,
} from "./college-ui";

const PAGE = 60;
const WEEK_MS = 7 * 86_400_000;
const MAX_FOLLOWED_CALENDARS = 12;
const NONE: College[] = [];

/** College Sports: every NCAA school by division and conference, your schools and their week. */
export function CollegesPage({ page: _page }: { page: Extract<SportsPage, { kind: "colleges" }> }) {
  const t = useT();
  const { openSportsPage } = useView();
  const directory = useLoad(loadColleges, []);
  const followed = useFollowedColleges();
  const [q, setQ] = useState("");
  const [division, setDivision] = useState<CollegeDivision | null>(null);
  const [subdivision, setSubdivision] = useState<"FBS" | "FCS" | null>(null);
  const [conference, setConference] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const all = directory.state === "ready" ? directory.value : NONE;
  const conferences = useMemo(() => conferencesFor(all, division), [all, division]);
  const matches = useMemo(
    () => filterColleges(all, { q, division, subdivision, conference }),
    [all, q, division, subdivision, conference],
  );

  const open = (c: College) => openSportsPage({ kind: "college", collegeId: c.id, name: c.name });
  const pickDivision = (d: CollegeDivision | null) => {
    setDivision(d);
    setSubdivision(null);
    setConference(null);
    setShown(PAGE);
  };

  return (
    <PageShell>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold leading-tight text-ink">{t("College Sports")}</h1>
        <p className="max-w-3xl text-[14px] text-ink-muted">
          {t(
            "Every NCAA school: schedules, results, rosters and where to watch, from each school's own athletics site.",
          )}
        </p>
      </header>

      {followed.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("Your schools")}</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {followed.map((c) => (
              <CollegeCard key={c.id} college={c} onOpen={() => open(c)} />
            ))}
          </div>
        </section>
      )}
      {followed.length > 0 && <FollowedWeek followed={followed} onOpen={open} />}

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("Find a school")}</SectionTitle>
        <label className="flex max-w-xl items-center gap-2.5 rounded-xl border border-edge bg-canvas px-3.5 focus-within:border-ink-subtle">
          <Search size={15} className="text-ink-subtle" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder={t("School name")}
            spellCheck={false}
            autoComplete="off"
            className="h-11 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle/60"
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip label={t("All divisions")} active={!division} onClick={() => pickDivision(null)} />
          {DIVISIONS.map((d) => (
            <Chip
              key={d}
              label={t(divisionLabel(d))}
              active={division === d}
              onClick={() => pickDivision(d)}
            />
          ))}
        </div>
        {division === "I" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip
              label={t("All football levels")}
              active={!subdivision}
              onClick={() => setSubdivision(null)}
            />
            {(["FBS", "FCS"] as const).map((s) => (
              <Chip
                key={s}
                label={t("Football · {level}", { level: s })}
                active={subdivision === s}
                onClick={() => setSubdivision(s)}
              />
            ))}
          </div>
        )}
        {conferences.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip
              label={t("All conferences")}
              active={!conference}
              onClick={() => setConference(null)}
            />
            {conferences.map((c) => (
              <Chip
                key={c.name}
                label={`${c.name} · ${c.schools}`}
                active={conference === c.name}
                onClick={() => {
                  setConference(c.name);
                  setShown(PAGE);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {directory.state === "loading" && <Spinner />}
      {directory.state === "failed" && (
        <Note>
          {t("The school list couldn't be loaded right now. Check your connection and try again.")}
        </Note>
      )}
      {directory.state === "ready" && (
        <section className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-subtle">
            {t("{n} schools", { n: matches.length.toLocaleString() })}
          </p>
          {matches.length === 0 ? (
            <Note>{t("No schools match. Try another name or filter.")}</Note>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {matches.slice(0, shown).map((c) => (
                <CollegeCard key={c.id} college={c} onOpen={() => open(c)} />
              ))}
            </div>
          )}
          {matches.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE * 2)}
              className="self-center rounded-full border border-edge-soft px-5 py-2 text-[13px] font-medium text-ink-muted hover:border-edge hover:text-ink"
            >
              {t("Show more schools")}
            </button>
          )}
        </section>
      )}
    </PageShell>
  );
}

/** The coming week for followed schools, live games first, from each school's own calendar. */
function FollowedWeek({ followed, onOpen }: { followed: College[]; onOpen: (c: College) => void }) {
  const t = useT();
  const sites = followed.filter((c) => c.site).slice(0, MAX_FOLLOWED_CALENDARS);
  const key = sites.map((c) => c.id).join(",");
  const week = useLoad(async () => {
    const now = Date.now();
    const lists = await Promise.all(
      sites.map(async (college) => {
        const cal = await fetchCalendar(college.site ?? "").catch(() => null);
        return (cal?.events ?? [])
          .filter((e) => {
            const start = Date.parse(e.start);
            return !e.result && start > now - 4 * 3_600_000 && start < now + WEEK_MS;
          })
          .map((event) => ({ event, college }));
      }),
    );
    return { now, games: lists.flat() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (week.state !== "ready" || week.value.games.length === 0) return null;
  const { now, games } = week.value;
  const sorted = [...games]
    .sort(
      (a, b) =>
        Number(isLiveNow(b.event, now)) - Number(isLiveNow(a.event, now)) ||
        a.event.start.localeCompare(b.event.start),
    )
    .slice(0, 30);
  return (
    <Shelf title={t("Your schools this week")} aside={t("Streams from the schools' own sites")}>
      {sorted.map(({ event, college }: { event: SchoolEvent; college: College }) => (
        <GameCard
          key={`${college.id}:${event.id}`}
          event={event}
          college={college}
          onOpenCollege={() => onOpen(college)}
          now={now}
        />
      ))}
    </Shelf>
  );
}
