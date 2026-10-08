import type { SportsPage } from "@/lib/jl/sports/pages";

export function AthletePage({ page }: { page: Extract<SportsPage, { kind: "athlete" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
