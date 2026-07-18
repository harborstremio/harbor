import { ExternalLink, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import type { AwardEntry, AwardType } from "@/lib/providers/wikidata";
import { useView } from "@/lib/view";
import { meta as cinemetaMeta, type Meta } from "@/lib/cinemeta";

const TYPE_TITLE: Record<AwardType, string> = {
  oscar: "Academy Awards",
  emmy: "Primetime Emmys",
  bafta: "BAFTA Awards",
  golden_globe: "Golden Globes",
  sag: "Screen Actors Guild Awards",
  critics_choice: "Critics' Choice Awards",
  cannes: "Cannes Film Festival",
  venice: "Venice Film Festival",
  berlin: "Berlin Film Festival",
  other: "Awards",
};

const TOOLTIP_WIDTH = 360;
const TOOLTIP_MAX_HEIGHT = 420;
const GAP = 10;

export function AwardDetailModal({
  type,
  entries,
  anchor,
  onClose,
}: {
  type: AwardType;
  entries: AwardEntry[];
  anchor: DOMRect | null;
  onClose: () => void;
}) {
  const { openMeta } = useView();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; place: "below" | "above" } | null>(
    null,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onResize = () => onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!anchor) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - anchor.bottom;
    const spaceAbove = anchor.top;
    const place: "below" | "above" =
      spaceBelow >= 220 || spaceBelow >= spaceAbove ? "below" : "above";
    const desiredHeight = Math.min(
      TOOLTIP_MAX_HEIGHT,
      place === "below" ? spaceBelow - GAP - 12 : spaceAbove - GAP - 12,
    );
    const top = place === "below" ? anchor.bottom + GAP : anchor.top - GAP - desiredHeight;
    let left = anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12));
    setPos({ top, left, place });
  }, [anchor]);

  const groups = useMemo(() => groupEntries(entries), [entries]);

  const wins = entries.filter((e) => e.result === "won").length;
  const noms = entries.filter((e) => e.result === "nominated").length;
  const tint = laurelColorFor(type);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={TYPE_TITLE[type]}
      style={{ top: pos.top, left: pos.left, width: TOOLTIP_WIDTH, maxHeight: TOOLTIP_MAX_HEIGHT }}
      className="fixed z-[135] flex flex-col overflow-hidden rounded-2xl border border-edge bg-elevated/97 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
    >
      <header className="flex items-center gap-2.5 border-b border-edge-soft px-3.5 py-2.5">
        <span className="text-ink-muted" style={tint ? { color: tint } : undefined}>
          <Laurel size={32}>
            <AwardLogo type={type} size={14} />
          </Laurel>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-[13.5px] font-semibold leading-tight text-ink">
            {TYPE_TITLE[type]}
          </h3>
          <p className="text-[10.5px] text-ink-muted">
            {wins > 0 && `${wins} ${wins === 1 ? "win" : "wins"}`}
            {wins > 0 && noms > 0 && " · "}
            {noms > 0 && `${noms} ${noms === 1 ? "nomination" : "nominations"}`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas/60 hover:text-ink"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </header>

      <ul className="flex-1 overflow-y-auto px-2 py-1.5 [scrollbar-width:thin]">
        {groups.map((g, i) => (
          <li key={`${g.workImdb ?? g.workTitle ?? g.categories[0] ?? ""}-${g.year ?? ""}-${i}`}>
            <AwardRow group={g} type={type} onOpen={openMeta} onAfter={onClose} />
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

type AwardGroup = {
  year?: number;
  workImdb?: string;
  workTitle?: string;
  awardName: string;
  result: "won" | "nominated";
  categories: string[];
};

type WorkLike = { workImdb?: string; workTitle?: string; year?: number };

function groupEntries(entries: AwardEntry[]): AwardGroup[] {
  const map = new Map<string, AwardGroup>();
  for (const e of entries) {
    const film = e.workImdb ?? (e.workTitle ? `t:${e.workTitle.toLowerCase()}` : "");
    const key = film
      ? `${e.result}|${e.year ?? ""}|${film}`
      : `c|${e.result}|${e.awardName}|${e.category ?? ""}|${e.year ?? ""}`;
    let g = map.get(key);
    if (!g) {
      g = {
        year: e.year,
        workImdb: e.workImdb,
        workTitle: e.workTitle,
        awardName: e.awardName,
        result: e.result,
        categories: [],
      };
      map.set(key, g);
    } else {
      if (e.workImdb && !g.workImdb) g.workImdb = e.workImdb;
      if (e.workTitle && !g.workTitle) g.workTitle = e.workTitle;
    }
    if (e.category && !g.categories.includes(e.category)) g.categories.push(e.category);
  }
  return [...map.values()].sort((a, b) => {
    if (a.result !== b.result) return a.result === "won" ? -1 : 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

function AwardRow({
  group,
  type,
  onOpen,
  onAfter,
}: {
  group: AwardGroup;
  type: AwardType;
  onOpen: (m: Meta) => void;
  onAfter: () => void;
}) {
  const won = group.result === "won";
  const work = useWorkMeta(group, type === "emmy");
  const poster = work?.poster ?? null;
  const tint = laurelColorFor(type);
  const title = group.workTitle ?? work?.name ?? null;
  const cats = group.categories.join(", ");

  const handleOpen = () => {
    if (!work) return;
    onOpen(work);
    onAfter();
  };

  const interactive = !!work;

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={!interactive}
      className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition-colors ${
        interactive ? "hover:bg-canvas/60" : "cursor-default"
      }`}
    >
      <span className="relative h-[48px] w-[34px] shrink-0 overflow-hidden rounded-md bg-canvas/60 ring-1 ring-edge-soft/60">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-canvas to-elevated text-ink-muted"
            style={tint ? { color: tint } : undefined}
          >
            <Laurel size={26}>
              <AwardLogo type={type} size={11} />
            </Laurel>
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          {group.year && (
            <span className="font-mono text-[10px] tabular-nums text-ink-subtle">{group.year}</span>
          )}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em] ${
              won ? "bg-accent/15 text-accent" : "bg-canvas/60 text-ink-muted"
            }`}
          >
            {won ? "Won" : "Nom"}
          </span>
        </span>
        <span className="truncate text-[12px] font-semibold text-ink">
          {title ?? (cats || group.awardName)}
        </span>
        {title && cats && <span className="truncate text-[10.5px] text-ink-muted">{cats}</span>}
      </div>

      {interactive && (
        <ExternalLink size={11} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
      )}
    </button>
  );
}

const CINEMETA = "https://v3-cinemeta.strem.io";
const workCache = new Map<string, Meta | null>();
const workInflight = new Map<string, Promise<Meta | null>>();

function workKey(entry: WorkLike): string {
  return entry.workImdb ?? `t:${(entry.workTitle ?? "").toLowerCase()}:${entry.year ?? ""}`;
}

function pickByYear(metas: Meta[], year?: number): Meta | null {
  if (!year) return null;
  let best: Meta | null = null;
  let bestDiff = Infinity;
  for (const m of metas) {
    const y = parseInt(String(m.releaseInfo ?? "").slice(0, 4), 10);
    if (Number.isNaN(y)) continue;
    const diff = Math.abs(y - year);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = m;
    }
  }
  return bestDiff === 0 ? best : null;
}

function normMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function cinemetaSearch(
  title: string,
  year: number | undefined,
  preferSeries: boolean,
): Promise<Meta | null> {
  const order = preferSeries ? (["series", "movie"] as const) : (["movie", "series"] as const);
  const want = normMatch(title);
  for (const type of order) {
    try {
      const res = await fetch(
        `${CINEMETA}/catalog/${type}/top/search=${encodeURIComponent(title)}.json`,
      );
      if (!res.ok) continue;
      const json = await res.json();
      const metas: Meta[] = json?.metas ?? [];
      if (!metas.length) continue;
      const exact = pickByYear(metas, year);
      if (exact && normMatch(exact.name) === want) return { ...exact, type };
      const byTitle = metas.find((m) => normMatch(m.name) === want);
      if (byTitle?.id) return { ...byTitle, type };
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveWork(entry: WorkLike, preferSeries: boolean): Promise<Meta | null> {
  const order = preferSeries ? (["series", "movie"] as const) : (["movie", "series"] as const);
  if (entry.workImdb) {
    for (const t of order) {
      const m = await cinemetaMeta(t, entry.workImdb);
      if (m) return m;
    }
  }
  if (entry.workTitle) {
    const m = await cinemetaSearch(entry.workTitle, entry.year, preferSeries);
    if (m) return m;
  }
  return null;
}

function useWorkMeta(entry: WorkLike, preferSeries: boolean): Meta | null {
  const key = workKey(entry) + (preferSeries ? "|s" : "");
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const [v, setV] = useState<Meta | null>(() => workCache.get(key) ?? null);
  useEffect(() => {
    if (workCache.has(key)) {
      setV(workCache.get(key) ?? null);
      return;
    }
    if (!entryRef.current.workImdb && !entryRef.current.workTitle) {
      setV(null);
      return;
    }
    let cancelled = false;
    let p = workInflight.get(key);
    if (!p) {
      p = resolveWork(entryRef.current, preferSeries);
      workInflight.set(key, p);
      void p.finally(() => workInflight.delete(key));
    }
    void p.then((m) => {
      workCache.set(key, m);
      if (!cancelled) setV(m);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return v;
}
