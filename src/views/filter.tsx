import { BackToTop } from "@/components/back-to-top";
import { selectSpotlights } from "@/lib/feed/genre-spotlights";
import { SeenIdsProvider } from "@/lib/feed/seen-ids";
import { useScrollMemory, type MetaFilter } from "@/lib/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Header } from "./filter/header";
import { Rails } from "./filter/rails";
import { SPOTLIGHT_TIMEOUT_MS, SpotlightGateContext, type SpotlightGate } from "./filter/spotlight-gate";

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
            <Rails filter={filter} />
          </div>
          <BackToTop scrollRef={scrollRef} />
        </main>
      </SpotlightGateContext.Provider>
    </SeenIdsProvider>
  );
}

function filterKey(f: MetaFilter): string {
  if (f.kind === "year" || f.kind === "runtime") {
    return `filter:${f.kind}:${f.mediaType}:${f.value}`;
  }
  return `filter:${f.kind}:${f.mediaType}:${f.name}`;
}
