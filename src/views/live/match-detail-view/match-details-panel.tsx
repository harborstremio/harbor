import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { MatchDisclosure } from "@/views/sports/match-disclosure";
import { SportsSelect } from "@/views/sports/sports-select";

const LABELS: Record<string, string> = {
  match: "Match",
  summary: "Summary",
  profile: "Athlete profile",
  lineups: "Lineups",
  stats: "Stats",
};

export function MatchDetailsPanel({
  tabs,
  selected,
  onChange,
  children,
}: {
  tabs: string[];
  selected: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const t = useT();
  // Soccer and tennis already have their own disclosure sections.
  if (tabs.length < 2) return <>{children}</>;
  return (
    <MatchDisclosure title={t("Match details")} icon={BarChart3} scroll={false}>
      <SportsSelect
        ariaLabel={t("Match details")}
        value={selected}
        onChange={onChange}
        options={tabs.map((id) => ({ value: id, label: t(LABELS[id]) }))}
      />
      {children}
    </MatchDisclosure>
  );
}
