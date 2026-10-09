import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import type { AwardEntry, AwardType } from "@/lib/providers/wikidata";
import { useT } from "@/lib/i18n";
import { SectionTitle } from "./ui";

const AWARD_TITLE: Record<AwardType, string> = {
  oscar: "Academy Awards",
  emmy: "Primetime Emmys",
  golden_globe: "Golden Globes",
  bafta: "BAFTA Awards",
  bafta_tv: "BAFTA TV Awards",
  sag: "Screen Actors Guild",
  critics_choice: "Critics' Choice",
  cannes: "Cannes Film Festival",
  venice: "Venice Film Festival",
  berlin: "Berlin Film Festival",
  annie: "Annie Awards",
  spirit: "Independent Spirit",
  saturn: "Saturn Awards",
  cesar: "Cesar Awards",
  goya: "Goya Awards",
  blue_dragon: "Blue Dragon Awards",
  baeksang: "Baeksang Arts Awards",
  bifa: "British Independent Film",
  other: "Other Awards",
};

export function AwardsSection({
  groups,
  awards,
}: {
  groups: { type: AwardType; wins: number; nominations: number }[];
  awards: AwardEntry[];
}) {
  const t = useT();
  return (
    <section id="awards-section" className="flex scroll-mt-4 flex-col gap-4">
      <SectionTitle>{t("Awards")}</SectionTitle>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <AwardGroup
            key={g.type}
            type={g.type}
            wins={g.wins}
            noms={g.nominations}
            entries={awards.filter((a) => a.type === g.type)}
          />
        ))}
      </div>
    </section>
  );
}

function AwardGroup({
  type,
  wins,
  noms,
  entries,
}: {
  type: AwardType;
  wins: number;
  noms: number;
  entries: AwardEntry[];
}) {
  const t = useT();
  const awardTitle = t(AWARD_TITLE[type]);
  const tint = laurelColorFor(type);
  const byYear = (a: AwardEntry, b: AwardEntry) => (b.year ?? 0) - (a.year ?? 0);
  const detailed = entries.filter((e) => e.category);
  const wonRows = detailed.filter((e) => e.result === "won").sort(byYear);
  const nomRows = detailed.filter((e) => e.result === "nominated").sort(byYear);
  const rows = [...wonRows, ...nomRows].slice(0, 8);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface/60 p-4 ring-1 ring-edge-soft/60">
      <header className="flex items-center gap-3">
        <span className="shrink-0" style={{ color: tint }}>
          {wins > 0 ? (
            <Laurel size={46}>
              <AwardLogo type={type} size={17} />
            </Laurel>
          ) : (
            <span className="flex h-11 w-11 items-center justify-center opacity-80">
              <AwardLogo type={type} size={26} />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[15px] font-medium tracking-tight text-ink">{awardTitle}</h3>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {wins > 0 && (
              <>
                <span className="text-accent">{wins}</span> {wins === 1 ? t("Win") : t("Wins")}
              </>
            )}
            {wins > 0 && noms > 0 && <span className="mx-1.5 opacity-40">·</span>}
            {noms > 0 && (
              <>
                {noms} {noms === 1 ? t("Nomination") : t("Nominations")}
              </>
            )}
          </p>
        </div>
      </header>
      {rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map((e, i) => (
            <AwardEntryRow key={`${e.year ?? ""}-${e.category ?? ""}-${i}`} entry={e} />
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t("Recognized at the {award}.", { award: awardTitle.toLocaleLowerCase() })}
        </p>
      )}
    </div>
  );
}

function AwardEntryRow({ entry }: { entry: AwardEntry }) {
  const t = useT();
  const won = entry.result === "won";
  const recipients = entry.recipients ?? (entry.recipient ? [entry.recipient] : []);
  return (
    <li className="flex items-baseline gap-3 border-t border-edge-soft/30 py-2 text-[12.5px] first:border-t-0">
      <span
        className={`w-9 shrink-0 font-semibold tabular-nums ${won ? "text-accent" : "text-ink-subtle"}`}
      >
        {entry.year ?? "-"}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="leading-tight text-ink">{entry.category}</span>
        {recipients.length > 0 && (
          <span className="text-[11.5px] leading-tight text-ink-subtle">
            {recipients.join(", ")}
          </span>
        )}
      </div>
      {!won && (
        <span className="shrink-0 rounded-full bg-elevated/70 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("Nom")}
        </span>
      )}
    </li>
  );
}
