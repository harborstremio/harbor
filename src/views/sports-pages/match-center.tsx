import type { SportsPage } from "@/lib/jl/sports/pages";

export function MatchCenterPage({ page }: { page: Extract<SportsPage, { kind: "match-center" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
