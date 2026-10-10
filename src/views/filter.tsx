import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { selectSpotlights } from "@/lib/feed/genre-spotlights";
import { SeenIdsProvider } from "@/lib/feed/seen-ids";
import { useScrollMemory, type MetaFilter } from "@/lib/view";
import { Header } from "./filter/header";
import { BrandBrowse } from "./filter/brand-browse";
import { BrandFacts, useBrandStats } from "./filter/brand-facts";
import { BrandPeople } from "./filter/brand-people";
import { BoxOfficeRail, DecadesSection, FranchisesRail, LongestRunningRail } from "./filter/brand-rails";
import { CountryBody } from "./filter/country-body";
import { Rails } from "./filter/rails";
import { YearTopTen } from "./filter/year-top-ten";
import {
  SPOTLIGHT_TIMEOUT_MS,
  SpotlightGateContext,
  type SpotlightGate,
} from "./filter/spotlight-gate";

export function FilterView({ filter }: { filter: MetaFilter }) {
  const scrollRef = useRef<HTMLElement>(null);
  const seenRef = useRef(new Map<string, string>());
  const expectedSpotlights = useMemo(
    () => (filter.kind === "genre" ? selectSpotlights(filter.name).length : 0),
    [filter],
  );
  const [doneSpotlights, setDoneSpotlights] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    seenRef.current = new Map();
    setDoneSpotlights(0);
    setTimedOut(false);
    const t = window.setTimeout(() => setTimedOut(true), SPOTLIGHT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [filter]);
  const markDone = useCallback(() => setDoneSpotlights((n) => n + 1), []);
  const ready = expectedSpotlights === 0 || doneSpotlights >= expectedSpotlights || timedOut;
  const gate = useMemo<SpotlightGate>(() => ({ ready, markDone }), [ready, markDone]);
  useScrollMemory(filterKey(filter), scrollRef);
  return (
    <SeenIdsProvider value={seenRef}>
      <SpotlightGateContext.Provider value={gate}>
        <main ref={scrollRef} className="absolute inset-0 z-30 overflow-y-auto bg-canvas">
          <Header filter={filter} />
          <div className="flex flex-col gap-12 px-12 pb-24">
            {filter.kind === "studio" || filter.kind === "network" ? (
              <BrandedBody filter={filter} />
            ) : filter.kind === "country" ? (
              <CountryBody filter={filter} />
            ) : (
              <Rails filter={filter} />
            )}
            {filter.kind === "year" && filter.mediaType === "movie" && (
              <YearTopTen year={filter.value} />
            )}
          </div>
          <BackToTop scrollRef={scrollRef} />
        </main>
      </SpotlightGateContext.Provider>
    </SeenIdsProvider>
  );
}

function BrandedBody({ filter }: { filter: MetaFilter & { kind: "studio" | "network"; id: number; name: string } }) {
  const { details, stats } = useBrandStats(filter);
  return (
    <>
      <BrandFacts filter={filter} details={details} stats={stats} />
      <Rails filter={filter} />
      {stats && filter.mediaType === "movie" && <BoxOfficeRail stats={stats} />}
      {stats && <FranchisesRail stats={stats} name={filter.name} />}
      {stats && filter.mediaType === "tv" && <LongestRunningRail stats={stats} name={filter.name} />}
      <BrandPeople filter={filter} stats={stats} />
      {stats && <DecadesSection filter={filter} stats={stats} />}
      <BrandBrowse filter={filter} />
    </>
  );
}

function filterKey(f: MetaFilter): string {
  if (f.kind === "year" || f.kind === "runtime") {
    return `filter:${f.kind}:${f.mediaType}:${f.value}`;
  }
  return `filter:${f.kind}:${f.mediaType}:${f.name}`;
}
