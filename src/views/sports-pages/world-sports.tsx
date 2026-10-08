import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { AllSportsError, allsportsGetter } from "@/lib/jl/sports/allsports";
import type { AsGame } from "@/lib/jl/sports/as-core";
import {
  WORLD_SPORTS,
  loadCategories,
  loadLeague,
  loadLeagues,
  type Category,
  type League,
} from "@/lib/jl/sports/as-world";
import {
  AsImg,
  GameRow,
  KeyNote,
  Panel,
  SectionTitle,
  Spinner,
  StandingsTables,
  useAllSportsKey,
  useAsLoad,
} from "./allsports-ui";

type Step =
  | { at: "sports" }
  | { at: "countries"; sport: string }
  | { at: "leagues"; sport: string; category: Category }
  | { at: "league"; sport: string; category: Category; league: League };

const chip =
  "flex items-center gap-2 rounded-full border border-edge-soft px-4 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink";

/**
 * World sports from AllSports: sport → country or region → league → its table and fixtures.
 * Fixtures open the Match Center. Hidden behind a short note when the viewer has no key.
 */
export function WorldSportsSection() {
  const t = useT();
  const key = useAllSportsKey();
  const { openSportsPage } = useView();
  const get = useMemo(() => allsportsGetter(key), [key]);
  const [step, setStep] = useState<Step>({ at: "sports" });
  const body = useRef<HTMLDivElement>(null);

  // The activated button disappears with the step: hand focus to the new step so remote and
  // keyboard users aren't left on a detached element. Focus only, nothing is activated.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      el.querySelector<HTMLElement>("button")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [step]);

  const openGame = (g: AsGame) =>
    openSportsPage({
      kind: "match-center",
      sport: g.slug,
      matchId: String(g.id),
      name: `${g.home.short} – ${g.away.short}`,
    });
  const sportLabel = (k: string) => t(WORLD_SPORTS.find((s) => s.key === k)?.label ?? k);

  const back: Step | null =
    step.at === "league"
      ? { at: "leagues", sport: step.sport, category: step.category }
      : step.at === "leagues"
        ? { at: "countries", sport: step.sport }
        : step.at === "countries"
          ? { at: "sports" }
          : null;
  const trail = [
    step.at !== "sports" ? sportLabel(step.sport) : null,
    step.at === "leagues" || step.at === "league" ? step.category.name : null,
    step.at === "league" ? step.league.name : null,
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("World sports")}
        </h2>
        {trail.length > 0 && (
          <span className="truncate text-[13px] text-ink-muted">{trail.join(" › ")}</span>
        )}
      </div>
      <div ref={body} className="flex flex-col gap-3">
        {!key ? (
          <KeyNote />
        ) : (
          <>
            {back && (
              <button onClick={() => setStep(back)} className={`${chip} self-start`}>
                <ChevronLeft size={14} className="dir-icon" />
                {t("Back")}
              </button>
            )}
            {step.at === "sports" && (
              <div className="flex flex-wrap gap-2">
                {WORLD_SPORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStep({ at: "countries", sport: s.key })}
                    className={chip}
                  >
                    {t(s.label)}
                  </button>
                ))}
              </div>
            )}
            {step.at === "countries" && (
              <Countries
                get={get}
                sport={step.sport}
                onPick={(category) => setStep({ at: "leagues", sport: step.sport, category })}
              />
            )}
            {step.at === "leagues" && (
              <Leagues
                get={get}
                sport={step.sport}
                category={step.category}
                onPick={(league) => setStep({ ...step, at: "league", league })}
              />
            )}
            {step.at === "league" && (
              <LeagueDetail
                get={get}
                sport={step.sport}
                league={step.league}
                onOpenGame={openGame}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

type Get = ReturnType<typeof allsportsGetter>;

function Failure({ error, empty }: { error: unknown; empty: string }) {
  const t = useT();
  return (
    <p className="py-6 text-[14px] text-ink-subtle">
      {error instanceof AllSportsError
        ? error.status === 429
          ? t("Your AllSports plan's limit is used up right now.")
          : t("AllSports didn't accept your key. Check it in Settings → Sports plugins & keys.")
        : empty}
    </p>
  );
}

function Countries({
  get,
  sport,
  onPick,
}: {
  get: Get;
  sport: string;
  onPick: (c: Category) => void;
}) {
  const t = useT();
  const { value, loading, error } = useAsLoad(() => loadCategories(get, sport), [get, sport]);
  if (loading) return <Spinner />;
  if (!value?.length)
    return <Failure error={error} empty={t("No countries listed for this sport.")} />;
  return (
    <div className="flex flex-wrap gap-2">
      {value.map((c) => (
        <button key={c.id} onClick={() => onPick(c)} className={chip}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

function Leagues({
  get,
  sport,
  category,
  onPick,
}: {
  get: Get;
  sport: string;
  category: Category;
  onPick: (l: League) => void;
}) {
  const t = useT();
  const { value, loading, error } = useAsLoad(
    () => loadLeagues(get, sport, category.id),
    [get, sport, category.id],
  );
  if (loading) return <Spinner />;
  if (!value?.length) return <Failure error={error} empty={t("No leagues listed here.")} />;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {value.map((l) => (
        <button
          key={l.id}
          onClick={() => onPick(l)}
          className="flex items-center gap-3 rounded-xl bg-elevated/40 p-3 text-start ring-1 ring-edge-soft/50 transition-colors hover:bg-elevated/70"
        >
          <AsImg slug={sport} kind="tournament" id={l.id} className="h-8 w-8" />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{l.name}</span>
        </button>
      ))}
    </div>
  );
}

function LeagueDetail({
  get,
  sport,
  league,
  onOpenGame,
}: {
  get: Get;
  sport: string;
  league: League;
  onOpenGame: (g: AsGame) => void;
}) {
  const t = useT();
  const { value, loading, error } = useAsLoad(
    () => loadLeague(get, sport, league.id),
    [get, sport, league.id],
  );
  if (loading) return <Spinner />;
  if (!value || (!value.standings.length && !value.next.length && !value.last.length))
    return (
      <Failure
        error={error}
        empty={t("AllSports has no table or fixtures for this league right now.")}
      />
    );
  const tableNote =
    value.tableSeason && value.season && value.tableSeason.id !== value.season.id
      ? t("Table from {season}", { season: value.tableSeason.name })
      : value.tableSeason?.name;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <AsImg slug={sport} kind="tournament" id={league.id} className="h-10 w-10" />
        <div>
          <p className="text-lg font-bold text-ink">{value.name || league.name}</p>
          {value.season && <p className="text-[12px] text-ink-subtle">{value.season.name}</p>}
        </div>
      </div>
      {(value.next.length > 0 || value.last.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {value.next.length > 0 && (
            <section>
              <SectionTitle>{t("Fixtures")}</SectionTitle>
              <Panel className="flex flex-col p-2">
                {value.next.map((g) => (
                  <GameRow key={g.id} game={g} onOpen={onOpenGame} />
                ))}
              </Panel>
            </section>
          )}
          {value.last.length > 0 && (
            <section>
              <SectionTitle>{t("Results")}</SectionTitle>
              <Panel className="flex flex-col p-2">
                {value.last.map((g) => (
                  <GameRow key={g.id} game={g} onOpen={onOpenGame} />
                ))}
              </Panel>
            </section>
          )}
        </div>
      )}
      {value.standings.length > 0 && (
        <section>
          <SectionTitle>
            {t("Table")}
            {tableNote ? ` · ${tableNote}` : ""}
          </SectionTitle>
          <StandingsTables slug={sport} tables={value.standings} />
        </section>
      )}
    </div>
  );
}

/** The section on a page of its own, with a back button (for a standalone route or menu entry). */
export function WorldSportsPage() {
  const t = useT();
  const { goBack } = useView();
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas px-6 pb-10 pt-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <button
          onClick={goBack}
          aria-label={t("Back")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated/80 text-ink shadow-lg ring-1 ring-edge-soft/50 transition-colors hover:bg-elevated"
        >
          <ArrowLeft size={20} className="dir-icon" />
        </button>
        <WorldSportsSection />
      </div>
    </div>
  );
}
