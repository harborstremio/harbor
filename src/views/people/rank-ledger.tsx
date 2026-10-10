import { Award } from "lucide-react";
import { useEffect, useState } from "react";
import { usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import type { Meta } from "@/lib/cinemeta";
import {
  HARBOR_RANK_WEIGHTS,
  type HarborRankExplanation,
  type ScoreComponents,
  type TopTitle,
} from "@/lib/harbor-rank";
import { titleToMeta } from "./people-utils";

type PillarKey = keyof ScoreComponents;

const PILLAR_LABEL: Record<PillarKey, string> = {
  quality: "Quality",
  acclaim: "Acclaim",
  awards: "Awards",
  roles: "Roles",
};

const PILLARS: Array<{ key: PillarKey; shade: string }> = [
  { key: "quality", shade: "bg-ink/70" },
  { key: "acclaim", shade: "bg-ink/45" },
  { key: "awards", shade: "bg-ink/28" },
  { key: "roles", shade: "bg-ink/15" },
];

function weightPct(key: PillarKey): number {
  return Math.round(HARBOR_RANK_WEIGHTS[key] * 100);
}

function segWidths(c: ScoreComponents): Record<PillarKey, number> {
  const raw: Record<PillarKey, number> = {
    quality: Math.max(0, c.quality) * HARBOR_RANK_WEIGHTS.quality,
    acclaim: Math.max(0, c.acclaim) * HARBOR_RANK_WEIGHTS.acclaim,
    awards: Math.max(0, c.awards) * HARBOR_RANK_WEIGHTS.awards,
    roles: Math.max(0, c.roles) * HARBOR_RANK_WEIGHTS.roles,
  };
  const total = raw.quality + raw.acclaim + raw.awards + raw.roles || 1;
  return {
    quality: (raw.quality / total) * 100,
    acclaim: (raw.acclaim / total) * 100,
    awards: (raw.awards / total) * 100,
    roles: (raw.roles / total) * 100,
  };
}

function compactVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function RankLedger({
  person,
  mode,
  onOpenMeta,
}: {
  person: HarborRankExplanation;
  mode: "micro" | "full";
  onOpenMeta: (meta: Meta) => void;
}) {
  if (mode === "micro") return <MicroLedger person={person} />;
  return <FullLedger person={person} onOpenMeta={onOpenMeta} />;
}

function MicroLedger({ person }: { person: HarborRankExplanation }) {
  const w = segWidths(person.components);
  return (
    <div
      aria-hidden
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft"
    >
      {PILLARS.map((p) => {
        const hollow = p.key === "awards" && person.awardsDataMissing;
        return (
          <span
            key={p.key}
            style={{ width: `${w[p.key]}%` }}
            className={`h-full ${hollow ? "ring-1 ring-inset ring-edge-soft" : p.shade}`}
          />
        );
      })}
    </div>
  );
}

function FullLedger({
  person,
  onOpenMeta,
}: {
  person: HarborRankExplanation;
  onOpenMeta: (meta: Meta) => void;
}) {
  const t = useT();
  const w = segWidths(person.components);
  const [inspect, setInspect] = useState<PillarKey | null>(null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3.5 w-full overflow-hidden rounded-lg bg-canvas ring-1 ring-edge-soft">
        {PILLARS.map((p, i) => {
          const hollow = p.key === "awards" && person.awardsDataMissing;
          const active = inspect === p.key;
          return (
            <button
              key={p.key}
              type="button"
              aria-label={t(PILLAR_LABEL[p.key])}
              onMouseEnter={() => setInspect(p.key)}
              onMouseLeave={() => setInspect(null)}
              onFocus={() => setInspect(p.key)}
              onBlur={() => setInspect(null)}
              style={{ width: grown ? `${w[p.key]}%` : "0%", transitionDelay: `${i * 30}ms` }}
              className="group/seg relative h-full shrink-0 outline-none transition-[width] duration-400 ease-out motion-reduce:transition-none"
            >
              <span
                className={`block h-full w-full transition-colors duration-150 motion-reduce:transition-none group-focus-visible/seg:ring-2 group-focus-visible/seg:ring-inset group-focus-visible/seg:ring-accent ${
                  active ? "bg-accent" : hollow ? "ring-1 ring-inset ring-edge-soft" : p.shade
                }`}
              />
            </button>
          );
        })}
      </div>

      <p className="min-h-[16px] text-[12px] text-ink-subtle" aria-live="polite">
        {inspect
          ? t("{label} · {pct}% of the final score", {
              label: t(PILLAR_LABEL[inspect]),
              pct: String(weightPct(inspect)),
            })
          : t("Hover a band to inspect a pillar")}
      </p>

      <ReadoutRows person={person} />

      <p className="text-[12.5px] text-ink-muted tabular-nums">
        {person.score === null
          ? t("Not enough rated work yet")
          : t("× breadth/recency {mod} = {score}", {
              mod: person.modifier.toFixed(2),
              score: String(Math.round(person.score)),
            })}
      </p>

      {person.topTitles.length > 0 && (
        <ProofTitles titles={person.topTitles} onOpenMeta={onOpenMeta} />
      )}
    </div>
  );
}

function ReadoutRows({ person }: { person: HarborRankExplanation }) {
  const t = useT();
  const c = person.components;
  const rows: Array<{ key: PillarKey; value: number; sub: string }> = [
    {
      key: "quality",
      value: c.quality,
      sub:
        person.avgRating === null
          ? t("no rated titles yet")
          : t("avg rating {r} across {n} titles", {
              r: person.avgRating.toFixed(1),
              n: String(person.ratedTitles),
            }),
    },
    {
      key: "acclaim",
      value: c.acclaim,
      sub: t("{a} titles over 8.0, {b} over 9.0", {
        a: String(person.acclaimedCount8),
        b: String(person.acclaimedCount9),
      }),
    },
    {
      key: "awards",
      value: c.awards,
      sub: person.awardsDataMissing
        ? t("Awards data unavailable")
        : t("{w} wins, {n} nominations", {
            w: String(person.majorAwardWins),
            n: String(person.majorAwardNoms),
          }),
    },
    {
      key: "roles",
      value: c.roles,
      sub: t("lead or co-lead of {n} acclaimed titles", { n: String(person.leadRoles) }),
    },
  ];

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-ink">{t(PILLAR_LABEL[r.key])}</span>
            <span className="text-[12px] text-ink-subtle tabular-nums">
              {t("{v} · weight {p}%", {
                v: String(Math.round(r.value * 100)),
                p: String(weightPct(r.key)),
              })}
            </span>
          </span>
          <span className="text-end text-[11.5px] text-ink-muted tabular-nums">{r.sub}</span>
        </li>
      ))}
    </ul>
  );
}

function ProofTitles({
  titles,
  onOpenMeta,
}: {
  titles: TopTitle[];
  onOpenMeta: (meta: Meta) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("What it leaned on")}
      </p>
      <ul className="flex flex-col gap-1">
        {titles.map((title, i) => (
          <ProofRow
            key={title.metaId}
            title={title}
            index={i}
            onOpen={() => onOpenMeta(titleToMeta(title))}
          />
        ))}
      </ul>
    </div>
  );
}

function ProofRow({
  title,
  index,
  onOpen,
}: {
  title: TopTitle;
  index: number;
  onOpen: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const meta = titleToMeta(title);
  const raw = title.posterPath ? `https://image.tmdb.org/t/p/w92${title.posterPath}` : undefined;
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    raw,
    meta.type === "series" ? "series" : "movie",
  );

  return (
    <li
      style={{ animationDelay: `${index * 30}ms` }}
      className="animate-in fade-in slide-in-from-top-1 duration-250 motion-reduce:animate-none"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("Open {title}", { title: title.title })}
        className="group/proof -mx-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-start outline-none transition-colors ease-out hover:bg-elevated/50 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
      >
        <span className="h-11 w-[30px] shrink-0 overflow-hidden rounded-md bg-canvas ring-1 ring-edge-soft">
          {poster.src ? (
            <img
              src={poster.src}
              alt=""
              loading="lazy"
              onError={poster.onError}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="block h-full w-full bg-gradient-to-br from-canvas to-elevated" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{title.title}</span>
            {title.year !== null && (
              <span className="shrink-0 text-[11.5px] text-ink-subtle tabular-nums">
                {title.year}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 text-[11px] text-ink-subtle">
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-muted">
              {title.role}
            </span>
            {title.rating !== null && (
              <span className="tabular-nums">
                {title.rating.toFixed(1)}
                {title.votes !== null && ` · ${compactVotes(title.votes)}`}
              </span>
            )}
            {title.awardWinner && (
              <span className="inline-flex items-center gap-1 text-ink-subtle">
                <Award size={12} strokeWidth={2} />
                {t("Award winner")}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
