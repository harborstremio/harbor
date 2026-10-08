import type { SportsPage } from "@/lib/jl/sports/pages";

export function TeamPage({ page }: { page: Extract<SportsPage, { kind: "team" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
