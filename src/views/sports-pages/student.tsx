import { ExternalLink, GraduationCap, PlayCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  fetchAllSportsSeason,
  fetchPlayerBio,
  fetchRoster,
  fetchSportSchedule,
  findCollegeBySite,
} from "@/lib/jl/sports/college-data";
import { normalizeSite } from "@/lib/jl/sports/colleges";
import type { SportsPage } from "@/lib/jl/sports/pages";
import {
  matchupText,
  seasonRecord,
  splitSeason,
  sportName,
  validSlug,
  type SchoolEvent,
  type StatTable,
} from "@/lib/jl/sports/sidearm";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useNowTick } from "@/views/live/hooks/use-epg";
import { openInAppBrowser } from "@/lib/window";
import {
  Note,
  PageShell,
  SectionTitle,
  Spinner,
  fmtWhen,
  useLoad,
  useWatchStream,
} from "./college-ui";

/** A student-athlete: roster details and bio from the school, stats, and the team's season. */
export function StudentPage({ page }: { page: Extract<SportsPage, { kind: "student" }> }) {
  const t = useT();
  const { settings } = useSettings();
  const { openSportsPage } = useView();
  const watch = useWatchStream();
  const now = useNowTick(60_000);
  const valid =
    normalizeSite(page.site) === page.site &&
    validSlug(page.sport) &&
    /^\d{1,12}$/.test(page.studentId);
  const site = valid ? page.site : "";
  const slug = valid ? page.sport : "";
  const key = settings.allsportsKey.trim();

  const roster = useLoad(async () => (valid ? fetchRoster(site, slug) : null), [site, slug]);
  const schedule = useLoad(
    async () => (valid ? fetchSportSchedule(site, slug) : null),
    [site, slug],
  );
  const college = useLoad(async () => (valid ? findCollegeBySite(site) : null), [site]);
  const athlete =
    roster.state === "ready" ? (roster.value?.find((p) => p.id === page.studentId) ?? null) : null;
  const profile = athlete?.profile ?? null;
  const bio = useLoad(async () => (profile ? fetchPlayerBio(profile) : null), [profile]);

  const sidearmEvents = schedule.state === "ready" ? (schedule.value?.events ?? []) : [];
  const school =
    (schedule.state === "ready" ? schedule.value?.school : null) ||
    (college.state === "ready" ? college.value?.name : null) ||
    site;
  // The school's calendar first; AllSports (the viewer's own key) only when it has nothing.
  const needFallback = schedule.state === "ready" && sidearmEvents.length === 0;
  const fallbackSchool = college.state === "ready" ? (college.value?.name ?? null) : null;
  const fallback = useLoad(
    async () =>
      needFallback && key && fallbackSchool
        ? fetchAllSportsSeason(key, fallbackSchool, slug)
        : null,
    [needFallback, key, fallbackSchool, slug],
  );
  const fromAllSports = fallback.state === "ready" && !!fallback.value?.length;
  const events: SchoolEvent[] =
    fromAllSports && fallback.state === "ready" ? (fallback.value ?? []) : sidearmEvents;

  if (!valid) {
    return (
      <PageShell>
        <Note>{t("This student-athlete link isn't valid.")}</Note>
      </PageShell>
    );
  }

  const { upcoming } = splitSeason(events, now, 4);
  const next = upcoming[0];
  const record = seasonRecord(events);
  const name = athlete?.name ?? page.name ?? "";
  const facts = athlete
    ? [athlete.position, athlete.year, athlete.height, athlete.weight].filter(Boolean)
    : [];
  const stats = bio.state === "ready" ? (bio.value?.stats ?? []) : [];
  const bioText = bio.state === "ready" ? (bio.value?.bio ?? null) : null;
  const collegeId = college.state === "ready" ? (college.value?.id ?? null) : null;

  return (
    <PageShell>
      <section className="flex flex-col gap-6 md:flex-row md:items-end">
        <span className="block aspect-[3/4] w-44 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-xl ring-1 ring-edge-soft/55 md:w-56">
          {athlete?.photo ? (
            <img
              src={athlete.photo}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-6xl font-black text-ink-subtle/50">
              {name.charAt(0)}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.2em] text-accent">
            {school} · {sportName(slug)}
          </p>
          <h1 className="text-[32px] font-black leading-tight text-ink">
            {athlete?.number && <span className="me-3 text-accent">#{athlete.number}</span>}
            {name}
          </h1>
          {(facts.length > 0 || record.W > 0 || record.L > 0) && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-ink-muted">
              {facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
              {(record.W > 0 || record.L > 0) && (
                <span className="font-semibold text-ink">
                  {t("Team {w}–{l}", { w: record.W, l: record.L })}
                  {record.T ? `–${record.T}` : ""}
                </span>
              )}
            </p>
          )}
          {athlete && (athlete.hometown || athlete.highSchool) && (
            <p className="text-[13px] text-ink-subtle">
              {[athlete.hometown, athlete.highSchool].filter(Boolean).join(" · ")}
            </p>
          )}
          {next && (
            <div className="max-w-xl rounded-xl border border-accent/40 bg-elevated p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                {t("Next game")}
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
                  watch(next.stream ?? "", `${school} ${matchupText(next)}`, sportName(slug))
                }
                className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                <PlayCircle size={16} />
                {t("Watch the game")}
              </button>
            )}
            {athlete?.profile && (
              <button
                type="button"
                onClick={() => openInAppBrowser(athlete.profile ?? "", athlete.name)}
                className="flex h-10 items-center gap-2 rounded-full border border-edge-soft px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                <ExternalLink size={14} />
                {t("Full bio")}
              </button>
            )}
            {collegeId && (
              <button
                type="button"
                onClick={() => openSportsPage({ kind: "college", collegeId, name: school })}
                className="flex h-10 items-center gap-2 rounded-full border border-edge-soft px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                <GraduationCap size={14} />
                {school}
              </button>
            )}
          </div>
        </div>
      </section>

      {roster.state === "loading" && <Spinner />}
      {roster.state === "ready" && roster.value === null && (
        <Note>{t("{site} didn't send the roster just now. Try again in a minute.", { site })}</Note>
      )}
      {roster.state === "ready" && roster.value && !athlete && (
        <Note>{t("This player isn't on the school's current roster.")}</Note>
      )}

      {bioText && (
        <section className="flex max-w-3xl flex-col gap-2">
          <SectionTitle>{t("Bio")}</SectionTitle>
          <p className="text-[14px] leading-relaxed text-ink-muted">{bioText}</p>
        </section>
      )}

      {stats.map((table, i) => (
        <StatsTable key={`${table.title}:${i}`} table={table} />
      ))}

      <section className="flex max-w-5xl flex-col gap-3">
        <SectionTitle>{t("Season")}</SectionTitle>
        {schedule.state === "loading" || fallback.state === "loading" ? (
          <Spinner />
        ) : events.length === 0 ? (
          <Note>
            {t("The school hasn't posted a schedule for this sport yet.")}
            {needFallback && !key && (
              <span className="mt-1 block text-[12.5px] text-ink-subtle">
                {t("Add your key in Settings → Sports plugins & keys")}
              </span>
            )}
          </Note>
        ) : (
          <ol className="divide-y divide-edge-soft/55 overflow-hidden rounded-xl border border-edge-soft/55 bg-elevated">
            {events.map((e) => (
              <li
                key={e.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${e === next ? "bg-accent-soft" : ""}`}
              >
                <span className="w-48 shrink-0 text-[12.5px] text-ink-subtle">
                  {fmtWhen(e.start, e.allDay)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13.5px] font-medium text-ink">{matchupText(e)}</span>
                  {e.location && (
                    <span className="truncate text-[11.5px] text-ink-subtle">{e.location}</span>
                  )}
                </span>
                {e.result && (
                  <span
                    className={`rounded px-2 py-0.5 text-[12px] font-bold tabular-nums ${
                      e.result === "W"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : e.result === "L"
                          ? "bg-danger/15 text-danger"
                          : "bg-canvas/60 text-ink-muted"
                    }`}
                  >
                    {e.result} {e.score}
                  </span>
                )}
                {e.stream && (
                  <button
                    type="button"
                    onClick={() =>
                      watch(e.stream ?? "", `${school} ${matchupText(e)}`, sportName(slug))
                    }
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-semibold text-canvas hover:opacity-90"
                  >
                    <PlayCircle size={13} />
                    {e.result ? t("Replay") : t("Watch")}
                  </button>
                )}
                {e.url && (
                  <button
                    type="button"
                    onClick={() => openInAppBrowser(e.url ?? "", matchupText(e))}
                    className="text-[12px] text-ink-subtle underline underline-offset-4 hover:text-ink"
                  >
                    {t("Game info")}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="text-[11.5px] text-ink-subtle">
          {fromAllSports
            ? t("{site} didn't have this season, so it comes from AllSports (no stream links).", {
                site,
              })
            : t(
                "Schedule, results, roster and stream links from {site}. Streams are the school's own.",
                { site },
              )}
        </p>
      </section>
    </PageShell>
  );
}

function StatsTable({ table }: { table: StatTable }) {
  return (
    <section className="flex max-w-5xl flex-col gap-3">
      <SectionTitle>{table.title}</SectionTitle>
      <div className="overflow-x-auto rounded-xl border border-edge-soft/55 bg-elevated">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead>
            <tr className="border-b border-edge-soft/55 text-ink-subtle">
              {table.headers.map((h, i) => (
                <th
                  key={`${h}:${i}`}
                  className="whitespace-nowrap px-3 py-2 text-start font-semibold"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className="border-b border-edge-soft/30 last:border-0">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`whitespace-nowrap px-3 py-2 ${c === 0 ? "font-semibold text-ink" : "text-ink-muted"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
