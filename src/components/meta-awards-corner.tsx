import { useLayoutEffect, useMemo, useState } from "react";
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
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [tier, setTier] = useState<CornerTier>("full");
  useLayoutEffect(() => {
    if (!node) return;
    let host: HTMLElement | null = null;
    const check = () => {
      let next = node.offsetParent as HTMLElement | null;
      while (next && next.clientWidth < 340 && next.offsetParent) {
        next = next.offsetParent as HTMLElement;
      }
      if (next !== host) {
        if (host) ro.unobserve(host);
        host = next;
        if (host) ro.observe(host);
      }
      const w = host?.clientWidth ?? 0;
      if (w > 0) setTier(w >= 820 ? "full" : w >= 520 ? "compact" : "hidden");
    };
    const ro = new ResizeObserver(check);
    ro.observe(node);
    check();
    return () => ro.disconnect();
  }, [node]);
  return { ref: setNode, tier };
}

function AnimeCorner({ name, year }: { name: string; year?: number }) {
  const { ref, tier } = useHostTier();
  useAwardPacks();
  const wins = findAnyAwardWins(name, year);
  const top = wins[0];
  const show = !!top && tier !== "hidden";
  const src = top ? awardSourceMeta(top.source) : null;
  const custom = top ? resolveAwardIcon(top.source) : null;
  const compact = tier === "compact";
  const subline = !top
    ? ""
    : top.isAOTY
    ? `${top.year} Anime of the Year`
    : `${top.year} ${top.categoryName.replace(/^Best\s+/i, "Best ")}`;
  const otherWins = wins.length - 1;
  return (
    <div
      ref={ref}
      className="harbor-awards-corner pointer-events-none absolute bottom-10 end-10 z-10 flex max-w-[38%] items-center justify-end gap-3 text-end"
      title={show ? wins.map((w) => `${awardSourceMeta(w.source).shortName} ${w.year} ${w.categoryName}`).join("\n") : undefined}
    >
      {show && top && src && (
      <>
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
      </>
      )}
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
  const top = summary[0];
  const show = !!top && tier !== "hidden";
  const won = !!top && top.wins > 0;
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
  const headline = !top
    ? ""
    : compact
      ? `Award ${won ? "Winner" : "Nominee"}`
      : `${HEADLINE_FOR[top.type] ?? "Award"} ${won ? "Winner" : "Nominee"}`;
  const laurelTint = top ? laurelColorFor(top.type) : null;
  return (
    <div
      ref={ref}
      className="harbor-awards-corner pointer-events-none absolute bottom-10 end-10 z-10 flex max-w-[38%] items-center justify-end gap-3 text-end"
      title={show ? lines.join(" · ") : undefined}
    >
      {show && top && (
      <>
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
      </>
      )}
    </div>
  );
}

function pluralizeNoun(type: string, n: number): string {
  const base = NOUN_FOR[type] ?? "Award";
  if (n === 1) return base;
  if (base.endsWith("s")) return base;
  return `${base}s`;
}

