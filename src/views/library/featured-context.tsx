import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";

type Ctx = {
  metas: Meta[];
  report: (metas: Meta[]) => void;
};

const FeaturedContext = createContext<Ctx | null>(null);

/**
 * Lets the open library tab publish what it is currently showing, so the hero
 * above the tab bar can reflect it without lifting each tab's data pipeline.
 * Only one tab is mounted at a time, so a single slot is enough.
 */
export function LibraryFeaturedProvider({ children }: { children: React.ReactNode }) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const report = useCallback((next: Meta[]) => {
    setMetas((prev) => (sameIds(prev, next) ? prev : next));
  }, []);
  const value = useMemo(() => ({ metas, report }), [metas, report]);
  return <FeaturedContext.Provider value={value}>{children}</FeaturedContext.Provider>;
}

export function useLibraryFeatured(): Meta[] {
  return useContext(FeaturedContext)?.metas ?? [];
}

/** Called by a tab with the list it is displaying. Clears on unmount. */
export function useReportFeatured(metas: Meta[]): void {
  const ctx = useContext(FeaturedContext);
  const report = ctx?.report;
  useEffect(() => {
    if (!report) return;
    report(metas);
    return () => report([]);
  }, [report, metas]);
}

function sameIds(a: Meta[], b: Meta[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
  return true;
}
