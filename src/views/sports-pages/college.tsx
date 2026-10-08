import type { SportsPage } from "@/lib/jl/sports/pages";

export function CollegePage({ page }: { page: Extract<SportsPage, { kind: "college" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
