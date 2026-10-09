import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { PeopleRankStatus } from "@/lib/people-rankings";
import type { HarborRankExplanation, PersonRankEntry, RankSource } from "@/lib/harbor-rank";
import type { Meta } from "@/lib/cinemeta";
import { PersonRankRow } from "./person-rank-row";
import { bandFor, PeopleTierBand } from "./people-tier-band";
import { EmptyFiltersState, ErrorState, LoadingState, NoKeyState, OfflinePill } from "./people-states";

type Person = HarborRankExplanation | PersonRankEntry;

const BATCH = 40;
const STAGGER_STEP = 30;
const STAGGER_CAP = 8;

export function PeopleRankList({
  status,
  people,
  source,
  topScore,
  heroId,
  heroEligible,
  expandedId,
  onToggleExpand,
  onOpenPerson,
  onOpenMeta,
  onClearFilters,
  onOpenSettings,
  onRetry,
}: {
  status: PeopleRankStatus;
  people: Person[];
  source: RankSource;
  topScore: number | null;
  heroId: number | null;
  heroEligible: boolean;
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  onOpenPerson: (id: number) => void;
  onOpenMeta: (meta: Meta) => void;
  onClearFilters: () => void;
  onOpenSettings: () => void;
  onRetry?: () => void;
}) {
  const t = useT();

  const explained = source === "harbor" ? (people as HarborRankExplanation[]) : null;
  const rankedAll: Person[] = explained ? explained.filter((p) => p.score !== null) : people;
  const unranked = explained ? explained.filter((p) => p.score === null) : [];
  const body = heroId !== null ? rankedAll.filter((p) => p.id !== heroId) : rankedAll;
  const total = body.length;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH);

  useEffect(() => {
    if (visibleCount >= total) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisibleCount(total);
      return;
    }
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + BATCH, total));
        }
      },
      { root: node.closest("main"), rootMargin: "800px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [visibleCount, total]);

  if (status === "loading") return <LoadingState hero={heroEligible} />;
  if (status === "no-key") return <NoKeyState onOpenSettings={onOpenSettings} />;
  if (status === "error") return <ErrorState onRetry={onRetry} />;
  if (people.length === 0) return <EmptyFiltersState onClear={onClearFilters} />;

  const row = (person: Person, index: number): ReactNode => (
    <li
      key={person.id}
      className="animate-in fade-in slide-in-from-bottom-1 duration-250 motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index % BATCH, STAGGER_CAP) * STAGGER_STEP}ms` }}
    >
      <PersonRankRow
        person={person}
        source={source}
        topScore={topScore}
        expanded={expandedId === person.id}
        onToggle={() => onToggleExpand(person.id)}
        onOpenPerson={onOpenPerson}
        onOpenMeta={onOpenMeta}
      />
    </li>
  );

  const visible = body.slice(0, visibleCount);
  const banded: ReactNode[] = [];
  let currentBand: string | null = null;
  visible.forEach((person, index) => {
    const band = bandFor(person.rank);
    if (band.id !== currentBand) {
      banded.push(<PeopleTierBand key={`band-${band.id}`} band={band} />);
      currentBand = band.id;
    }
    banded.push(row(person, index));
  });

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-250 motion-reduce:animate-none">
      {status === "offline" && <OfflinePill />}

      <ul className="flex flex-col gap-4">{banded}</ul>

      {visibleCount < total && <div ref={sentinelRef} aria-hidden className="h-px w-full" />}

      {unranked.length > 0 && (
        <>
          <div className="my-1 flex items-center gap-4">
            <span className="h-px flex-1 bg-edge-soft" aria-hidden />
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              {t("Not enough rated work yet")}
            </span>
            <span className="h-px flex-1 bg-edge-soft" aria-hidden />
          </div>
          <ul className="flex flex-col gap-4">{unranked.map(row)}</ul>
        </>
      )}
    </div>
  );
}
