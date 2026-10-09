import type { MMAFighterProfile } from "@/lib/sports/espn-types";
import { useBpT } from "../bp-i18n";
import { useBpSportsWhoBio, type BpSportsWhoStat } from "./bp-sports-who-data";
import type { BpSportsWhoView } from "./bp-sports-who-parts";
import type { BpSportsWhoAthleteSubject } from "./bp-sports-who-subject";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function shapeFacts(
  profile: MMAFighterProfile | undefined,
  t: Translate,
): { label: string; value: string }[] {
  if (profile === undefined) return [];
  return (
    [
      [t("Height"), profile.height],
      [t("Weight"), profile.weight],
      [t("Reach"), profile.reach],
      [t("Stance"), profile.stance],
      [t("Age"), profile.age],
    ] as const
  )
    .filter(([, value]) => value !== "")
    .map(([label, value]) => ({ label, value }));
}

export function useBpSportsWhoAthleteView(
  subject: BpSportsWhoAthleteSubject | null,
): BpSportsWhoView {
  const t = useBpT();
  const person = subject?.person ?? null;
  const { data, loading, failed } = useBpSportsWhoBio(person);
  const figures: BpSportsWhoStat[] = (data?.summary ?? []).map((stat) => ({
    name: t(stat.name),
    value: stat.value,
  }));
  const facts = shapeFacts(person?.profile, t);
  const database = person?.source === "thesportsdb";
  const record = data?.recordUrl ?? "";
  const bare = data === null && facts.length === 0;
  const full = person?.profile?.fullImage ?? "";

  return {
    eyebrow: t("Athlete profile"),
    lead: [data?.team?.name ?? "", ...(data?.bio ?? [])].filter((part) => part !== "").join(" · "),
    figures,
    facts,
    body: "",
    note: failed
      ? t("Statistics could not be loaded. Please try again.")
      : bare
        ? t("Profile details could not be loaded.")
        : figures.length === 0
          ? t("Detailed statistics are not provided for this athlete yet.")
          : database
            ? t("Athlete information supplied by TheSportsDB. Statistics may not be available.")
            : t(
                "Statistics supplied by ESPN. Historical coverage varies by athlete and competition.",
              ),
    link:
      record === ""
        ? null
        : {
            label: database ? t("View profile on TheSportsDB") : t("View full record on ESPN"),
            url: record,
          },
    loading,
    art: full || data?.image || subject?.art || "",
    fit: full === "" ? "object-cover object-top" : "object-contain object-bottom",
    extra: null,
  };
}
