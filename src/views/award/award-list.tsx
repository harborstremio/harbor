import { ArrowUpRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { readAwardHistory, type CategoryHistory } from "@/lib/awards-history";
import { tmdbPersonIdByName } from "@/lib/providers/tmdb";
import type { AwardType } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function AwardList({ awardType, tint }: { awardType: AwardType; tint: string }) {
  const t = useT();
  const meta = AWARD_CATALOG[awardType];
  const history = useMemo(
    () => readAwardHistory(awardType, meta.categories),
    [awardType, meta.categories],
  );
  const [decade, setDecade] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setDecade(null);
    setQuery("");
  }, [awardType]);

  const decades = useMemo(() => {
    const set = new Set<number>();
    for (const g of history) for (const e of g.entries) set.add(Math.floor(e.year / 10) * 10);
    return [...set].sort((a, b) => b - a);
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history
      .map((group) => ({
        ...group,
        entries: group.entries.filter((e) => {
          if (decade !== null && (e.year < decade || e.year >= decade + 10)) return false;
          if (q) {
            const matches =
              e.workTitle.toLowerCase().includes(q) ||
              e.recipients.some((r) => r.toLowerCase().includes(q));
            if (!matches) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.entries.length > 0);
  }, [history, decade, query]);

  const filtered = decade !== null || query.trim().length > 0;
  const noResults = filtered && filteredHistory.length === 0;

  if (history.length === 0) {
    return (
      <p className="rounded-2xl border border-edge-soft bg-elevated/30 p-6 text-[14px] leading-relaxed text-ink-muted">
        {t("No winners are catalogued for this award yet.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-14">
      <FilterBar
        decade={decade}
        decades={decades}
        onDecade={setDecade}
        query={query}
        onQuery={setQuery}
        tint={tint}
      />

      {noResults && (
        <p className="rounded-2xl border border-edge-soft bg-elevated/30 p-5 text-[13.5px] text-ink-muted">
          {t("No winners match these filters.")}{" "}
          <button
            type="button"
            onClick={() => {
              setDecade(null);
              setQuery("");
            }}
            className="text-ink underline-offset-4 hover:underline"
          >
            {t("Clear filters")}
          </button>
          .
        </p>
      )}

      {filteredHistory.map((group) => (
        <CategorySection key={group.category.key} group={group} tint={tint} />
      ))}
    </div>
  );
}

function FilterBar({
  decade,
  decades,
  onDecade,
  query,
  onQuery,
  tint,
}: {
  decade: number | null;
  decades: number[];
  onDecade: (d: number | null) => void;
  query: string;
  onQuery: (q: string) => void;
  tint: string;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-5">
      <div className="flex items-center gap-3">
        <Search size={15} strokeWidth={2} className="shrink-0 text-ink-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("Search by recipient or title…")}
          className="flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-ink-subtle/65 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label={t("Clear search")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <DecadePill
          active={decade === null}
          label={t("All years")}
          onClick={() => onDecade(null)}
          tint={tint}
        />
        {decades.map((d) => (
          <DecadePill
            key={d}
            active={decade === d}
            label={`${d}s`}
            onClick={() => onDecade(d)}
            tint={tint}
          />
        ))}
      </div>
    </section>
  );
}

function DecadePill({
  active,
  label,
  onClick,
  tint,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold tabular-nums transition-colors ${
        active ? "text-canvas" : "text-ink-muted hover:bg-canvas/60 hover:text-ink"
      }`}
      style={active ? { backgroundColor: tint } : undefined}
    >
      {label}
    </button>
  );
}

function CategorySection({ group, tint }: { group: CategoryHistory; tint: string }) {
  const t = useT();
  const preferTv = TV_CATEGORY_RX.test(group.category.name);
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">
          {group.category.name}
        </h2>
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {group.entries.length === 1
            ? t("{n} year", { n: group.entries.length })
            : t("{n} years", { n: group.entries.length })}
        </span>
      </div>
      <ol className="flex flex-col">
        {group.entries.map((e, i) => (
          <WinnerRow
            key={`${e.year}-${e.workTitle}-${i}`}
            entry={e}
            tint={tint}
            preferTv={preferTv}
          />
        ))}
      </ol>
    </section>
  );
}

function WinnerRow({
  entry,
  tint,
  preferTv,
}: {
  entry: CategoryHistory["entries"][number];
  tint: string;
  preferTv: boolean;
}) {
  const { settings } = useSettings();
  const { openMeta, openPerson } = useView();
  const [resolving, setResolving] = useState(false);

  const onWorkClick = async () => {
    if (resolving || !settings.tmdbKey) return;
    setResolving(true);
    try {
      const hit = await resolveAwardWork(settings.tmdbKey, entry.workTitle, entry.year, preferTv);
      if (hit) {
        openMeta({
          id: `tmdb:${hit.type}:${hit.id}`,
          type: hit.type === "movie" ? "movie" : "series",
          name: entry.workTitle,
        });
      }
    } finally {
      setResolving(false);
    }
  };

  const onRecipientClick = async (name: string) => {
    if (resolving) return;
    setResolving(true);
    const id = await tmdbPersonIdByName(settings.tmdbKey, name);
    setResolving(false);
    if (id) openPerson(id);
  };

  const workClickable = !!settings.tmdbKey;

  return (
    <li className="grid grid-cols-[80px_1fr_auto] items-baseline gap-x-6 border-b border-edge-soft/55 py-4">
      <span className="font-mono text-[15px] font-semibold tabular-nums" style={{ color: tint }}>
        {entry.year}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        {workClickable ? (
          <button
            type="button"
            onClick={onWorkClick}
            className="self-start text-start text-[16px] font-medium leading-tight text-ink transition-colors hover:text-accent"
          >
            {entry.workTitle}
          </button>
        ) : (
          <span className="text-[16px] font-medium leading-tight text-ink">{entry.workTitle}</span>
        )}
        {entry.recipients.length > 0 && (
          <span className="self-start text-[13px] leading-tight text-ink-muted">
            {entry.recipients.map((r, i) => (
              <span key={`${r}-${i}`}>
                {i > 0 && <span className="text-ink-subtle">, </span>}
                {settings.tmdbKey ? (
                  <button
                    type="button"
                    onClick={() => onRecipientClick(r)}
                    disabled={resolving}
                    className="text-start transition-colors hover:text-ink disabled:cursor-default disabled:hover:text-ink-muted"
                  >
                    {r}
                  </button>
                ) : (
                  <span>{r}</span>
                )}
              </span>
            ))}
          </span>
        )}
      </div>
      {workClickable && (
        <ArrowUpRight size={14} className="dir-icon text-ink-subtle" strokeWidth={2.2} />
      )}
    </li>
  );
}

const TV_CATEGORY_RX =
  /series|television|\btv\b|daytime|talk|host|reality|variety|game show|soap|drama series|comedy series|limited series|miniseries|anthology/i;

type AwardHit = { id: number; type: "movie" | "tv" };

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function tmdbYear(date?: string): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

async function searchType(
  key: string,
  title: string,
  type: "movie" | "tv",
): Promise<Array<{ id: number; title: string; year: number | null }>> {
  const params = new URLSearchParams({ api_key: key, query: title, include_adult: "false" });
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`);
    if (!res.ok) return [];
    const data: { results?: Array<Record<string, unknown>> } = await res.json();
    return (data.results ?? [])
      .slice(0, 6)
      .map((r) => ({
        id: Number(r.id),
        title: String(
          type === "movie"
            ? (r.title ?? r.original_title ?? "")
            : (r.name ?? r.original_name ?? ""),
        ),
        year: tmdbYear(
          ((type === "movie" ? r.release_date : r.first_air_date) as string) || undefined,
        ),
      }))
      .filter((r) => Number.isFinite(r.id) && r.id > 0);
  } catch {
    return [];
  }
}

async function resolveAwardWork(
  key: string,
  title: string,
  year: number,
  preferTv: boolean,
): Promise<AwardHit | null> {
  const [movies, tvs] = await Promise.all([
    searchType(key, title, "movie"),
    searchType(key, title, "tv"),
  ]);
  const want = normTitle(title);
  const candidates = [
    ...tvs.map((r) => ({ ...r, type: "tv" as const })),
    ...movies.map((r) => ({ ...r, type: "movie" as const })),
  ];
  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const nt = normTitle(c.title);
    if (!nt) continue;
    let score = 0;
    if (nt === want) score += 100;
    else if (nt.includes(want) || want.includes(nt)) score += 45;
    else continue;
    if (c.year != null) score += Math.max(0, 18 - Math.abs(c.year - year) * 3);
    if (preferTv ? c.type === "tv" : c.type === "movie") score += 25;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best ? { id: best.id, type: best.type } : null;
}
