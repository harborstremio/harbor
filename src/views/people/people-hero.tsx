import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import type { HarborRankExplanation, PersonRankEntry, RankSource } from "@/lib/harbor-rank";
import type { Meta } from "@/lib/cinemeta";
import { isHarborExplanation } from "@/lib/people-rankings";
import { RankNumeral } from "./rank-numeral";
import { PersonScore } from "./person-score";
import { PersonMedals } from "./person-medals";
import { PersonKnownStrip } from "./person-known-strip";
import { PeopleHeroBackdrop } from "./people-hero-backdrop";
import { bandImage, DEPT_LABEL, profilePhoto } from "./people-utils";

type Person = HarborRankExplanation | PersonRankEntry;

const EYEBROW: Record<RankSource, string> = {
  harbor: "Hall of Fame",
  trending: "Trending now",
  rising: "Rising star",
  contenders: "In contention",
  tmdb: "Most popular",
  imdb: "Most popular",
  consensus: "Consensus #1",
};

const REVEAL = "animate-in fade-in slide-in-from-bottom-2 duration-250 motion-reduce:animate-none";
const revealAt = (ms: number): CSSProperties => ({
  animationDelay: `${ms}ms`,
  animationFillMode: "both",
});

export function PeopleHero({
  person,
  source,
  total,
  onOpenPerson,
  onOpenMeta,
  onExplain,
}: {
  person: Person;
  source: RankSource;
  total: number;
  onOpenPerson: (id: number) => void;
  onOpenMeta: (meta: Meta) => void;
  onExplain: () => void;
}) {
  const t = useT();
  const harbor = isHarborExplanation(person);
  const ranked = harbor && person.score !== null;
  const bg = bandImage(person);
  const face = profilePhoto(person.profilePath, 342);
  const departmentKey = DEPT_LABEL[person.department];
  const departmentLabel = departmentKey ? t(departmentKey) : person.department;
  const meta = [
    departmentLabel,
    harbor ? (person.country ?? undefined) : undefined,
    ranked && person.avgRating !== null
      ? t("{v} avg", { v: person.avgRating.toFixed(1) })
      : undefined,
  ].filter(Boolean);
  const showSecondary = source === "harbor" || source === "consensus";

  return (
    <section className="harbor-people-hero relative isolate min-h-[360px] overflow-hidden sm:min-h-[440px] lg:min-h-[560px]">
      <PeopleHeroBackdrop stills={person.stills ?? []} fallback={bg} seed={String(person.id)} />

      <div className="hero-reveal relative max-w-[46rem] px-12 pb-10 pt-40">
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-4 start-6 -z-10 opacity-90"
        >
          <RankNumeral rank={1} size="hero" />
        </span>

        <div className="relative flex flex-col gap-4">
          <span
            className={`text-[11px] uppercase tracking-[0.2em] text-ink-subtle ${REVEAL}`}
            style={revealAt(0)}
          >
            {t(EYEBROW[source])}
          </span>

          <div className={`flex items-end gap-6 ${REVEAL}`} style={revealAt(40)}>
            <button
              type="button"
              onClick={() => onOpenPerson(person.id)}
              aria-label={t("View {name}", { name: person.name })}
              className="relative h-[188px] w-[128px] shrink-0 overflow-hidden rounded-lg bg-elevated/60 shadow-[0_26px_50px_-16px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft no-press transition-[scale,box-shadow] duration-250 ease-out motion-safe:hover:scale-[1.02] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {face ? (
                <img
                  src={face}
                  alt={person.name}
                  className="absolute inset-0 h-full w-full object-cover object-[center_top]"
                />
              ) : (
                <Poster
                  src={undefined}
                  seed={String(person.id)}
                  ratio="portrait"
                  className="absolute inset-0"
                />
              )}
            </button>

            <div className="flex min-w-0 flex-col gap-2 pb-1">
              <button
                type="button"
                onClick={() => onOpenPerson(person.id)}
                className="text-start font-display text-[clamp(40px,5.5vw,76px)] font-medium leading-[0.95] tracking-tight text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {person.name}
              </button>
              {meta.length > 0 && (
                <p className="text-[13px] tabular-nums text-ink-muted">{meta.join(" · ")}</p>
              )}
              {ranked ? (
                <p className="text-[13px] text-ink-muted">
                  {t(
                    "Ranked #1 of {total} for {acclaimed} acclaimed titles and {awards} major awards.",
                    {
                      total: String(total),
                      acclaimed: String(person.acclaimedCount8),
                      awards: String(person.majorAwardWins),
                    },
                  )}
                </p>
              ) : (
                <TrendingLine person={person} />
              )}
            </div>
          </div>

          {ranked && (
            <div className={`flex flex-wrap items-end gap-6 pt-1 ${REVEAL}`} style={revealAt(80)}>
              <PersonScore
                score={person.score as number}
                topScore={person.score}
                avgRating={person.avgRating}
                ratedTitles={person.ratedTitles}
                size="hero"
                align="start"
              />
              <PersonMedals
                wins={person.majorAwardWins}
                noms={person.majorAwardNoms}
                missing={person.awardsDataMissing}
                awards={person.awards}
                variant="expanded"
              />
            </div>
          )}

          <HeroStrip person={person} harbor={harbor} onOpenMeta={onOpenMeta} delay={120} />

          <div className={`flex flex-wrap items-center gap-3 pt-2 ${REVEAL}`} style={revealAt(160)}>
            <button
              type="button"
              onClick={() => onOpenPerson(person.id)}
              className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform ease-out hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {t("View {name}", { name: person.name })}
            </button>
            {showSecondary && (
              <button
                type="button"
                onClick={onExplain}
                className="inline-flex h-12 items-center rounded-full bg-surface/60 px-5 text-[14px] font-medium text-ink-muted ring-1 ring-edge-soft backdrop-blur transition-colors ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
              >
                {t("How this is ranked")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendingLine({ person }: { person: Person }) {
  const t = useT();
  if (isHarborExplanation(person)) return null;
  const delta = person.delta;
  if (delta === undefined) return null;
  const copy =
    delta === null
      ? t("New to the chart")
      : delta > 0
        ? t("Up {n} spots this week", { n: String(delta) })
        : null;
  if (!copy) return null;
  return <p className="text-[13px] text-ink-muted">{copy}</p>;
}

function HeroStrip({
  person,
  harbor,
  onOpenMeta,
  delay,
}: {
  person: Person;
  harbor: boolean;
  onOpenMeta: (meta: Meta) => void;
  delay: number;
}) {
  const wrap = (node: ReactNode) => (
    <div className={REVEAL} style={revealAt(delay)}>
      {node}
    </div>
  );
  if (harbor && isHarborExplanation(person)) {
    if (person.topTitles.length === 0) return null;
    return wrap(
      <PersonKnownStrip titles={person.topTitles} size="hero" count={6} onOpenMeta={onOpenMeta} />,
    );
  }
  if (!isHarborExplanation(person) && person.knownFor && person.knownFor.length > 0) {
    return wrap(
      <PersonKnownStrip known={person.knownFor} size="hero" count={6} onOpenMeta={onOpenMeta} />,
    );
  }
  return null;
}
