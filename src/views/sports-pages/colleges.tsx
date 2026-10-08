import type { SportsPage } from "@/lib/jl/sports/pages";

export function CollegesPage({ page }: { page: Extract<SportsPage, { kind: "colleges" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
