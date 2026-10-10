import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import type { PersonAward } from "@/lib/harbor-rank";
import { useT } from "@/lib/i18n";

const AWARD_NOUN: Record<string, string> = {
  oscar: "Oscar",
  emmy: "Emmy",
  golden_globe: "Globe",
  bafta: "BAFTA",
  bafta_tv: "BAFTA",
  sag: "SAG",
  critics_choice: "Critics",
  cannes: "Cannes",
  venice: "Venice",
  berlin: "Berlin",
  annie: "Annie",
  spirit: "Spirit",
  saturn: "Saturn",
  cesar: "Cesar",
  goya: "Goya",
  blue_dragon: "Blue Dragon",
  baeksang: "Baeksang",
  bifa: "BIFA",
};

export function PersonMedals({
  wins,
  noms,
  missing,
  variant,
  awards,
}: {
  wins: number;
  noms: number;
  missing: boolean;
  variant: "expanded" | "count";
  awards?: PersonAward[];
}) {
  const t = useT();
  if (missing) return null;

  const iconsOnly = variant === "count";
  const bodies = awards?.filter((a) => a.wins > 0) ?? [];

  if (bodies.length > 0) {
    const lead = bodies.slice(0, iconsOnly ? 4 : 5);
    const overflow = bodies.length - lead.length;
    return (
      <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${iconsOnly ? "justify-end" : ""}`}>
        {lead.map((a) => {
          const color = laurelColorFor(a.type);
          const noun = AWARD_NOUN[a.type] ?? a.type;
          return (
            <span
              key={a.type}
              title={t("{n} {award} wins", { n: String(a.wins), award: noun })}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-semibold tabular-nums"
              style={{ color }}
            >
              <AwardLogo type={a.type} size={iconsOnly ? 18 : 14} />
              {iconsOnly ? (
                a.wins > 1 ? <span className="text-[10.5px] leading-none">{a.wins}</span> : null
              ) : (
                <span>{`${noun} ${a.wins}`}</span>
              )}
            </span>
          );
        })}
        {overflow > 0 && (
          <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-ink-subtle">+{overflow}</span>
        )}
        {variant === "expanded" && noms > 0 && (
          <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-ink-subtle">
            {t("{noms} noms", { noms: String(noms) })}
          </span>
        )}
      </div>
    );
  }

  if (wins > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-accent"
        title={t("{wins} major award wins, {noms} nominations", { wins: String(wins), noms: String(noms) })}
      >
        <AwardLogo type="oscar" size={14} />
        {variant === "expanded" ? t("{wins} wins", { wins: String(wins) }) : wins}
      </span>
    );
  }

  if (noms > 0) {
    return (
      <span className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-subtle">
        {t("{noms} noms", { noms: String(noms) })}
      </span>
    );
  }

  return null;
}
