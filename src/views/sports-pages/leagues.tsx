import type { SportsPage } from "@/lib/jl/sports/pages";

export function LeaguesPage({ page }: { page: Extract<SportsPage, { kind: "leagues" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
