import { ArrowDownToLine, Flame, Sparkles, Star, TrendingUp, type LucideIcon } from "lucide-react";
import { t, useT } from "@/lib/i18n";
import { SectionHeader } from "@/views/profile/section-header";
import { ThemeAuthorButton } from "../theme-author-button";
import type { StoreTheme } from "@/lib/theme-store";
import { fmtCount } from "./format";

type ChartKind = "rating" | "downloads" | "fresh";

function relTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";
  const d = Math.max(0, Date.now() - parsed);
  const day = 86_400_000;
  if (d < day) return t("today");
  if (d < 7 * day) return t("{count}d", { count: Math.floor(d / day) });
  if (d < 30 * day) return t("{count}w", { count: Math.floor(d / (7 * day)) });
  return t("{count}mo", { count: Math.floor(d / (30 * day)) });
}

export function StoreTopCharts({
  trending,
  popular,
  fresh,
  onOpen,
}: {
  trending: StoreTheme[];
  popular: StoreTheme[];
  fresh: StoreTheme[];
  onOpen: (t: StoreTheme) => void;
}) {
  const tr = useT();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartColumn
        title={tr("Trending")}
        Icon={TrendingUp}
        kind="rating"
        themes={trending}
        onOpen={onOpen}
      />
      <ChartColumn
        title={tr("Most popular")}
        Icon={Flame}
        kind="downloads"
        themes={popular}
        onOpen={onOpen}
      />
      <ChartColumn
        title={tr("New & notable")}
        Icon={Sparkles}
        kind="fresh"
        themes={fresh}
        onOpen={onOpen}
      />
    </div>
  );
}

function ChartColumn({
  title,
  Icon,
  kind,
  themes,
  onOpen,
}: {
  title: string;
  Icon: LucideIcon;
  kind: ChartKind;
  themes: StoreTheme[];
  onOpen: (t: StoreTheme) => void;
}) {
  const tr = useT();
  const rows = themes.slice(0, 5);
  return (
    <section aria-label={tr(title)} className="rounded-md bg-surface p-4 ring-1 ring-edge-soft">
      <SectionHeader icon={<Icon size={16} className="text-ink-subtle" />} label={tr(title)} />
      <div className="flex flex-col">
        {rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-ink-subtle">
            {tr("Nothing here yet")}
          </p>
        ) : (
          rows.map((t, i) => (
            <ChartRow key={t.id} rank={i + 1} theme={t} kind={kind} onOpen={onOpen} />
          ))
        )}
      </div>
    </section>
  );
}

function RowThumb({ theme }: { theme: StoreTheme }) {
  const img = theme.cover ?? theme.screenshots[0] ?? null;
  const swatch = theme.swatch.slice(0, 3);
  return (
    <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[7px] bg-elevated ring-1 ring-edge-soft">
      {img ? (
        <img
          src={img}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full">
          {theme.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </span>
      )}
      {img && swatch.length > 0 && (
        <span className="absolute bottom-1 end-1 flex overflow-hidden rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-1 ring-black/40">
          {swatch.map((c, i) => (
            <span key={i} className="h-2.5 w-2" style={{ background: c }} />
          ))}
        </span>
      )}
    </span>
  );
}

function ChartRow({
  rank,
  theme,
  kind,
  onOpen,
}: {
  rank: number;
  theme: StoreTheme;
  kind: ChartKind;
  onOpen: (t: StoreTheme) => void;
}) {
  const tr = useT();
  const top = rank <= 3;
  return (
    <div className="group relative flex cursor-pointer items-center gap-3 rounded-md p-2 text-start transition-colors hover:bg-elevated">
      <button
        type="button"
        onClick={() => onOpen(theme)}
        aria-label={tr("Open {name}", { name: theme.name })}
        className="absolute inset-0 z-0 rounded-md focus-visible:ring-2 focus-visible:ring-accent"
      />
      <span
        className={`pointer-events-none relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-sm text-[12.5px] font-bold tabular-nums ${
          top ? "bg-accent text-canvas" : "bg-elevated text-ink-subtle"
        }`}
      >
        {rank}
      </span>
      <span className="pointer-events-none relative z-10">
        <RowThumb theme={theme} />
      </span>
      <span className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold leading-tight text-ink">
          {theme.name}
        </span>
        <span className="truncate text-[11.5px] text-ink-subtle">
          {theme.authorHandle ? (
            <ThemeAuthorButton handle={theme.authorHandle} name={theme.author || tr("Anonymous")} />
          ) : (
            theme.author || tr("Anonymous")
          )}
        </span>
      </span>
      <span className="pointer-events-none relative z-10 shrink-0 ps-1">
        {kind === "rating" && theme.ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular-nums text-ink-muted">
            <Star size={12} className="fill-accent text-accent" />
            {theme.ratingAvg.toFixed(1)}
          </span>
        ) : kind === "downloads" ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular-nums text-ink-muted">
            <ArrowDownToLine size={12} strokeWidth={2.2} />
            {fmtCount(theme.downloads)}
          </span>
        ) : (
          <span className="text-[11.5px] font-semibold tabular-nums text-ink-subtle">
            {relTime(theme.createdAt)}
          </span>
        )}
      </span>
    </div>
  );
}
