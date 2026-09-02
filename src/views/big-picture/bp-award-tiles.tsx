import {
  allAwardSources,
  awardSourceMeta,
  readAnimeAwardSource,
  type AwardSourceId,
} from "@/lib/anime-awards";
import { SFX } from "@/lib/sfx";
import type { AwardType } from "@/lib/providers/wikidata";
import { BpAwardSourceIcon } from "./bp-award-icon";
import { BpAwardMark } from "./bp-award-mark";
import { useBpT } from "./bp-i18n";
import { BpChipDivider } from "./bp-library-chips";
import { BpLeadTile } from "./bp-lead-tile";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";
import { bpAwardSummaries, type BpAwardSummary } from "./use-bp-discover";

const CELL = "clamp(178px, 15vw, 300px)";

const SHELL =
  "group relative flex shrink-0 flex-col justify-end overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(14px,1.2vw,26px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]";

export function BpAwardTile({
  summary,
  onOpen,
  onFocus,
}: {
  summary: BpAwardSummary;
  onOpen: (type: AwardType) => void;
  onFocus?: (tint: string) => void;
}) {
  const t = useBpT();
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-award:${summary.type}`}
      onFocus={() => onFocus?.(summary.tint)}
      onClick={() => {
        SFX.click();
        onOpen(summary.type);
      }}
      aria-label={summary.title}
      className={SHELL}
      style={{ width: CELL, aspectRatio: "5 / 4" }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(155deg, color-mix(in oklab, ${summary.tint} 24%, transparent) 0%, transparent 62%)`,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-[6%] flex h-[52%] items-center justify-center"
      >
        <BpAwardMark type={summary.type} size="clamp(74px, 6.4vw, 128px)" />
      </span>
      <span className="relative flex flex-col gap-[clamp(2px,0.35vh,5px)]">
        <span className="line-clamp-2 font-display text-[clamp(14px,2vh,26px)] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {t(summary.title)}
        </span>
        <span className="truncate text-[clamp(10px,1.32vh,15px)] font-bold uppercase tracking-[0.15em] text-ink-subtle">
          {t("{n} winners", { n: summary.wins })}
          {summary.span && (
            <>
              <span aria-hidden className="mx-[0.5em] opacity-40">
                •
              </span>
              {summary.span}
            </>
          )}
        </span>
      </span>
    </button>
  );
}

export function BpAnimeAwardTile({
  source,
  onOpen,
}: {
  source: AwardSourceId;
  onOpen: (source: AwardSourceId) => void;
}) {
  const t = useBpT();
  const meta = awardSourceMeta(source);
  const data = readAnimeAwardSource(source);
  const wins = data.categories.reduce((n, c) => n + c.winners.length, 0);
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-anime-award:${source}`}
      onClick={() => {
        SFX.click();
        onOpen(source);
      }}
      aria-label={meta.name}
      className={SHELL}
      style={{ width: CELL, aspectRatio: "5 / 4" }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-[8%] flex h-[48%] items-center justify-center px-[16%]"
      >
        <BpAwardSourceIcon source={source} className="max-h-full w-auto max-w-full" />
      </span>
      <span className="relative flex flex-col gap-[clamp(2px,0.35vh,5px)]">
        <span className="line-clamp-2 font-display text-[clamp(14px,2vh,26px)] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {meta.name}
        </span>
        <span className="truncate text-[clamp(10px,1.32vh,15px)] font-bold uppercase tracking-[0.15em] text-ink-subtle">
          {t("{n} winners", { n: wins })}
        </span>
      </span>
    </button>
  );
}

export function BpAwardsBand({
  onOpenAward,
  onOpenAnime,
  onOpenAll,
  onTint,
}: {
  onOpenAward: (type: AwardType) => void;
  onOpenAnime: (source: AwardSourceId) => void;
  onOpenAll: () => void;
  onTint?: (tint: string) => void;
}) {
  const t = useBpT();
  useBundledAwardsVersion();
  const summaries = bpAwardSummaries();
  const sources = allAwardSources();
  if (summaries.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key="awards" aria-label={t("Awards")} className="relative">
      <div
        data-bp-scroll-x
        className="flex gap-[clamp(9px,0.85vw,17px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {summaries.map((s) => (
          <BpAwardTile key={s.type} summary={s} onOpen={onOpenAward} onFocus={onTint} />
        ))}
        <span className="flex shrink-0 items-center px-[clamp(4px,0.4vw,9px)]">
          <BpChipDivider />
        </span>
        {sources.map((id) => (
          <BpAnimeAwardTile key={id} source={id} onOpen={onOpenAnime} />
        ))}
        <BpLeadTile
          label={t("Open the Oscars")}
          action={t("Awards")}
          restoreKey="bp-lead:awards"
          tint={summaries[0].tint}
          onSelect={onOpenAll}
          mark={<BpAwardMark type="oscar" size="clamp(58px, 5vw, 100px)" />}
        />
      </div>
    </section>
  );
}
