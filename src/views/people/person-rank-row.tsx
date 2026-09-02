import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { isHarborExplanation } from "@/lib/people-rankings";
import type { HarborRankExplanation, PersonRankEntry, RankSource } from "@/lib/harbor-rank";
import type { Meta } from "@/lib/cinemeta";
import { RankLedger } from "./rank-ledger";
import { RankNumeral } from "./rank-numeral";
import { PersonScore } from "./person-score";
import { PersonMedals } from "./person-medals";
import { PersonKnownStrip } from "./person-known-strip";
import { MovementDelta } from "./movement-delta";
import { DEPT_LABEL, profilePhoto } from "./people-utils";

const SOURCE_TICK: Record<RankSource, string> = {
  harbor: "Harbor",
  trending: "Trending",
  rising: "Rising",
  contenders: "Contender",
  tmdb: "TMDB",
  imdb: "IMDb",
  consensus: "Consensus",
};

type Person = HarborRankExplanation | PersonRankEntry;

export function PersonRankRow({
  person,
  source,
  topScore,
  expanded,
  onToggle,
  onOpenPerson,
  onOpenMeta,
}: {
  person: Person;
  source: RankSource;
  topScore: number | null;
  expanded: boolean;
  onToggle: () => void;
  onOpenPerson: (id: number) => void;
  onOpenMeta: (meta: Meta) => void;
}) {
  const t = useT();
  const harbor = isHarborExplanation(person);
  const ranked = harbor && person.score !== null;
  const tier: "featured" | "dense" = person.rank <= 10 ? "featured" : "dense";
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (expanded) setEverOpened(true);
  }, [expanded]);

  const departmentKey = DEPT_LABEL[person.department];
  const dept = departmentKey ? t(departmentKey) : person.department;
  const photo = profilePhoto(person.profilePath, tier === "featured" ? 342 : 185);

  const frame =
    tier === "featured"
      ? "min-h-[176px] rounded-lg bg-elevated p-5 hover:bg-raised"
      : "min-h-[104px] rounded-lg bg-surface py-3 pe-4 ps-2 hover:bg-elevated";
  const faceSize = tier === "featured" ? "h-[152px] w-[104px]" : "h-[100px] w-[70px]";

  return (
    <li className="scroll-mt-40">
      <div
        className={`group relative transition-colors ease-out motion-reduce:transition-none ${frame}`}
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-center gap-4 md:gap-5">
          <div className="relative flex shrink-0 items-center">
            <span className={`flex justify-end ${tier === "featured" ? "w-16" : "w-11"}`}>
              <RankNumeral rank={person.rank} size={tier} />
            </span>
            <button
              type="button"
              onClick={() => onOpenPerson(person.id)}
              aria-label={t("Open {name}, ranked {rank}", {
                name: person.name,
                rank: String(person.rank),
              })}
              className={`relative z-10 -ms-3 shrink-0 overflow-hidden rounded-lg bg-elevated/60 ring-1 ring-edge-soft/60 no-press transition-[scale,box-shadow] duration-250 ease-out motion-safe:group-hover:scale-[1.04] motion-safe:group-hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${faceSize}`}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={person.name}
                  loading="lazy"
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
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPerson(person.id)}
              className={`truncate text-start font-display font-medium leading-tight text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                tier === "featured" ? "text-[20px]" : "text-[16px]"
              }`}
            >
              {person.name}
            </button>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-ink-subtle">
                {dept}
              </span>
              {ranked && person.avgRating !== null && (
                <span className="rounded-full bg-white/[0.06] px-1.5 text-[11px] tabular-nums text-ink-muted">
                  {t("{v} avg", { v: person.avgRating.toFixed(1) })}
                </span>
              )}
              {!harbor && "delta" in person && <MovementDelta delta={person.delta} />}
            </div>

            {ranked && <RationaleLine person={person} />}
            {harbor && !ranked && (
              <p className="mt-1 text-[12.5px] text-ink-subtle">{t("Not enough rated work yet")}</p>
            )}

            {!harbor && (
              <div className="mt-1 flex flex-col gap-2">
                {person.knownFor && person.knownFor.length > 0 && (
                  <PersonKnownStrip
                    known={person.knownFor}
                    size="dense"
                    count={5}
                    onOpenMeta={onOpenMeta}
                  />
                )}
                {source === "consensus" &&
                  person.blendSources &&
                  person.blendSources.length > 0 && <BlendTicks sources={person.blendSources} />}
              </div>
            )}
          </div>

          {ranked && (
            <div className={`hidden shrink-0 flex-col gap-2.5 md:flex md:w-[212px] lg:w-[248px]`}>
              <RankLedger person={person} mode="micro" onOpenMeta={onOpenMeta} />
              <PersonKnownStrip
                titles={person.topTitles}
                size={tier === "featured" ? "featured" : "dense"}
                count={tier === "featured" ? 4 : 3}
                onOpenMeta={onOpenMeta}
              />
            </div>
          )}

          {ranked && person.score !== null && (
            <div className="flex w-[92px] shrink-0 flex-col items-end gap-2 sm:w-[112px]">
              <PersonScore
                score={person.score}
                topScore={topScore}
                avgRating={person.avgRating}
                ratedTitles={person.ratedTitles}
                size={tier}
              />
              <PersonMedals
                wins={person.majorAwardWins}
                noms={person.majorAwardNoms}
                missing={person.awardsDataMissing}
                awards={person.awards}
                variant="count"
              />
            </div>
          )}
        </div>

        {ranked && (
          <div className="mt-3">
            {everOpened && (
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out motion-reduce:transition-none ${
                  expanded ? "mb-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <RankLedger person={person} mode="full" onOpenMeta={onOpenMeta} />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] font-medium text-ink-muted transition-colors ease-out hover:bg-white/[0.10] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${
                tier === "featured" ? "min-h-[44px] text-[12.5px]" : "min-h-[40px] text-[12px]"
              }`}
            >
              {expanded ? t("Hide breakdown") : t("Why this rank")}
              <ChevronDown
                size={15}
                strokeWidth={2.4}
                aria-hidden
                className={`transition-transform duration-250 ease-out motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function RationaleLine({ person }: { person: HarborRankExplanation }) {
  const t = useT();
  const dot = <span className="text-ink-subtle">&middot;</span>;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-ink-muted">
      <span>
        <span className="tabular-nums">{person.acclaimedCount8}</span> {t("acclaimed titles")}
      </span>
      {dot}
      {person.awardsDataMissing ? (
        <span className="text-ink-subtle">{t("Awards data unavailable")}</span>
      ) : (
        <span>
          <span className="tabular-nums">{person.majorAwardWins}</span> {t("major awards")}
        </span>
      )}
      {dot}
      <span>
        <span className="tabular-nums">{person.leadRoles}</span> {t("lead roles")}
      </span>
    </p>
  );
}

function BlendTicks({ sources }: { sources: RankSource[] }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle">{t("Blended from")}</p>
      <div className="flex flex-wrap gap-1">
        {sources.map((s) => (
          <span
            key={s}
            className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted"
          >
            {t(SOURCE_TICK[s])}
          </span>
        ))}
      </div>
    </div>
  );
}
