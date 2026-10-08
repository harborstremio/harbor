import { ExternalLink, PlayCircle, Star } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import {
  fetchCalendar,
  fetchNews,
  fetchRoster,
  fetchSchoolSports,
  findCollege,
} from "@/lib/jl/sports/college-data";
import { toggleFollowCollege, useFollowedColleges } from "@/lib/jl/sports/college-follows";
import type { SportsPage } from "@/lib/jl/sports/pages";
import {
  calendarSports,
  eventsForSport,
  matchupText,
  newsForSport,
  seasonRecord,
  slugForSport,
  sportKey,
  splitSeason,
} from "@/lib/jl/sports/sidearm";
import { useView } from "@/lib/view";
import { useNowTick } from "@/views/live/hooks/use-epg";
import { openInAppBrowser } from "@/lib/window";
import {
  Chip,
  GameCard,
  NewsCard,
  Note,
  PageShell,
  RosterCard,
  SchoolMark,
  Shelf,
  Spinner,
  collegeLine,
  fmtWhen,
  useLoad,
  useWatchStream,
} from "./college-ui";

const SHELF_MAX = 30;

/** A school: its sports, upcoming games with the school's own streams, results, roster and news. */
export function CollegePage({ page }: { page: Extract<SportsPage, { kind: "college" }> }) {
  const t = useT();
  const { openSportsPage } = useView();
  const watch = useWatchStream();
  const now = useNowTick(60_000);
  const followed = useFollowedColleges();
  const [sport, setSport] = useState<string | null>(null);

  const found = useLoad(() => findCollege(page.collegeId), [page.collegeId]);
  const college = found.state === "ready" ? found.value : null;
  const site = college?.site ?? null;
  const calendar = useLoad(async () => (site ? fetchCalendar(site) : null), [site]);
  const siteSports = useLoad(async () => (site ? fetchSchoolSports(site) : []), [site]);
  const news = useLoad(async () => (site ? fetchNews(site) : []), [site]);

  const events = calendar.state === "ready" ? (calendar.value?.events ?? []) : [];
  const listed = siteSports.state === "ready" ? siteSports.value : [];
  // Calendar sports first (they have games), then sports only the site's menu lists.
  const sports = calendarSports(events);
  const known = new Set(sports.map(sportKey));
  for (const s of listed) if (!known.has(sportKey(s.name))) sports.push(s.name);
  sports.sort((a, b) => a.localeCompare(b));

  const slug = sport ? slugForSport(sport, listed) : null;
  const roster = useLoad(async () => (site && slug ? fetchRoster(site, slug) : null), [site, slug]);

  const list = sport ? eventsForSport(events, sport) : events;
  const { upcoming, results } = splitSeason(list, now);
  const next = upcoming[0];
  const record = sport ? seasonRecord(list) : null;
  const following = followed.some((c) => c.id === page.collegeId);
  const stories = news.state === "ready" ? newsForSport(news.value, sport) : [];
  const title = college?.name ?? page.name ?? "";

  if (found.state === "loading") {
    return (
      <PageShell>
        <Spinner />
      </PageShell>
    );
  }
  if (!college) {
    return (
      <PageShell>
        <h1 className="text-[28px] font-bold text-ink">{title || t("College Sports")}</h1>
        <Note>
          {t("This school couldn't be loaded right now. Check your connection and try again.")}
        </Note>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="flex flex-col gap-6 md:flex-row md:items-end">
        <SchoolMark college={college} size={120} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.2em] text-accent">
            {collegeLine(college)}
          </p>
          <h1 className="text-[32px] font-black leading-tight text-ink">{college.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-ink-muted">
            {college.hbcu && (
              <span className="rounded bg-canvas/60 px-2 py-0.5 text-[12px] font-semibold">
                HBCU
              </span>
            )}
            {sports.length > 0 && <span>{t("{n} sports", { n: sports.length })}</span>}
            {record && (record.W > 0 || record.L > 0) && (
              <span className="rounded bg-canvas/60 px-2 py-0.5 font-semibold text-ink">
                {sport} {record.W}–{record.L}
                {record.T ? `–${record.T}` : ""}
              </span>
            )}
          </p>
          {next && (
            <div className="max-w-xl rounded-xl border border-accent/40 bg-elevated p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                {t("Next")} · {next.sport ?? t("Game")}
              </p>
              <p className="mt-1 text-[16px] font-semibold text-ink">{matchupText(next)}</p>
              <p className="text-[12.5px] text-ink-subtle">
                {[fmtWhen(next.start, next.allDay), next.location].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {next?.stream && (
              <button
                type="button"
                data-tv-initial-focus
                onClick={() =>
                  watch(
                    next.stream ?? "",
                    `${college.name} ${matchupText(next)}`,
                    next.sport ?? undefined,
                  )
                }
                className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                <PlayCircle size={16} />
                {t("Watch the next game")}
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleFollowCollege(college)}
              aria-pressed={following}
              className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors ${
                following
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-edge-soft text-ink-muted hover:text-ink"
              }`}
            >
              <Star size={14} fill={following ? "currentColor" : "none"} />
              {following ? t("Following") : t("Follow")}
            </button>
            {site && (
              <button
                type="button"
                onClick={() => openInAppBrowser(`https://${site}`, college.name)}
                className="flex h-10 items-center gap-2 rounded-full border border-edge-soft px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                <ExternalLink size={14} />
                {t("Athletics site")}
              </button>
            )}
          </div>
        </div>
      </section>

      {sports.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip label={t("All sports")} active={!sport} onClick={() => setSport(null)} />
          {sports.map((s) => (
            <Chip key={s} label={s} active={sport === s} onClick={() => setSport(s)} />
          ))}
        </div>
      )}

      {!site && (
        <Note>{t("The NCAA directory doesn't list an athletics site for this school.")}</Note>
      )}
      {site && calendar.state === "loading" && <Spinner />}
      {site && calendar.state === "ready" && !calendar.value && (
        <Note>
          {t(
            "This school's athletics site doesn't publish a calendar we can read, or didn't answer.",
          )}
        </Note>
      )}
      {calendar.state === "ready" && calendar.value && list.length === 0 && (
        <Note>{t("No games on this school's calendar yet.")}</Note>
      )}

      {upcoming.length > 0 && (
        <Shelf title={t("Upcoming")}>
          {upcoming.slice(0, SHELF_MAX).map((e) => (
            <GameCard key={e.id} event={e} college={college} now={now} />
          ))}
        </Shelf>
      )}
      {results.length > 0 && (
        <Shelf title={t("Results")}>
          {results.slice(0, SHELF_MAX).map((e) => (
            <GameCard key={e.id} event={e} college={college} now={now} />
          ))}
        </Shelf>
      )}

      {sport && slug && roster.state === "loading" && <Spinner />}
      {sport &&
        slug &&
        site &&
        roster.state === "ready" &&
        roster.value &&
        roster.value.length > 0 && (
          <Shelf title={t("{sport} roster", { sport })}>
            {roster.value.map((p) => (
              <RosterCard
                key={p.id}
                player={p}
                onOpen={() =>
                  openSportsPage({
                    kind: "student",
                    site,
                    sport: slug,
                    studentId: p.id,
                    name: p.name,
                  })
                }
              />
            ))}
          </Shelf>
        )}
      {!sport && sports.length > 0 && (
        <p className="text-[12.5px] text-ink-subtle">{t("Choose a sport to see its roster.")}</p>
      )}

      {stories.length > 0 && (
        <Shelf title={sport ? t("{sport} news", { sport }) : t("News")}>
          {stories.map((s) => (
            <NewsCard key={s.url} story={s} />
          ))}
        </Shelf>
      )}

      {site && (
        <p className="text-[11.5px] text-ink-subtle">
          {t(
            "Schedules, results, rosters and stream links from {site}. Streams are the school's own.",
            { site },
          )}
        </p>
      )}
    </PageShell>
  );
}
