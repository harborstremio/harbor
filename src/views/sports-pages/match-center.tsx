import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { AllSportsError, allsportsGetter } from "@/lib/jl/sports/allsports";
import type { AsGame } from "@/lib/jl/sports/as-core";
import {
  loadMatchCenter,
  momentumKind,
  type Lineup,
  type MatchCenter,
  type TimelineItem,
} from "@/lib/jl/sports/match-center";
import { MarginChart } from "@/components/sports/margin-chart";
import {
  AsImg,
  GameRow,
  KeyNote,
  Panel,
  SectionTitle,
  Spinner,
  StandingsTables,
  gameStatus,
  useAllSportsKey,
  useAsLoad,
} from "./allsports-ui";

type Tab = "summary" | "lineups" | "stats" | "h2h" | "table";

export function MatchCenterPage({ page }: { page: Extract<SportsPage, { kind: "match-center" }> }) {
  const t = useT();
  const { goBack, openSportsPage } = useView();
  const key = useAllSportsKey();
  const id = Number(page.matchId);
  const get = useMemo(() => allsportsGetter(key), [key]);
  const {
    value: m,
    loading,
    error,
  } = useAsLoad(
    () =>
      key && Number.isFinite(id) ? loadMatchCenter(get, page.sport, id) : Promise.resolve(null),
    [get, key, page.sport, id],
    // Live games refresh every 30 s; the short-lived parts are re-fetched, the rest stay cached.
    (v) => (v?.event.state === "in" ? 30_000 : null),
  );
  const openGame = (g: AsGame) =>
    openSportsPage({
      kind: "match-center",
      sport: g.slug,
      matchId: String(g.id),
      name: `${g.home.short} – ${g.away.short}`,
    });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="relative shrink-0 px-6 pt-24">
        <button
          onClick={goBack}
          aria-label={t("Back")}
          className="absolute start-6 top-24 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-elevated/80 text-ink shadow-lg ring-1 ring-edge-soft/50 transition-colors hover:bg-elevated md:top-20"
        >
          <ArrowLeft size={20} className="dir-icon" />
        </button>
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Match Center")}
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        {!key ? (
          <div className="pt-10">
            <KeyNote />
          </div>
        ) : m ? (
          <MatchBody m={m} onOpenGame={openGame} />
        ) : loading ? (
          <Spinner />
        ) : (
          <p className="py-16 text-center text-ink-subtle">
            {error instanceof AllSportsError
              ? error.status === 429
                ? t("Your AllSports plan's limit is used up right now.")
                : t(
                    "AllSports didn't accept your key. Check it in Settings → Sports plugins & keys.",
                  )
              : t("AllSports has no details for this game right now.")}
          </p>
        )}
      </div>
    </div>
  );
}

function MatchBody({ m, onOpenGame }: { m: MatchCenter; onOpenGame: (g: AsGame) => void }) {
  const t = useT();
  const e = m.event;
  const hasLineups =
    !!m.lineups && (m.lineups.home.players.length > 0 || m.lineups.away.players.length > 0);
  const tabs: { id: Tab; label: string }[] = [
    { id: "summary", label: t("Summary") },
    ...(hasLineups ? [{ id: "lineups" as const, label: t("Lineups") }] : []),
    ...(m.stats.length ? [{ id: "stats" as const, label: t("Stats") }] : []),
    ...(m.meetings.length || m.series || m.form.home || m.form.away
      ? [{ id: "h2h" as const, label: t("Head-to-head") }]
      : []),
    ...(m.standings.length ? [{ id: "table" as const, label: t("Table") }] : []),
  ];
  const [tab, setTab] = useState<Tab>("summary");
  const active = tabs.some((x) => x.id === tab) ? tab : "summary";

  return (
    <>
      <Scoreboard m={m} />
      <div className="mt-8 flex shrink-0 gap-6 overflow-x-auto border-b border-edge-soft/50">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            aria-pressed={active === x.id}
            className={`relative shrink-0 pb-3 text-sm font-semibold transition-colors ${active === x.id ? "text-ink" : "text-ink-subtle hover:text-ink-muted"}`}
          >
            {x.label}
            {active === x.id && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-accent" />
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-8 py-6">
        {active === "summary" && <Summary m={m} />}
        {active === "lineups" && m.lineups && <Lineups m={m} />}
        {active === "stats" && <Stats m={m} />}
        {active === "h2h" && <HeadToHead m={m} onOpenGame={onOpenGame} />}
        {active === "table" && (
          <StandingsTables slug={e.slug} tables={m.standings} highlight={[e.home.id, e.away.id]} />
        )}
        <p className="text-[11px] text-ink-subtle">
          {t("Scores and stats from AllSports, with your own key.")}
        </p>
      </div>
    </>
  );
}

function Scoreboard({ m }: { m: MatchCenter }) {
  const t = useT();
  const e = m.event;
  const sub = [m.tournament, e.round ? t("Round {round}", { round: e.round }) : null, m.venue]
    .filter(Boolean)
    .join(" · ");
  const side = (s: "home" | "away") => (
    <div className="flex flex-1 flex-col items-center gap-3 text-center">
      <AsImg
        slug={e.slug}
        kind="team"
        id={e[s].id}
        className="h-20 w-20 rounded-2xl bg-elevated/40 p-3 ring-1 ring-edge-soft/50 md:h-28 md:w-28"
      />
      <span className="text-lg font-bold leading-tight text-ink md:text-2xl">{e[s].name}</span>
      {m.coaches[s] && (
        <span className="text-[12px] text-ink-subtle">
          {t("Coach {name}", { name: m.coaches[s] })}
        </span>
      )}
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-6 pt-6">
      {sub && <p className="text-center text-[13px] text-ink-muted">{sub}</p>}
      <div className="flex w-full items-center justify-center gap-4 md:gap-12">
        {side("home")}
        <div className="flex flex-col items-center gap-3">
          {e.state === "pre" ? (
            <span className="text-3xl font-black text-ink-subtle">{t("vs")}</span>
          ) : (
            <span className="text-5xl font-black tabular-nums tracking-tighter text-ink md:text-7xl">
              {e.home.score ?? 0}
              <span className="mx-3 text-ink-subtle">-</span>
              {e.away.score ?? 0}
            </span>
          )}
          <span
            className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${e.state === "in" ? "bg-accent text-canvas" : "bg-ink text-canvas"}`}
          >
            {gameStatus(e, t)}
          </span>
          {m.attendance ? (
            <span className="text-[11px] text-ink-subtle">
              {t("Attendance {n}", { n: m.attendance.toLocaleString() })}
            </span>
          ) : null}
        </div>
        {side("away")}
      </div>
    </div>
  );
}

function Summary({ m }: { m: MatchCenter }) {
  const t = useT();
  const e = m.event;
  const mk = momentumKind(e.slug);
  const empty = !m.periods.length && m.margin.length < 2 && !m.timeline.length && !m.best.length;
  if (empty)
    return (
      <p className="text-center text-sm text-ink-subtle">
        {e.state === "pre" ? t("The game hasn't started yet.") : t("No events available yet.")}
      </p>
    );
  return (
    <>
      {m.periods.length > 0 && (
        <section>
          <SectionTitle>{t("Score by period")}</SectionTitle>
          <Panel className="overflow-x-auto">
            <table className="w-full text-center text-[14px] tabular-nums">
              <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th className="px-3 py-2 text-start">{t("Team")}</th>
                  {m.periods.map((p) => (
                    <th key={p.label} className="px-2 py-2">
                      {p.label}
                    </th>
                  ))}
                  <th className="px-3 py-2">T</th>
                </tr>
              </thead>
              <tbody>
                {(["home", "away"] as const).map((s) => (
                  <tr key={s} className="border-t border-edge-soft/50">
                    <td className="px-3 py-2 text-start font-semibold text-ink">{e[s].short}</td>
                    {m.periods.map((p) => (
                      <td key={p.label} className="px-2 py-2 text-ink-muted">
                        {p[s] ?? "–"}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-black text-ink">{e[s].score ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </section>
      )}
      {m.margin.length > 1 && (
        <section>
          <SectionTitle>{t("Momentum")}</SectionTitle>
          <Panel>
            <MarginChart
              points={m.margin}
              home={e.home.short}
              away={e.away.short}
              mode={mk.mode}
              periods={mk.periods}
              prefix={mk.prefix}
            />
          </Panel>
        </section>
      )}
      {m.best.length > 0 && (
        <section>
          <SectionTitle>{t("Best players")}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {m.best.map((p) => (
              <Panel key={p.side} className="flex items-center gap-4">
                <AsImg
                  slug={e.slug}
                  kind="player"
                  id={p.id}
                  className="h-12 w-12 overflow-hidden rounded-full bg-canvas"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {p.name}
                    {p.position ? (
                      <span className="ms-2 text-[12px] text-ink-subtle">{p.position}</span>
                    ) : null}
                  </p>
                  <p className="text-[13px] text-ink-muted">
                    {e[p.side].short} · {p.value}
                  </p>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}
      {m.timeline.length > 0 && (
        <section>
          <SectionTitle>{t("Events")}</SectionTitle>
          <ol className="flex flex-col gap-2">
            {m.timeline.map((x) => (
              <TimelineRow key={x.id} item={x} m={m} />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

function TimelineMark({ kind }: { kind: TimelineItem["kind"] }) {
  if (kind === "yellow")
    return <span className="h-4 w-3 rounded-[2px] bg-yellow-400 ring-1 ring-black/20" />;
  if (kind === "red")
    return <span className="h-4 w-3 rounded-[2px] bg-red-500 ring-1 ring-black/20" />;
  const glyph =
    kind === "score"
      ? "●"
      : kind === "sub"
        ? "⇄"
        : kind === "var"
          ? "VAR"
          : kind === "miss"
            ? "✕"
            : "";
  return <span className="text-[11px] font-bold text-ink-muted">{glyph}</span>;
}

function TimelineRow({ item, m }: { item: TimelineItem; m: MatchCenter }) {
  const e = m.event;
  if (item.kind === "period")
    return (
      <li className="flex items-center gap-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
        <span className="h-px flex-1 bg-edge-soft" />
        {item.title}
        {item.score ? ` · ${item.score.home} – ${item.score.away}` : ""}
        <span className="h-px flex-1 bg-edge-soft" />
      </li>
    );
  const away = item.side === "away";
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-edge-soft/30 bg-elevated/40 p-3 ${away ? "flex-row-reverse text-end" : ""}`}
    >
      <span className="w-16 shrink-0 text-center text-[13px] font-bold text-ink-muted">
        {item.clock ?? ""}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas ring-1 ring-edge-soft/50">
        <TimelineMark kind={item.kind} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-semibold text-ink">
          {item.title}
          {item.player ? ` · ${item.player}` : ""}
        </span>
        <span className="text-[12px] text-ink-subtle">
          {[item.side ? e[item.side].short : null, item.detail].filter(Boolean).join(" · ")}
        </span>
      </span>
      {item.score && (
        <span className="shrink-0 font-bold tabular-nums text-ink">
          {item.score.home} – {item.score.away}
        </span>
      )}
    </li>
  );
}

function LineupList({
  lineup,
  name,
  slug,
  teamId,
}: {
  lineup: Lineup;
  name: string;
  slug: string;
  teamId: number;
}) {
  const t = useT();
  const starters = lineup.players.filter((p) => p.starter);
  const bench = lineup.players.filter((p) => !p.starter);
  const row = (p: Lineup["players"][number]) => (
    <li key={p.id || p.name} className="flex items-baseline gap-3 py-1.5 text-[13px]">
      <span className="w-6 shrink-0 text-end text-[12px] font-bold text-ink-subtle tabular-nums">
        {p.jersey ?? ""}
      </span>
      <span className={`min-w-0 flex-1 ${p.starter ? "font-semibold text-ink" : "text-ink-muted"}`}>
        {p.name}
        {p.position ? (
          <span className="ms-2 text-[11px] uppercase text-ink-subtle">{p.position}</span>
        ) : null}
      </span>
      {p.line && <span className="shrink-0 text-end text-[12px] text-ink-muted">{p.line}</span>}
    </li>
  );
  return (
    <Panel className="flex-1">
      <div className="mb-2 flex items-center justify-between border-b border-edge-soft/50 pb-2">
        <span className="flex items-center gap-2 font-bold text-ink">
          <AsImg slug={slug} kind="team" id={teamId} className="h-6 w-6" />
          {name}
        </span>
        {lineup.formation && (
          <span className="rounded-full bg-elevated px-3 py-1 text-[12px] font-bold text-ink-muted">
            {lineup.formation}
          </span>
        )}
      </div>
      <ul className="divide-y divide-edge-soft/40">{starters.map(row)}</ul>
      {bench.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            {t("Bench")}
          </p>
          <ul className="divide-y divide-edge-soft/40">{bench.map(row)}</ul>
        </>
      )}
    </Panel>
  );
}

function Lineups({ m }: { m: MatchCenter }) {
  const t = useT();
  const e = m.event;
  const l = m.lineups!;
  return (
    <section>
      <SectionTitle>{l.confirmed ? t("Lineups") : t("Expected lineups")}</SectionTitle>
      <div className="flex flex-col gap-4 md:flex-row">
        <LineupList lineup={l.home} name={e.home.name} slug={e.slug} teamId={e.home.id} />
        <LineupList lineup={l.away} name={e.away.name} slug={e.slug} teamId={e.away.id} />
      </div>
    </section>
  );
}

function Stats({ m }: { m: MatchCenter }) {
  const e = m.event;
  const n = (v: string) => parseFloat(v.replace(/[^0-9.-]/g, "")) || 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {m.stats.map((g) => (
        <Panel key={g.name}>
          <div className="mb-1 grid grid-cols-[1fr_auto_1fr] text-[11px] font-bold uppercase tracking-widest text-ink-subtle">
            <span>{e.home.short}</span>
            <span>{g.name}</span>
            <span className="text-end">{e.away.short}</span>
          </div>
          {g.rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[1fr_auto_1fr] border-t border-edge-soft/50 py-2 text-[13px] tabular-nums"
            >
              <span className={n(r.home) > n(r.away) ? "font-bold text-ink" : "text-ink-muted"}>
                {r.home}
              </span>
              <span className="px-3 text-center text-[12px] text-ink-subtle">{r.label}</span>
              <span
                className={`text-end ${n(r.away) > n(r.home) ? "font-bold text-ink" : "text-ink-muted"}`}
              >
                {r.away}
              </span>
            </div>
          ))}
        </Panel>
      ))}
    </div>
  );
}

function HeadToHead({ m, onOpenGame }: { m: MatchCenter; onOpenGame: (g: AsGame) => void }) {
  const t = useT();
  const e = m.event;
  const formBadge = (r: string, i: number) => (
    <span
      key={i}
      className={`flex h-7 w-7 items-center justify-center rounded text-[12px] font-bold text-white ${r === "W" ? "bg-emerald-600" : r === "L" ? "bg-red-700" : "bg-slate-600"}`}
    >
      {r}
    </span>
  );
  return (
    <>
      {m.series && (
        <section>
          <SectionTitle>{t("All-time series")}</SectionTitle>
          <Panel className="grid grid-cols-3 text-center">
            {[
              [e.home.short, m.series.home],
              [t("Draws"), m.series.draws],
              [e.away.short, m.series.away],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex flex-col gap-1">
                <span className="text-3xl font-black tabular-nums text-ink">{value}</span>
                <span className="text-[12px] text-ink-subtle">{label}</span>
              </div>
            ))}
          </Panel>
        </section>
      )}
      {(m.form.home || m.form.away) && (
        <section>
          <SectionTitle>{t("Form")}</SectionTitle>
          <Panel className="flex flex-col gap-2">
            {(["home", "away"] as const).map((s) =>
              m.form[s] ? (
                <div key={s} className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold text-ink">
                    {e[s].short}
                    {m.form[s]!.place ? (
                      <span className="ms-2 text-[12px] font-normal text-ink-subtle">
                        {t("#{n} in the table", { n: m.form[s]!.place! })}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex gap-1">{m.form[s]!.form.map(formBadge)}</span>
                </div>
              ) : null,
            )}
          </Panel>
        </section>
      )}
      {m.meetings.length > 0 && (
        <section>
          <SectionTitle>{t("Last meetings")}</SectionTitle>
          <Panel className="flex flex-col p-2">
            {m.meetings.map((g) => (
              <GameRow key={g.id} game={g} onOpen={onOpenGame} />
            ))}
          </Panel>
        </section>
      )}
    </>
  );
}
