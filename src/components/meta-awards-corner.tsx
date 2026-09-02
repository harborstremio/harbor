import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { awardSourceMeta, findAnyAwardWins, parseAwardYear } from "@/lib/anime-awards";
import { resolveAwardIcon, useAwardPacks } from "@/lib/award-icons";
import type { Meta } from "@/lib/cinemeta";
import { awardSummary, pickHeroAwards, useAwards, type AwardType } from "@/lib/providers/wikidata";
import { mergeBundledAwards } from "@/lib/awards-history";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";

const HEADLINE_FOR: Record<string, string> = {
  oscar: "Academy Award",
  emmy: "Primetime Emmy",
  bafta: "BAFTA",
  golden_globe: "Golden Globe",
  sag: "SAG Award",
  cannes: "Cannes",
  venice: "Venice",
  berlin: "Berlin",
  critics_choice: "Critics' Choice",
};

const NOUN_FOR: Record<string, string> = {
  oscar: "Oscar",
  emmy: "Emmy",
  bafta: "BAFTA",
  golden_globe: "Golden Globe",
  sag: "SAG Award",
  cannes: "Cannes Award",
  venice: "Venice Award",
  berlin: "Berlin Award",
  critics_choice: "Critics' Choice Award",
};

export function MetaAwardsCorner({ meta, imdbId }: { meta: Meta; imdbId?: string | null }) {
  const isAnime = meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:");
  if (isAnime) return <AnimeCorner name={meta.name} year={parseAwardYear(meta.releaseInfo)} />;
  return (
    <ClassicCorner
      imdbId={imdbId ?? null}
      name={meta.name}
      year={parseAwardYear(meta.releaseInfo)}
      isSeries={meta.type === "series"}
    />
  );
}

type CornerTier = "full" | "compact" | "hidden";

function useHostTier() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tier, setTier] = useState<CornerTier>("full");
  useLayoutEffect(() => {
    let host = ref.current?.offsetParent as HTMLElement | null;
    while (host && host.clientWidth < 340 && host.offsetParent) {
      host = host.offsetParent as HTMLElement;
    }
    if (!host) return;
    const check = () => {
      const w = host.clientWidth;
      setTier(w >= 820 ? "full" : w >= 520 ? "compact" : "hidden");
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  return { ref, tier };
}

function AnimeCorner({ name, year }: { name: string; year?: number }) {
  const { ref, tier } = useHostTier();
  useAwardPacks();
  const wins = findAnyAwardWins(name, year);
  if (wins.length === 0 || tier === "hidden") return null;
  const top = wins[0];
  const src = awardSourceMeta(top.source);
  const custom = resolveAwardIcon(top.source);
  const compact = tier === "compact";
  const subline = top.isAOTY
    ? `${top.year} Anime of the Year`
    : `${top.year} ${top.categoryName.replace(/^Best\s+/i, "Best ")}`;
  const otherWins = wins.length - 1;
  return (
    <div
      ref={ref}
      className="harbor-awards-corner pointer-events-none absolute bottom-10 end-10 z-10 flex max-w-[44%] items-center justify-end gap-3 text-end"
      title={wins.map((w) => `${awardSourceMeta(w.source).shortName} ${w.year} ${w.categoryName}`).join("\n")}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`truncate font-bold uppercase tracking-[0.18em] text-ink/55 ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}
        >
          {compact ? "Award Winner" : `${src.name} Winner`}
        </span>
        {!compact && <span className="truncate text-[13px] font-semibold text-ink/85">{subline}</span>}
        {!compact && otherWins > 0 && (
          <span className="truncate text-[11px] text-ink-subtle">
            +{otherWins} more award{otherWins === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <span className="shrink-0 text-accent">
        <Laurel size={compact ? 48 : 68}>
          <img
            src={custom ?? src.iconSmall}
            alt=""
            className={`object-contain ${compact ? "h-5 w-5" : "h-7 w-7"} ${!custom && top.source === "animation_kobe" ? "brightness-0 invert" : ""}`}
            draggable={false}
          />
        </Laurel>
      </span>
    </div>
  );
}

function ClassicCorner({
  imdbId,
  name,
  year,
  isSeries,
}: {
  imdbId: string | null;
  name: string;
  year?: number;
  isSeries?: boolean;
}) {
  const { ref, tier } = useHostTier();
  const live = useAwards(imdbId ?? undefined, isSeries);
  const awardsV = useBundledAwardsVersion();
  const awards = useMemo(
    () => mergeBundledAwards(live, name, year),
    [awardsV, live, name, year],
  );
  const summary = useMemo(() => pickHeroAwards(awardSummary(awards)), [awards]);
  if (summary.length === 0 || tier === "hidden") return null;
  const top = summary[0];
  const won = top.wins > 0;
  const compact = tier === "compact";
  const lines: string[] = [];
  for (const item of summary) {
    if (item.wins > 0) {
      lines.push(`${item.wins} ${pluralizeNoun(item.type, item.wins)}`);
    } else if (item.nominations > 0) {
      lines.push(
        `${item.nominations} ${pluralizeNoun(item.type, item.nominations)} ${item.nominations === 1 ? "nomination" : "nominations"}`,
      );
    }
  }
  const headline = compact
    ? `Award ${won ? "Winner" : "Nominee"}`
    : `${HEADLINE_FOR[top.type] ?? "Award"} ${won ? "Winner" : "Nominee"}`;
  const laurelTint = laurelColorFor(top.type);
  return (
    <div
      ref={ref}
      className="harbor-awards-corner pointer-events-none absolute bottom-10 end-10 z-10 flex max-w-[44%] items-center justify-end gap-3 text-end"
      title={lines.join(" · ")}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`truncate font-bold uppercase tracking-[0.18em] text-ink/55 ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}
        >
          {headline}
        </span>
        {!compact &&
          lines.slice(0, 2).map((l, i) => (
            <span key={i} className="truncate text-[13px] font-medium text-ink/85">
              {l}
            </span>
          ))}
      </div>
      <span
        className="shrink-0 text-accent"
        style={laurelTint ? { color: laurelTint } : undefined}
      >
        {won ? (
          <Laurel size={compact ? 48 : 68}>
            <AwardLogo type={top.type as AwardType} size={compact ? 18 : 24} />
          </Laurel>
        ) : (
          <span
            className={`flex items-center justify-center opacity-85 ${compact ? "h-11 w-11" : "h-16 w-16"}`}
          >
            <AwardLogo type={top.type as AwardType} size={compact ? 26 : 36} />
          </span>
        )}
      </span>
    </div>
  );
}

function pluralizeNoun(type: string, n: number): string {
  const base = NOUN_FOR[type] ?? "Award";
  if (n === 1) return base;
  if (base.endsWith("s")) return base;
  return `${base}s`;
}

