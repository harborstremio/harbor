import type { SportsPage } from "@/lib/jl/sports/pages";

export function StudentPage({ page }: { page: Extract<SportsPage, { kind: "student" }> }) {
  return <div className="p-10 text-ink-muted">{page.kind}</div>;
}
