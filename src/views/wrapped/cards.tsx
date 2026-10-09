import { BarChart3, CalendarClock, Cat, Film, Flame, Sparkles, Tv } from "lucide-react";
import type { ReactNode } from "react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { TopTitle, WrappedStats } from "@/lib/wrapped/types";

function Card({ children, tint }: { children: ReactNode; tint?: boolean }) {
  return (
    <div
      className={`animate-fade-in rounded-3xl border border-edge-soft/60 p-7 ${
        tint ? "bg-gradient-to-br from-accent/15 via-elevated/50 to-elevated/30" : "bg-elevated/45"
      }`}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-subtle">{children}</p>
  );
}

export function HeroCard({ stats }: { stats: WrappedStats }) {
  const t = useT();
  return (
    <Card tint>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Stat big value={stats.estimatedHours.toLocaleString()} unit={t("hours watched")} />
        <Stat value={stats.totalTitles.toLocaleString()} unit={t("titles")} />
        <Stat value={stats.totalPlays.toLocaleString()} unit={t("plays")} />
      </div>
      {stats.source === "local" && (
        <p className="mt-4 text-[12px] text-ink-subtle">
          {t("Estimated from your local history. Connect Trakt or Simkl for the full picture.")}
        </p>
      )}
    </Card>
  );
}

function Stat({ value, unit, big }: { value: string; unit: string; big?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`font-display font-medium tracking-tight text-ink ${big ? "text-[64px] leading-none" : "text-[40px] leading-none"}`}>
        {value}
      </span>
      <span className="mt-1 text-[13px] text-ink-muted">{unit}</span>
    </div>
  );
}

export function SplitCard({ stats }: { stats: WrappedStats }) {
  const t = useT();
  const { movies, series, anime } = stats.split;
  const total = movies + series + anime || 1;
  const rows = [
    { icon: Film, label: t("Movies"), n: movies, cls: "bg-sky-400" },
    { icon: Tv, label: t("Series"), n: series, cls: "bg-violet-400" },
    { icon: Cat, label: t("Anime"), n: anime, cls: "bg-emerald-400" },
  ];
  return (
    <Card>
      <Label>{t("What you watched")}</Label>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <r.icon size={18} className="shrink-0 text-ink-muted" />
            <span className="w-16 text-[13.5px] text-ink-muted">{r.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas/70">
              <div className={`h-full rounded-full ${r.cls}`} style={{ width: `${(r.n / total) * 100}%` }} />
            </div>
            <span className="w-10 text-end text-[13px] font-semibold tabular-nums text-ink">{r.n}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TopTitlesCard({ stats, onOpen }: { stats: WrappedStats; onOpen: (tt: TopTitle) => void }) {
  const t = useT();
  if (stats.topTitles.length === 0) return null;
  return (
    <Card>
      <Label>{t("Top titles")}</Label>
      <div className="flex flex-col gap-1">
        {stats.topTitles.slice(0, 10).map((tt, i) => (
          <button
            key={tt.id}
            type="button"
            onClick={() => onOpen(tt)}
            className="group/row flex items-center gap-3 rounded-xl px-2 py-1.5 text-start transition-colors hover:bg-canvas/50 active:scale-[0.99] motion-reduce:active:scale-100"
          >
            <span className="w-5 shrink-0 text-end font-display text-[15px] text-ink-subtle">{i + 1}</span>
            <div className="w-9 shrink-0 overflow-hidden rounded-md">
              <Poster src={stats.posters[tt.id]} seed={tt.id} ratio="portrait" />
            </div>
            <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink transition-colors group-hover/row:text-accent">
              {tt.title}
            </span>
            <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-muted">
              {tt.count}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function ActorsCard({ stats }: { stats: WrappedStats }) {
  const t = useT();
  if (stats.topActors.length === 0) return null;
  return (
    <Card>
      <Label>{t("People you watch")}</Label>
      <div className="grid grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
        {stats.topActors.map((a) => (
          <div key={a.name} className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-canvas/70 font-display text-[13.5px] text-ink-subtle ring-1 ring-edge-soft">
              {a.photo ? (
                <img src={a.photo} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                initials(a.name)
              )}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-medium text-ink">{a.name}</span>
              <span className="text-[12px] text-ink-muted">{t("{n} titles", { n: a.count })}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function HighlightsCard({ stats }: { stats: WrappedStats }) {
  const t = useT();
  const rows: Array<{ icon: typeof Sparkles; title: string; body: string }> = [];
  if (stats.archetype.label) {
    rows.push({ icon: Sparkles, title: stats.archetype.label, body: stats.archetype.blurb });
  }
  if (stats.longestBinge.count > 1) {
    rows.push({
      icon: Flame,
      title: t("Longest binge"),
      body: `${t("{n} in a day", { n: stats.longestBinge.count })} · ${prettyDate(stats.longestBinge.date)}`,
    });
  }
  if (stats.firstPlay) {
    rows.push({ icon: CalendarClock, title: t("Where it started"), body: stats.firstPlay.title });
  }
  if (rows.length === 0) return null;
  return (
    <Card tint>
      <Label>{t("Highlights")}</Label>
      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.title} className="flex items-start gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas/60 text-accent ring-1 ring-edge-soft">
              <r.icon size={17} strokeWidth={2} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-ink">{r.title}</span>
              <span className="text-[12.5px] leading-relaxed text-ink-muted">{r.body}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function GenresCard({ stats }: { stats: WrappedStats }) {
  const t = useT();
  if (stats.topGenres.length === 0) return null;
  const max = stats.topGenres[0].count || 1;
  return (
    <Card>
      <Label>{t("Top genres")}</Label>
      <div className="flex flex-col gap-2.5">
        {stats.topGenres.map((g) => (
          <div key={g.genre} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-[13.5px] text-ink">{g.genre}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas/70">
              <div className="h-full rounded-full bg-accent/80" style={{ width: `${(g.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function heatColor(count: number, max: number): string {
  if (count === 0) return "bg-canvas/50";
  const r = count / (max || 1);
  if (r > 0.75) return "bg-accent";
  if (r > 0.5) return "bg-accent/70";
  if (r > 0.25) return "bg-accent/45";
  return "bg-accent/25";
}

export function HeatmapCard({ stats }: { stats: WrappedStats }) {
  const t = useT();
  if (stats.heatmap.length === 0) return null;
  const map = new Map(stats.heatmap.map((c) => [c.date, c.count]));
  const max = Math.max(...stats.heatmap.map((c) => c.count));
  const end = new Date();
  const cells: Array<{ key: string; count: number }> = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ key, count: map.get(key) ?? 0 });
  }
  const weeks: Array<Array<{ key: string; count: number }>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <Card>
      <Label>{t("Your watch year")}</Label>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((c) => (
              <div key={c.key} title={`${c.key}: ${c.count}`} className={`h-2.5 w-2.5 rounded-[3px] ${heatColor(c.count, max)}`} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function WrappedEmpty() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-20 text-center">
      <BarChart3 size={26} className="text-ink-subtle" />
      <h2 className="font-display text-[22px] font-medium text-ink">{t("Nothing to show yet")}</h2>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
        {t("Connect Trakt or Simkl, or start watching, and your stats will build themselves.")}
      </p>
    </div>
  );
}
