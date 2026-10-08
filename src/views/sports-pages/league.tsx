import type { SportsPage } from "@/lib/jl/sports/pages";

export function LeaguePage({ page }: { page: Extract<SportsPage, { kind: "league" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
